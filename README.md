# Firesales

Firesales is the sold-out drop engine for independent chefs and food creators.
It turns one menu item and a fixed batch into a shareable event: guests claim
real plates, complete checkout, and join the next-drop list when the batch is
gone. The aim is simple: cook against paid demand rather than chase orders in
DMs.

## What a chef can do

1. Optionally import facts from a public menu, venue, booking, or social-link
   page with Firecrawl.
2. Review the draft, set a hero menu item, plate price, batch size, and pickup
   details.
3. Open one shareable drop link.
4. Let guests hold plates for 15 minutes while they use secure Paystack checkout.
5. Use the live prep list and next-drop waitlist to make the next batch easier
   to sell.

## Why this stack is here

- **Convex** stores chef drops, reservations, paid orders, and waitlists, then
  pushes capacity updates to the public page in real time.
- **Cloudflare Durable Objects** own the hot inventory counter for each drop.
  This is the concurrency boundary that prevents a social-media rush from
  overselling a limited batch.
- **Paystack** creates the hosted checkout and sends a signed `charge.success`
  webhook. The webhook is verified with Paystack before it confirms the Durable
  Object hold and records a paid order in Convex.
- **Firecrawl** imports public source facts only into a reviewed chef draft. It
  never publishes or invents a menu on the chef's behalf.
- **TanStack Start/Router** serves the chef studio and public drop pages.

Cloudflare AI and legacy checkout integrations are intentionally not part of
the live checkout path. Paystack is the Kenya-first adapter; other-country
providers can use the provider-neutral reservation and order records later.

## Local setup

```bash
pnpm install
npx convex dev
pnpm dev
```

Copy `.env.example` to `.env.local` and populate the non-secret development
values. Put backend secrets in the Convex environment for the deployment that
runs the functions:

```bash
npx convex env set PAYSTACK_SECRET_KEY <secret-key>
npx convex env set PAYSTACK_CURRENCY KES
npx convex env set CLOUDFLARE_WORKER_URL <worker-url>
npx convex env set CLOUDFLARE_WORKER_TOKEN <worker-token>
npx convex env set FIRECRAWL_API_KEY <key>
```

Paystack checkout does not require a separate provider product for every chef
or drop. Firesales initializes a payment for the held batch amount in KES and
records the Paystack reference against that reservation.

## Deploy the inventory worker

The worker lives in `cloudflare-worker/`. Configure a strong
`CLOUDFLARE_WORKER_TOKEN` as a Cloudflare Worker secret, deploy the worker, and
set the resulting URL plus the same token in Convex. The Durable Object class
is already declared in `cloudflare-worker/wrangler.toml`.

## Configure Paystack

1. Create a Paystack test integration and put its secret key in
   `PAYSTACK_SECRET_KEY`. Use a live key only after your Paystack account and
   payment channels are approved.
2. Enable the checkout methods you want in Paystack—typically cards and M-Pesa
   for a Kenya launch.
3. Add the Convex HTTP endpoint
   `https://<your-deployment>.convex.site/webhooks/paystack` to Paystack's
   webhook settings. Paystack signs it with the same secret key.
4. Run a test checkout and verify that a paid guest appears in the chef's prep
   list.

For automatic chef settlement, create and verify a Paystack subaccount for the
chef, then associate its code with the chef profile. Without one, funds settle
to the Firesales platform account. Confirm food-sales eligibility, refund
policy, tax responsibilities, and the chef payout agreement before going live.

## Firecrawl source research

See [the Firecrawl setup guide](docs/FIRECRAWL_SETUP.md). The chef studio gives
each chef three complimentary source imports, then continues to support manual
drop creation without a Firecrawl key or credit.

## Verification

```bash
pnpm typecheck
pnpm build
```
