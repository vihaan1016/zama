# Sealed-Bid Batch Auction DEX - Testnet Implementation

> **Production-ready testnet implementation using Foundry and 2026 tech stack**

**Updated**: July 2026  
**Focus**: Sepolia testnet deployment  
**Framework**: Foundry  
**Status**: Ready to build ✅

---

## 📚 Documentation Structure

### Quick Start (⚡ Start Here)

**[QUICK_START.md](./QUICK_START.md)** (30 minutes to deployment)
- Install Foundry
- Deploy to Sepolia
- First encrypted order
- Essential commands

### Core Documentation

**[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** - Smart Contracts
- Updated tech stack (Foundry, FHEVM v0.11)
- Complete contract code
- Foundry test examples
- Deployment scripts
- Testnet-specific simplifications

**[IMPLEMENTATION_PLAN_PART2.md](./IMPLEMENTATION_PLAN_PART2.md)** - Frontend & Infrastructure
- Next.js 16.3 setup
- Wagmi v3 configuration
- FHE client integration (fhevmjs 0.7)
- React 19 patterns
- Minimal keeper bot

**[FOUNDRY_GUIDE.md](./FOUNDRY_GUIDE.md)** - Foundry Deep Dive
- Testing strategies
- Cast commands
- Debugging techniques
- Gas optimization
- CI/CD setup

**[ARCHITECTURAL_DECISIONS.md](./ARCHITECTURAL_DECISIONS.md)** - Design Rationale
- Key architectural choices
- Trade-off analysis
- Alternatives considered

### Legacy Documentation

Old V1 (Hardhat/Mainnet) docs are archived in `archive_v1/` for reference.

---

## 🚀 Getting Started (5 Steps)

### 1. Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 2. Clone FHEVM Template

```bash
git clone https://github.com/zama-ai/fhevm-foundry-template.git fba-dex
cd fba-dex
forge install
```

### 3. Get Testnet ETH

Visit: https://sepoliafaucet.com

### 4. Configure & Deploy

```bash
cp .env.example .env.sepolia
# Edit .env.sepolia with your private key

forge script script/Deploy.s.sol --rpc-url sepolia --broadcast
```

### 5. Build Frontend

```bash
npx create-next-app@latest frontend
cd frontend
npm install wagmi@^3.0.0 viem@^2.22.0 fhevmjs@^0.7.0
```

**Full guide**: [QUICK_START.md](./QUICK_START.md)

---

## 🏗️ What You're Building

A **testnet demo** of a sealed-bid batch auction DEX:

1. **Users submit encrypted orders** (FHE keeps prices hidden)
2. **Orders accumulate in batches** (5-minute windows)
3. **Keeper closes batches** (simple bot)
4. **On-chain clearing** (uniform price discovery)
5. **Settlement** (winners fill at clearing price)

### Testnet Simplifications

This testnet version intentionally simplifies:

✅ **Included**:
- Encrypted order submission (full FHE)
- Batch lifecycle management
- Uniform price discovery
- Settlement logic
- Frontend for order entry

🔜 **Not Included** (add if you want):
- Complex keeper infrastructure
- Order cancellation
- Partial fills
- Multiple markets
- Advanced monitoring
- Production security hardening

---

## 📖 Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16.3)           │
│  - Order form with client-side FHE encryption        │
│  - Batch status tracker                              │
│  - Portfolio view                                    │
└──────────────────────┬──────────────────────────────┘
                       │ fhevmjs 0.7 + wagmi v3
                       ▼
┌─────────────────────────────────────────────────────┐
│              Smart Contracts (Sepolia)               │
│  ┌─────────────────────────────────────────────┐   │
│  │  BatchAuctionDEX.sol                        │   │
│  │  - Encrypted order management               │   │
│  │  - Batch lifecycle                          │   │
│  │  - Settlement                               │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  ClearingEngine.sol                         │   │
│  │  - Price discovery (tick-based)             │   │
│  └─────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│           Keeper Bot (Optional)                      │
│  - Monitors batch timing                             │
│  - Calls closeBatch()                                │
└─────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack (2026)

### Smart Contracts
```toml
[dependencies]
solidity = "0.8.26"
fhevm = "v0.11"
forge-fhevm = "latest"
openzeppelin-confidential = "0.3.0"
```

### Frontend
```json
{
  "next": "^16.3.0",
  "react": "^19.0.0",
  "wagmi": "^3.0.0",
  "viem": "^2.22.0",
  "fhevmjs": "^0.7.0"
}
```

### Infrastructure
- **Network**: Sepolia testnet
- **RPC**: https://sepolia.rpc.zama.ai
- **Explorer**: https://sepolia.etherscan.io
- **Framework**: Foundry (Rust-based, blazing fast)

---

## 🎓 Learning Path

### Beginner (2-3 hours)
1. Read [QUICK_START.md](./QUICK_START.md)
2. Deploy sample contract
3. Submit test order via frontend
4. Watch batch close and settle

### Intermediate (1 day)
1. Read [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
2. Understand FHE encryption flow
3. Write custom tests
4. Modify contracts and redeploy

### Advanced (3-5 days)
1. Read [FOUNDRY_GUIDE.md](./FOUNDRY_GUIDE.md)
2. Implement clearing engine
3. Build keeper bot
4. Add advanced features (cancellation, partial fills)

---

## ⚡ Common Commands Reference

### Foundry
```bash
forge build                    # Compile
forge test                     # Run tests
forge test -vvv                # Verbose output
forge test --gas-report        # Gas usage
forge coverage                 # Coverage report
forge snapshot                 # Gas snapshots
```

### Deployment
```bash
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast
forge verify-contract <ADDRESS> <CONTRACT> --chain sepolia
```

### Cast (CLI)
```bash
cast call <CONTRACT> "currentBatchId()(uint256)" --rpc-url sepolia
cast send <CONTRACT> "closeBatch()" --rpc-url sepolia --private-key <KEY>
cast balance <ADDRESS> --rpc-url sepolia
```

### Frontend
```bash
npm run dev                    # Start dev server
npm run build                  # Production build
vercel --prod                  # Deploy to Vercel
```

---

## 🔍 Implementation Approach

This implementation focuses on testnet deployment with modern tooling:

| Aspect | Details |
|--------|---------|
| **Cost** | Free (testnet) |
| **Stakes** | No risk |
| **Complexity** | Simplified core features |
| **Monitoring** | Basic (optional) |
| **Security Audit** | Not required for testnet |
| **Timeline** | 1-2 weeks |
| **Framework** | Foundry (fast, Rust-based) |
| **Network** | Sepolia testnet |

---

## 🐛 Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| Invalid proof | Check contract address in FHE encryption |
| Out of gas | Use `--gas-limit 10000000` |
| Only keeper error | Verify KEEPER_ADDRESS matches |
| Tests fail | Inherit from FHEVMTest, call super.setUp() |
| Frontend can't connect | Use https://sepolia.rpc.zama.ai |
| Foundry not found | Run `foundryup` |

**Full troubleshooting**: See each guide's troubleshooting section

---

## 📊 What's Included vs Not Included

### ✅ Included in Testnet Version

- Complete smart contract code (Foundry)
- Encrypted order submission (FHE)
- Batch lifecycle management
- Basic price discovery algorithm
- Frontend order form (Next.js 16.3)
- Deployment scripts
- Test suite
- Simple keeper bot example

### 🔜 Not Included (Add If Needed)

- Multi-keeper redundancy
- Advanced clearing algorithms
- Order cancellation
- Partial fills
- Multiple market pairs
- Production monitoring (Prometheus/Grafana)
- Advanced error recovery
- Full security audit
- Mainnet deployment

---

## 🎯 Success Criteria

**Day 1**:
- [ ] Foundry installed
- [ ] Contracts compiled
- [ ] Tests pass
- [ ] Deployed to Sepolia

**Week 1**:
- [ ] Frontend running
- [ ] Can submit encrypted orders
- [ ] Keeper closes batches
- [ ] Orders settle correctly

**Week 2**:
- [ ] Added custom features
- [ ] Comprehensive tests
- [ ] Documentation updated
- [ ] Shared with community

---

## 🆘 Getting Help

### Official Resources
- [Zama FHEVM Documentation](https://docs.zama.ai/protocol)
- [Foundry Book](https://book.getfoundry.sh/)
- [Wagmi v3 Docs](https://wagmi.sh/)
- [Next.js 16 Docs](https://nextjs.org/docs)

### Community
- [Zama Discord](https://discord.gg/zama) - FHE questions
- [Foundry Telegram](https://t.me/foundry_rs) - Foundry help
- [Ethereum StackExchange](https://ethereum.stackexchange.com/) - General Solidity

### This Documentation
- Questions about **smart contracts**: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
- Questions about **frontend**: [IMPLEMENTATION_PLAN_PART2.md](./IMPLEMENTATION_PLAN_PART2.md)
- Questions about **Foundry**: [FOUNDRY_GUIDE.md](./FOUNDRY_GUIDE.md)
- **Quick answers**: [QUICK_START.md](./QUICK_START.md)

---

*Last Updated: July 5, 2026*  
*Target: Sepolia Testnet*  
*Framework: Foundry*
