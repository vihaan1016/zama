# Sealed-Bid Batch-Auction DEX (FBA)

**Submit your order encrypted; the batch clears at one uniform price; the mempool never sees your bid,
so nothing can front-run or sandwich you.**

Built with FHE (Zama FHEVM) for the Zama Developer Program S3 — Builder Track.

Traders submit encrypted limit orders (price + size are FHE ciphertexts). Each batch clears at a single
uniform price computed entirely under FHE — revealing only the winning `(tick, volume)` — and crossing
orders settle as confidential ERC-7984 transfers. No individual order or fill ever leaks on-chain.

## Docs

| Doc | For |
|-----|-----|
| [`sealed-bid-fba-dex (1).md`](./sealed-bid-fba-dex%20(1).md) | The spec / pitch brief |
| [`docs/PROJECT_SUMMARY.md`](./docs/PROJECT_SUMMARY.md) | What's built, architecture, status, roadmap |
| [`docs/BACKEND_AUDIT.md`](./docs/BACKEND_AUDIT.md) | Audit findings + contract behaviour |
| [`docs/FRONTEND_GUIDE.md`](./docs/FRONTEND_GUIDE.md) | Everything the frontend needs to build |

## Layout

```
src/        Solidity contracts (BatchAuctionDEX, ClearingEngine, TickMath, ConfidentialToken)
test/       Foundry tests (TickMath fuzz + full encrypted lifecycle)
script/     Deploy.s.sol
keeper/     Off-chain lifecycle keeper (TypeScript/viem)
infra/      Prometheus + Grafana provisioning (see docker-compose.yml)
```

## Quick start

```bash
forge build
forge test                # 11 tests (runs in Foundry isolate mode)

# Deploy (Sepolia + Zama FHEVM)
cp .env.example .env       # PRIVATE_KEY, RPC_URL, ETHERSCAN_API_KEY
forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --broadcast --verify

# Keeper + observability
cp keeper/.env.example keeper/.env   # KEEPER_PRIVATE_KEY, DEX_ADDRESS, RELAYER_URL
docker compose up --build            # keeper + postgres + prometheus + grafana
```
