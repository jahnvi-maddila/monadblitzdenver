# 64×64 Canvas

Shared 64×64 pixel canvas. Use the REST backend only, or mint pixels on **Monad Testnet** by deploying the contract and connecting your wallet.

## Run locally (REST only)

**Terminal 1 – backend:** `npm install` then `npm run server` (port 3001)  
**Terminal 2 – frontend:** `npm run dev` → open `http://localhost:5173`

Click a pixel to draw. The app proxies `/api` to the backend and polls so everyone sees the same canvas.

## Mint pixels on-chain (Monad Testnet)

1. **Deploy the contract** (from repo root `monad/`):
   ```bash
   forge script script/PixelCanvas.s.sol:PixelCanvasScript --rpc-url https://testnet-rpc.monad.xyz --broadcast --private-key <YOUR_PRIVATE_KEY>
   ```
   Copy the deployed contract address from the output.

2. **Point the frontend at the contract:** create `monad/frontend/.env`:
   ```
   VITE_PIXEL_CANVAS_ADDRESS=0xYourDeployedAddress
   ```
   Restart `npm run dev`.

3. **Connect wallet:** click “Connect wallet” and approve Monad Testnet. Get testnet MON from [faucet.monad.xyz](https://faucet.monad.xyz).

4. **Draw:** each pixel click sends a transaction and mints that pixel on-chain. Everyone reads the same canvas from the contract; no REST server needed for the canvas when the contract is set.

## Build

```bash
npm run lint
npm run build
```
