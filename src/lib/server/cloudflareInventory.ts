/**
 * Cloudflare Worker Client for Atomic Inventory Operations
 * This module provides functions to interact with the Cloudflare Worker that handles atomic inventory operations
 */

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
  const response = await fetch(`${process.env.CLOUDFLARE_WORKER_URL}/inventory/${productId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CLOUDFLARE_WORKER_TOKEN}`,
    },
  });

  return response.json();
}

// Function to reserve inventory
export async function reserveInventory(request: InventoryRequest): Promise<InventoryResponse> {
  const response = await fetch(`${process.env.CLOUDFLARE_WORKER_URL}/inventory/reserve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CLOUDFLARE_WORKER_TOKEN}`,
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
  const response = await fetch(`${process.env.CLOUDFLARE_WORKER_URL}/inventory/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CLOUDFLARE_WORKER_TOKEN}`,
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
  const response = await fetch(`${process.env.CLOUDFLARE_WORKER_URL}/inventory/release`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CLOUDFLARE_WORKER_TOKEN}`,
    },
    body: JSON.stringify(request),
  });

  return response.json();
}
