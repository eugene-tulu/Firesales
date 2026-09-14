import { httpRouter } from 'convex/server';
import { authComponent, createAuth } from './auth';
import { healthCheck } from './health';
import { handlePaystackWebhook } from './payments';

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

// Health check endpoint
http.route({
  path: '/health',
  method: 'GET',
  handler: healthCheck,
});

// Paystack webhook endpoint. Configure this exact HTTPS URL in Paystack's
// Settings → API Keys & Webhooks screen.
http.route({
  path: '/webhooks/paystack',
  method: 'POST',
  handler: handlePaystackWebhook,
});

export default http;
