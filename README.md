# SweetlightSelfie

Standalone photographer portfolio and responsive visual editor built with React and Vite.

## Local development

```bash
npm install
npm run dev
```

The local Vite server includes development-only endpoints for image uploads, automatic cover analysis and the Share Center. Personal offers are stored durably in `.tmp-share-center` and can be searched, duplicated, archived or revoked.

## Share Center

The editor supports a stable general link and named personal links with per-client pricing, an immutable price snapshot, WhatsApp text and revision history. A personal link is created only after the explicit create action; preparing an offer never changes the public price list.

Local development uses the Vite API automatically. A public deployment needs the Supabase Edge Function described in [`supabase/README.md`](supabase/README.md), then this build variable:

```text
VITE_SHARE_API_BASE_URL=https://<project-ref>.supabase.co/functions/v1/share-api
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<public-anon-key>
```

Add the same three values as GitHub repository variables. Management requests use
a tab-scoped Supabase Auth owner session; the public link resolver remains
accessible only through its opaque token. Create the photographer's account,
assign immutable app metadata `{ "share_owner": true }`, and disable public
signup before the first sign-in. A dedicated custom domain is recommended for the
production editor so it does not share an origin with unrelated GitHub Pages projects.

Without the external API, Pages keeps the general site link available but disables personal-link creation. This prevents accidentally sending a browser-only link that cannot open on the client's phone.

## GitHub Pages preview

The workflow in `.github/workflows/deploy-pages.yml` builds the project for:

`https://shneorphotography-rgb.github.io/SweetlightSelfie/`

GitHub Pages remains a static front end. Design changes are stored only in the current browser, while personal share records use the external API when `VITE_SHARE_API_BASE_URL` is configured. Image uploads and automatic cover re-analysis remain local-development features.
