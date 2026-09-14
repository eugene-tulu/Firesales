// Cloudflare Durable Object for the hot path of a chef drop. Each object is
// keyed by a drop ID, never by a reusable menu item, so concurrent drops do
// not share capacity.

interface Reservation {
  quantity: number;
  sessionId: string;
  expiresAt: number;
}

interface InventoryState {
  saleId: string;
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  soldUnits: number;
  reservations: Record<string, Reservation>;
  confirmedReservationIds: Record<string, true>;
}

interface Env {
  INVENTORY_DO: DurableObjectNamespace;
  CLOUDFLARE_WORKER_TOKEN: string;
}

const HOLD_DURATION_MS = 15 * 60 * 1000;

export class InventoryDO {
  state: DurableObjectState;
  env: Env;
  inventoryState: InventoryState;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.inventoryState = {
      saleId: '',
      totalUnits: 0,
      availableUnits: 0,
      reservedUnits: 0,
      soldUnits: 0,
      reservations: {},
      confirmedReservationIds: {},
    };

    this.state.blockConcurrencyWhile(async () => {
      const storedState = await this.state.storage.get<InventoryState>('inventory');
      if (storedState) {
        this.inventoryState = {
          ...storedState,
          confirmedReservationIds: storedState.confirmedReservationIds ?? {},
        };
      }
    });
  }

  private async persist() {
    await this.state.storage.put('inventory', this.inventoryState);
  }

  private async cleanupExpiredReservations() {
    const now = Date.now();
    let changed = false;

    for (const [reservationId, reservation] of Object.entries(this.inventoryState.reservations)) {
      if (reservation.expiresAt >= now) continue;
      this.inventoryState.reservedUnits -= reservation.quantity;
      this.inventoryState.availableUnits += reservation.quantity;
      delete this.inventoryState.reservations[reservationId];
      changed = true;
    }

    if (changed) await this.persist();
  }

  private async ensureInitialized(saleId: string, totalUnits: number) {
    if (!Number.isInteger(totalUnits) || totalUnits < 1) {
      throw new Error('A drop must have a positive whole-number capacity.');
    }

    if (!this.inventoryState.saleId) {
      this.inventoryState = {
        saleId,
        totalUnits,
        availableUnits: totalUnits,
        reservedUnits: 0,
        soldUnits: 0,
        reservations: {},
        confirmedReservationIds: {},
      };
      await this.persist();
      return;
    }

    if (this.inventoryState.saleId !== saleId) {
      throw new Error('Inventory object does not belong to this drop.');
    }
    if (this.inventoryState.totalUnits !== totalUnits) {
      throw new Error('Drop capacity cannot change after reservations begin.');
    }
  }

  private assertSale(saleId: string) {
    if (this.inventoryState.saleId !== saleId) {
      throw new Error(`Inventory is not initialized for drop ${saleId}.`);
    }
  }

  async getInventory(saleId: string) {
    this.assertSale(saleId);
    await this.cleanupExpiredReservations();
    return { ...this.inventoryState };
  }

  async initializeInventory(saleId: string, totalUnits: number) {
    await this.ensureInitialized(saleId, totalUnits);
    return { success: true, ...this.inventoryState };
  }

  async reserveInventory(
    saleId: string,
    totalUnits: number,
    quantity: number,
    sessionId: string,
  ): Promise<{ success: boolean; error?: string; reservationId?: string }> {
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { success: false, error: 'Choose at least one plate.' };
    }

    await this.ensureInitialized(saleId, totalUnits);
    await this.cleanupExpiredReservations();

    if (this.inventoryState.availableUnits < quantity) {
      return { success: false, error: 'This drop no longer has enough plates available.' };
    }

    const reservationId = crypto.randomUUID();
    this.inventoryState.availableUnits -= quantity;
    this.inventoryState.reservedUnits += quantity;
    this.inventoryState.reservations[reservationId] = {
      quantity,
      sessionId,
      expiresAt: Date.now() + HOLD_DURATION_MS,
    };
    await this.persist();

    return { success: true, reservationId };
  }

  async confirmReservation(
    saleId: string,
    reservationId: string,
    sessionId: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.assertSale(saleId);
    await this.cleanupExpiredReservations();

    // Payment providers retry completed webhooks. A confirmed hold is deliberately
    // idempotent so a retry cannot turn a paid guest into a failed order.
    if (this.inventoryState.confirmedReservationIds[reservationId]) {
      return { success: true };
    }

    const reservation = this.inventoryState.reservations[reservationId];
    if (!reservation) return { success: false, error: 'Reservation not found or expired.' };
    if (reservation.sessionId !== sessionId) {
      return { success: false, error: 'Session does not match this reservation.' };
    }

    this.inventoryState.reservedUnits -= reservation.quantity;
    this.inventoryState.soldUnits += reservation.quantity;
    delete this.inventoryState.reservations[reservationId];
    this.inventoryState.confirmedReservationIds[reservationId] = true;
    await this.persist();

    return { success: true };
  }

  async releaseReservation(
    saleId: string,
    reservationId: string,
    sessionId: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.assertSale(saleId);
    await this.cleanupExpiredReservations();

    if (this.inventoryState.confirmedReservationIds[reservationId]) {
      return { success: false, error: 'A paid reservation cannot be released.' };
    }

    const reservation = this.inventoryState.reservations[reservationId];
    if (!reservation) return { success: false, error: 'Reservation not found or expired.' };
    if (reservation.sessionId !== sessionId) {
      return { success: false, error: 'Session does not match this reservation.' };
    }

    this.inventoryState.reservedUnits -= reservation.quantity;
    this.inventoryState.availableUnits += reservation.quantity;
    delete this.inventoryState.reservations[reservationId];
    await this.persist();

    return { success: true };
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const authHeader = request.headers.get('Authorization');
      if (
        !authHeader ||
        !authHeader.startsWith('Bearer ') ||
        authHeader.slice(7) !== this.env.CLOUDFLARE_WORKER_TOKEN
      ) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }

      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method === 'GET' && path.startsWith('/inventory/')) {
        const saleId = path.split('/')[2];
        return Response.json(await this.getInventory(saleId));
      }

      if (request.method !== 'POST') {
        return Response.json({ success: false, error: 'Not found' }, { status: 404 });
      }

      const body = (await request.json()) as Record<string, unknown>;
      const saleId = typeof body.saleId === 'string' ? body.saleId : '';
      if (!saleId)
        return Response.json({ success: false, error: 'Missing drop ID.' }, { status: 400 });

      if (path === '/inventory/initialize') {
        return Response.json(await this.initializeInventory(saleId, Number(body.totalUnits)));
      }
      if (path === '/inventory/reserve') {
        return Response.json(
          await this.reserveInventory(
            saleId,
            Number(body.totalUnits),
            Number(body.quantity),
            String(body.sessionId ?? ''),
          ),
        );
      }
      if (path === '/inventory/confirm') {
        return Response.json(
          await this.confirmReservation(
            saleId,
            String(body.reservationId ?? ''),
            String(body.sessionId ?? ''),
          ),
        );
      }
      if (path === '/inventory/release') {
        return Response.json(
          await this.releaseReservation(
            saleId,
            String(body.reservationId ?? ''),
            String(body.sessionId ?? ''),
          ),
        );
      }

      return Response.json({ success: false, error: 'Not found' }, { status: 404 });
    } catch (error) {
      console.error('Inventory Durable Object error:', error);
      return Response.json(
        { success: false, error: error instanceof Error ? error.message : 'Inventory error' },
        { status: 500 },
      );
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (!url.pathname.startsWith('/inventory/')) {
        return new Response('Not Found', { status: 404 });
      }

      let saleId = url.pathname.split('/')[2];
      if (request.method === 'POST') {
        // Read the clone only: the original request body is forwarded intact to
        // the Durable Object below.
        const body = (await request.clone().json()) as Record<string, unknown>;
        saleId = typeof body.saleId === 'string' ? body.saleId : '';
      }

      if (!saleId)
        return Response.json({ success: false, error: 'Missing drop ID.' }, { status: 400 });

      const id = env.INVENTORY_DO.idFromName(saleId);
      return env.INVENTORY_DO.get(id).fetch(request);
    } catch (error) {
      console.error('Inventory worker error:', error);
      return Response.json(
        { success: false, error: error instanceof Error ? error.message : 'Inventory error' },
        { status: 500 },
      );
    }
  },
};
