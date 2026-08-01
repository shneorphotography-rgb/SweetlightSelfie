# Share Center backend

This directory is a production scaffold for the standalone photographer portfolio.
It is intentionally credential-free. Link data is private by default; the public
resolver returns only the saved, resolved website configuration.

## Deploy

1. Link this folder to a Supabase project.
2. Apply `migrations/20260801190000_share_center.sql`.
3. Set `SHARE_ALLOWED_ORIGIN` to the production site origin, `SHARE_SITE_URL`
   to the full public site base URL, and `SHARE_TOKEN_ENCRYPTION_KEY` to a
   securely generated 32-byte base64url value. Supabase provides
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to the
   Edge Function runtime; never expose the service-role key to Vite or the browser.
4. Deploy the `share-api` Edge Function.
5. Create the photographer owner in Supabase Auth, set immutable app metadata
   `{ "share_owner": true }` for that user, and disable public email signup.
   Expose only the project URL and public anon key as `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`. The editor signs in with this account and attaches
   the short-lived access token to management requests.

The function has gateway JWT verification disabled because one route must be
public. It validates the bearer token itself on every management route. Row-level
security then requires the protected `share_owner` app-metadata claim and limits
records and versions to that owner. The browser keeps the session in
`sessionStorage`, so closing the tab signs the editor out.

## Edge Function contract

Base path: `/functions/v1/share-api`

### Public

- `GET /public/:token` -> `{ config }`

The public token contains 192 random bits. Its SHA-256 digest, an AES-GCM encrypted
copy (needed so the authenticated owner can copy an older link again), and a
six-character hint are stored; plaintext is never persisted. Revoked, archived,
and expired links cannot resolve. The response
does not include client details, event details, internal notes, price metadata,
database identifiers, or access statistics.

### Authenticated management

Send `Authorization: Bearer <user access token>`.

- `GET /shares?search=&status=&eventFrom=&eventTo=&createdFrom=&createdTo=&sort=&limit=&offset=`
- `POST /shares` creates a recorded share and returns the raw token once.
- `GET /shares/:id` returns the owner-only record and version history.
- `PATCH /shares/:id` updates client/event/message metadata.
- `DELETE /shares/:id` archives the record (soft delete).
- `POST /shares/:id/versions` publishes a new immutable price/config version on the same link.
- `POST /shares/:id/duplicate` creates a new record and a new link.
- `POST /shares/:id/revoke`, `/archive`, or `/restore` changes link lifecycle.

For compatibility with the browser repository, `/api/shares` and
`/api/public-shares/:token` are accepted aliases under the same function URL.

Create/version payloads accept `resolvedConfig` (or the legacy `config` name),
`pricingSnapshot`, `pricingSummary`, and `message`. A version always stores the
fully resolved public configuration, so price overrides never mutate the site's
main configuration.

## Local Vite API

The Vite development server exposes the same workflow at `/api/client-shares`:

- `GET /api/client-shares` lists and searches records.
- `POST /api/client-shares` explicitly creates a recorded link.
- `GET|PATCH|DELETE /api/client-shares/records/:id` reads, updates, or archives.
- `GET|POST /api/client-shares/records/:id/versions` reads or creates versions.
- `POST /api/client-shares/records/:id/duplicate|revoke|archive|restore` performs the action.
- `GET /api/client-shares/:token` and `/public/:token` resolve only `{ config }`.

Local records are atomically persisted in `.tmp-share-center/share-store.json`,
which is covered by the repository's existing `.tmp-*` ignore rule. Existing
24-character snapshots in `.tmp-client-shares` remain readable but are not used
for new links. The local management API has no login and is therefore restricted
to loopback requests from the same computer. Only token-based public resolution
is reachable over the local Wi-Fi address. Production management must use the
authenticated Edge Function and RLS policies above.
