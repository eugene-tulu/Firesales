# Firecrawl chef-source research

Firesales uses Firecrawl during chef onboarding—not as an automatic publisher.
A chef can paste a public menu, booking, venue, or link-in-bio page into the
drop studio. Firecrawl extracts a small set of possible facts, which the chef
must review before creating a draft.

## Configure it

Create a Firecrawl API key, then set it in the Convex environment that runs
the backend:

```bash
npx convex env set FIRECRAWL_API_KEY <your-api-key>
```

For production, use the production Convex deployment when setting the value.
The key stays server-side and is never sent to the browser.

## What gets imported

The importer asks for structured candidates such as:

- chef name and cuisine
- location or pickup details
- menu-item name and description
- a visible price
- a public image URL

It also receives a short markdown excerpt for troubleshooting. The app does
not publish the result, decide availability, scrape private pages, or use the
result as a substitute for the chef's own review.

## How to test

1. Start the app and sign in as a chef.
2. Open **Create a drop**.
3. Paste a public source URL into **Import a starting point**.
4. Check every populated field, especially price, collection details, dietary
   information, and image rights.
5. Create the draft and open it only when it is accurate.

Each chef receives three complimentary source imports. If Firecrawl is not
configured, or the allowance is exhausted, the chef can still create the drop
manually.

## Troubleshooting

- **Firecrawl is not configured:** set `FIRECRAWL_API_KEY` in Convex, not only
  in the local browser environment.
- **No useful facts returned:** use a more specific public menu or booking URL,
  or complete the draft manually.
- **Source is blocked:** some sites restrict scraping. Respect the source's
  terms and use material the chef is entitled to use.
