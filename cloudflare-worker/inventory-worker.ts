// Cloudflare Worker with Durable Objects for atomic inventory operations

// Define the structure of our inventory data
interface InventoryState {
  productId: string;
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  soldUnits: number;
  reservations: { [key: string]: { quantity: number; sessionId: string; expiresAt: number } };
}

// Define the types for Cloudflare Workers
interface Env {
  INVENTORY_DO: DurableObjectNamespace;
  CLOUDFLARE_WORKER_TOKEN: string;
}

// Durable Object class for inventory management
export class InventoryDO {
  state: DurableObjectState;
  env: Env;
  inventoryState: InventoryState;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.inventoryState = {
      productId: '',
      totalUnits: 0,
      availableUnits: 0,
      reservedUnits: 0,
      soldUnits: 0,
      reservations: {},
    };
    // Restore state if it exists
    this.state.blockConcurrencyWhile(async () => {
      const storedState = await this.state.storage.get<InventoryState>('inventory');
      if (storedState) {
        this.inventoryState = storedState;
      }
    });
  }

  // Handle GET requests to check inventory
  async getInventory(productId: string): Promise<InventoryState> {
    // If the product ID doesn't match what we have stored, this is an error
    if (this.inventoryState.productId !== productId) {
      throw new Error(`Inventory not initialized for product ${productId}`);
    }
    return { ...this.inventoryState };
  }

  // Handle POST requests to reserve inventory
  async reserveInventory(
    productId: string,
    quantity: number,
    sessionId: string,
  ): Promise<{ success: boolean; error?: string; reservationId?: string }> {
    // Initialize inventory if this is the first operation for this product
    if (this.inventoryState.productId === '' || this.inventoryState.productId !== productId) {
      this.inventoryState = {
        productId,
        totalUnits: 0, // This would be set when inventory is initialized
        availableUnits: 0,
        reservedUnits: 0,
        soldUnits: 0,
        reservations: {},
      };
    }

    // Check if there's enough available inventory
    if (this.inventoryState.availableUnits < quantity) {
      return { success: false, error: 'Insufficient inventory' };
    }

    // Create a unique reservation ID
    const reservationId = `reservation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Update inventory atomically
    this.inventoryState.availableUnits -= quantity;
    this.inventoryState.reservedUnits += quantity;

    // Add reservation to our object
    this.inventoryState.reservations[reservationId] = {
      quantity,
      sessionId,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes from now
    };

    // Persist the state
    await this.state.storage.put('inventory', this.inventoryState);

    return { success: true, reservationId };
  }

  // Handle POST requests to confirm a reservation
  async confirmReservation(
    reservationId: string,
    sessionId: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Check if the reservation exists
    const reservation = this.inventoryState.reservations[reservationId];
    if (!reservation) {
      return { success: false, error: 'Reservation not found' };
    }

    // Check if the session ID matches
    if (reservation.sessionId !== sessionId) {
      return { success: false, error: 'Session ID does not match reservation' };
    }

    // Check if the reservation has expired
    if (reservation.expiresAt < Date.now()) {
      return { success: false, error: 'Reservation has expired' };
    }

    // Update inventory: move from reserved to sold
    this.inventoryState.reservedUnits -= reservation.quantity;
    this.inventoryState.soldUnits += reservation.quantity;

    // Remove the reservation
    delete this.inventoryState.reservations[reservationId];

    // Persist the state
    await this.state.storage.put('inventory', this.inventoryState);

    return { success: true };
  }

  // Handle POST requests to release a reservation
  async releaseReservation(
    reservationId: string,
    sessionId: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Check if the reservation exists
    const reservation = this.inventoryState.reservations[reservationId];
    if (!reservation) {
      return { success: false, error: 'Reservation not found' };
    }

    // Check if the session ID matches
    if (reservation.sessionId !== sessionId) {
      return { success: false, error: 'Session ID does not match reservation' };
    }

    // Check if the reservation has expired
    if (reservation.expiresAt < Date.now()) {
      return { success: false, error: 'Reservation has expired' };
    }

    // Update inventory: return from reserved to available
    this.inventoryState.reservedUnits -= reservation.quantity;
    this.inventoryState.availableUnits += reservation.quantity;

    // Remove the reservation
    delete this.inventoryState.reservations[reservationId];

    // Persist the state
    await this.state.storage.put('inventory', this.inventoryState);

    return { success: true };
  }

  // Cleanup expired reservations
  async cleanupExpiredReservations(): Promise<void> {
    const now = Date.now();
    const expiredReservationIds: string[] = [];

    // Find all expired reservations
    for (const reservationId in this.inventoryState.reservations) {
      const reservation = this.inventoryState.reservations[reservationId];
      if (reservation.expiresAt < now) {
        expiredReservationIds.push(reservationId);
      }
    }

    // Release expired reservations
    for (const reservationId of expiredReservationIds) {
      const reservation = this.inventoryState.reservations[reservationId];
      if (reservation) {
        this.inventoryState.reservedUnits -= reservation.quantity;
        this.inventoryState.availableUnits += reservation.quantity;
        delete this.inventoryState.reservations[reservationId];
      }
    }

    // Persist the state if we made changes
    if (expiredReservationIds.length > 0) {
      await this.state.storage.put('inventory', this.inventoryState);
    }
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // Check for authentication
      const authHeader = request.headers.get('Authorization');
      if (
        !authHeader ||
        !authHeader.startsWith('Bearer ') ||
        authHeader.substring(7) !== this.env.CLOUDFLARE_WORKER_TOKEN
      ) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'GET' && path.startsWith('/inventory/')) {
        const productId = path.split('/')[2];
        const inventory = await this.getInventory(productId);
        return new Response(JSON.stringify(inventory), {
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (method === 'POST' && path === '/inventory/reserve') {
        const { productId, quantity, sessionId } = await request.json();
        const result = await this.reserveInventory(productId, quantity, sessionId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (method === 'POST' && path === '/inventory/confirm') {
        const { reservationId, sessionId } = await request.json();
        const result = await this.confirmReservation(reservationId, sessionId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (method === 'POST' && path === '/inventory/release') {
        const { reservationId, sessionId } = await request.json();
        const result = await this.releaseReservation(reservationId, sessionId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        return new Response(JSON.stringify({ success: false, error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (err) {
      console.error('Error in InventoryDO:', err);
      return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}

// Export the Durable Object
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // For requests that need to create/get a Durable Object
      if (request.url.includes('/inventory/')) {
        const url = new URL(request.url);
        let productId = url.pathname.split('/')[2];

        // For POST requests to /inventory/reserve, extract productId from request body
        if (request.method === 'POST' && url.pathname === '/inventory/reserve') {
          const body = await request.json();
          productId = body.productId;
        }

        // Create a unique ID for the Durable Object based on the product ID
        const id = env.INVENTORY_DO.idFromName(productId);
        const stub = env.INVENTORY_DO.get(id);
        return stub.fetch(request);
      }

      return new Response('Not Found', { status: 404 });
    } catch (err) {
      console.error('Error in main fetch:', err);
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
