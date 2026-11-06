# LOCAL MARS — Mission Control 2.1

English-only luxury dark interface for LOCAL MARS, using the existing Marslocal Supabase project.

## Connected modules
- Mission Overview dashboard
- Land Explorer backed by `public.world_parcels` (19 registered parcels)
- M-019 Central City with three districts and seven database-backed sites
- Owner-gated virtual business registration backed by `public.mars_m019_businesses`
- MLC Marketplace with 15-minute reservations and a secure simulated purchase RPC
- Authenticated member chat backed by `public.mars_chat_messages` (subject to Realtime publication)
- Authenticated MLC wallet view; optional starter allocation is demo-only
- MLC parcel purchases and balances are simulated credits with no cash value or real-world property rights
- Satellite tracking remains clearly labelled simulation

## Vercel environment variables
Set these for Production, Preview, and Development in Vercel Project Settings → Environment Variables:

- `VITE_SUPABASE_URL` = Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` = Supabase publishable key

A blank template is provided in `.env.example`. Never place a service-role key or other secret in browser code or any variable prefixed with `VITE_`. Redeploy after setting the variables.

## Run locally
`npm install`
`npm run dev`

## Production build
`npm run build`
Output directory: `dist`.

## Security and scope
Public read access is used only for the parcel registry and public marketplace listings, under their existing SELECT-only RLS policies. Chat requires Supabase Auth and authenticated row-level security. Wallet reads are scoped to the authenticated user's ledger rows. All parcel purchase flows use database RPCs with server-side balance and reservation checks. Virtual business creation requires an authenticated account that owns M-019; public visitors can only inspect public business records. MLC is simulation-only and cannot be redeemed for cash. Live spacecraft telemetry and a guaranteed 24/7 server process are not claimed.
