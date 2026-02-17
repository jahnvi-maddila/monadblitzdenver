## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```

## Frontend Prototype (WPlace-style)

A local frontend scaffold now lives at `monad/frontend` with:

- World map landing page
- Zoom-based pixel-art overlays (visible at higher zoom)
- Wallet login/connect flow for Monad testnet
- Click-to-paint pixel interaction
- 64 paints per session and 30-second cooldown
- Paid cooldown skip from connected wallet (configurable recipient/fee)

### Run locally

```shell
cd frontend
npm install
npm run dev
```

The app runs on Vite's local dev server (typically `http://localhost:5173`).
