# LOCAL MARS — Mission Control 2.0

Browser-first English-only prototype inspired by the existing LOCAL MARS project.

## Modules
- Mission Overview dashboard
- Interactive Mars parcel explorer: M-003, M-019, M-007, M-012, M-021
- Land marketplace with search
- MLC demo wallet
- Satellite and orbital simulation
- Communications chat prototype
- Responsive luxury dark interface

## Run
`npm install` then `npm run dev`.

## Build
`npm run build`.

## Deploy
Import this repository into Vercel. Build command: `npm run build`; output directory: `dist`.

## Prototype boundaries
This version uses mock data. It does not connect to real satellite hardware, live Mars telemetry, real-time multiplayer chat, real payments, blockchain, or a production land registry. MLC is demo-only. M-003 access control is illustrative. Connect a backend such as Supabase and implement server-side authorization and ledger logic before production use.
