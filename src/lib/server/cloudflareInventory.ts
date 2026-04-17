/**
 * Cloudflare Worker Client for Atomic Inventory Operations
 * This module provides functions to interact with the Cloudflare Worker that handles atomic inventory operations
 */

const getWorkerConfig = () => {
  const url = process.env.CLOUDFLARE_WORKER_URL;
  const token = process.env.CLOUDFLARE_WORKER_TOKEN;

  if (!url) {
    throw new Error('CLOUDFLARE_WORKER_URL environment variable is required');
  }
  if (!token) {
    throw new Error('CLOUDFLARE_WORKER_TOKEN environment variable is required for authentication');
  }

  return { url, token };
};

interface InventoryRequest {
  productId: string;
  quantity?: number;
  sessionId?: string;
  reservationId?: string;
}

interface InventoryResponse {
  success: boolean;
  availableUnits?: number;
  error?: string;
  reservationId?: string;
}

// Function to check available inventory
export async function checkInventory(productId: string): Promise<InventoryResponse> {
  const { url, token } = getWorkerConfig();
  const response = await fetch(`${url}/inventory/${productId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return response.json();
}

// Function to reserve inventory
export async function reserveInventory(request: InventoryRequest): Promise<InventoryResponse> {
  const { url, token } = getWorkerConfig();
  const response = await fetch(`${url}/inventory/reserve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  return response.json();
}

// Function to confirm inventory reservation (convert to sale)
export async function confirmReservation(request: {
  reservationId: string;
  sessionId: string;
}): Promise<InventoryResponse> {
  const { url, token } = getWorkerConfig();
  const response = await fetch(`${url}/inventory/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  return response.json();
}

// Function to release inventory reservation
export async function releaseReservation(request: {
  reservationId: string;
  sessionId: string;
}): Promise<InventoryResponse> {
  const { url, token } = getWorkerConfig();
  const response = await fetch(`${url}/inventory/release`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  return response.json();
}
