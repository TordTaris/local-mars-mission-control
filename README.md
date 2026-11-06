# LOCAL MARS — Mission Control 2.1

English-only luxury dark interface for LOCAL MARS, using the existing Marslocal Supabase project.

## Connected modules
- Mission Overview dashboard
- Land Explorer backed by `public.world_parcels`
- MLC Marketplace display backed by `public.mars_mlc_parcel_market`
- Authenticated member chat backed by `public.mars_chat_messages` (subject to Realtime publication)
- Authenticated, read-only MLC ledger query scoped to the signed-in user
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
Public read access is used only for the parcel registry and public marketplace listings, under their existing SELECT-only RLS policies. Chat requires Supabase Auth and authenticated row-level security. Wallet reads are scoped to the authenticated user's ledger rows. The UI does not enable purchases, transfers, balance mutation, or public writes. Live spacecraft telemetry and a guaranteed 24/7 server process are not claimed.
