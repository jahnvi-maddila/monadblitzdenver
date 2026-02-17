# WPlace Monad Frontend Prototype

This app is the first frontend milestone for an onchain, WPlace-style world canvas.

## Features

- World map landing page with Leaflet + OpenStreetMap tiles
- Pixel canvases that appear only when zooming in
- Wallet login flow (`/login`) for painting access
- Pixel placement on zoomed canvases
- Session mechanic:
  - 64 paint credits per session
  - 30-second cooldown when credits reach zero
  - Optional wallet payment to skip cooldown instantly

## Local Development

```bash
npm install
npm run dev
```

Default local URL: `http://localhost:5173`

## Production Build

```bash
npm run lint
npm run build
```

## Cooldown Payment Configuration (optional)

You can customize payment routing via Vite env variables:

- `VITE_COOLDOWN_COLLECTOR` - recipient address for cooldown skip payments
- `VITE_COOLDOWN_SKIP_FEE_WEI` - fee amount in wei hex format (example: `0x38d7ea4c68000` for 0.001 MON)
