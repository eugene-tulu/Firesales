/**
 * Client for the Cloudflare Durable Object that owns a drop's hot inventory
 * counter. Convex remains the durable business record; this service is the
 * single writer for concurrent holds and confirmations.
 */

const getWorkerConfig = () => {
  const url = process.env.CLOUDFLARE_WORKER_URL;
  const token = process.env.CLOUDFLARE_WORKER_TOKEN;

  if (!url) throw new Error('CLOUDFLARE_WORKER_URL environment variable is required');
  if (!token) throw new Error('CLOUDFLARE_WORKER_TOKEN environment variable is required');

  return { url: url.replace(/\/$/, ''), token };
};

export interface InventoryResponse {
  success: boolean;
  availableUnits?: number;
  reservedUnits?: number;
  soldUnits?: number;
  error?: string;
  reservationId?: string;
}

async function send(path: string, init: RequestInit): Promise<InventoryResponse> {
  const { url, token } = getWorkerConfig();
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as InventoryResponse;
  if (!response.ok && !payload.error) {
    return { success: false, error: `Inventory service returned ${response.status}.` };
  }
  return payload;
}

export function reserveInventory(request: {
  saleId: string;
  totalUnits: number;
  quantity: number;
  sessionId: string;
}) {
  return send('/inventory/reserve', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function confirmReservation(request: {
  saleId: string;
  reservationId: string;
  sessionId: string;
}) {
  return send('/inventory/confirm', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function releaseReservation(request: {
  saleId: string;
  reservationId: string;
  sessionId: string;
}) {
  return send('/inventory/release', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
