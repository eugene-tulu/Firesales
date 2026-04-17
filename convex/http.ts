import { httpRouter } from 'convex/server';
import { authComponent, createAuth } from './auth';
import { healthCheck } from './health';
import { handleDodoWebhook } from './payments';

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

// Health check endpoint
http.route({
  path: '/health',
  method: 'GET',
  handler: healthCheck,
});

// Dodo Payments webhook endpoint
http.route({
  path: '/webhooks/dodo-payments',
  method: 'POST',
  handler: handleDodoWebhook,
});

export default http;
