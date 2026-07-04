# Documentation Index

Quick navigation guide for the FBA DEX implementation documentation.

---

## 🚀 Start Here

| Document | Time | Purpose |
|----------|------|---------|
| **[README.md](./README.md)** | 5 min | Overview, tech stack, what you're building |
| **[QUICK_START.md](./QUICK_START.md)** | 30 min | Get from zero to deployed in 30 minutes |

---

## 📚 Core Documentation

### Implementation Guides

| Document | Lines | Focus |
|----------|-------|-------|
| **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** | 710 | Smart contracts, Foundry setup, core logic |
| **[IMPLEMENTATION_PLAN_PART2.md](./IMPLEMENTATION_PLAN_PART2.md)** | 695 | Frontend (Next.js 16.3), keeper bot, deployment |

### Reference Guides

| Document | Lines | Focus |
|----------|-------|-------|
| **[FOUNDRY_GUIDE.md](./FOUNDRY_GUIDE.md)** | 605 | Foundry testing, deployment, debugging, best practices |
| **[ARCHITECTURAL_DECISIONS.md](./ARCHITECTURAL_DECISIONS.md)** | 404 | Why we chose this approach, trade-offs, alternatives |

---

## 📖 When to Read What

### Day 1: Getting Started
1. [README.md](./README.md) - Understand the project
2. [QUICK_START.md](./QUICK_START.md) - Deploy your first contract

### Week 1: Building Core Features
1. [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Follow as you build contracts
2. [FOUNDRY_GUIDE.md](./FOUNDRY_GUIDE.md) - Reference for testing and deployment

### Week 2: Frontend & Polish
1. [IMPLEMENTATION_PLAN_PART2.md](./IMPLEMENTATION_PLAN_PART2.md) - Build the UI
2. [ARCHITECTURAL_DECISIONS.md](./ARCHITECTURAL_DECISIONS.md) - Understand design choices

---

## 🎯 Find Answers By Topic

### Smart Contracts
- **Where to start**: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) → Section 3
- **Testing**: [FOUNDRY_GUIDE.md](./FOUNDRY_GUIDE.md) → Testing section
- **Deployment**: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) → Section 4

### Frontend
- **Setup**: [IMPLEMENTATION_PLAN_PART2.md](./IMPLEMENTATION_PLAN_PART2.md) → Section 6
- **FHE integration**: [IMPLEMENTATION_PLAN_PART2.md](./IMPLEMENTATION_PLAN_PART2.md) → Section 6.3
- **Wagmi v3**: [IMPLEMENTATION_PLAN_PART2.md](./IMPLEMENTATION_PLAN_PART2.md) → Section 6.2

### Keeper Bot
- **Basic setup**: [IMPLEMENTATION_PLAN_PART2.md](./IMPLEMENTATION_PLAN_PART2.md) → Section 7
- **Deployment**: [IMPLEMENTATION_PLAN_PART2.md](./IMPLEMENTATION_PLAN_PART2.md) → Section 8

### Foundry
- **Commands**: [FOUNDRY_GUIDE.md](./FOUNDRY_GUIDE.md) → Command reference
- **Testing**: [FOUNDRY_GUIDE.md](./FOUNDRY_GUIDE.md) → Testing section
- **Debugging**: [FOUNDRY_GUIDE.md](./FOUNDRY_GUIDE.md) → Debugging section

### Design Decisions
- **Why Foundry?**: [ARCHITECTURAL_DECISIONS.md](./ARCHITECTURAL_DECISIONS.md) → ADR-010
- **Why testnet?**: [README.md](./README.md) → Implementation Approach
- **Why tick-based?**: [ARCHITECTURAL_DECISIONS.md](./ARCHITECTURAL_DECISIONS.md) → ADR-002

---

## 🔧 Quick Command Reference

### Install Foundry
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Build & Test
```bash
forge build
forge test
forge test -vvv
```

### Deploy
```bash
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast
```

### Get Help
```bash
forge --help
cast --help
```

**Full commands**: See [FOUNDRY_GUIDE.md](./FOUNDRY_GUIDE.md)

---

## 📂 File Structure

```
docs/
├── README.md                    ⭐ Start here
├── QUICK_START.md               ⚡ 30-min deployment
├── IMPLEMENTATION_PLAN.md       📋 Smart contracts
├── IMPLEMENTATION_PLAN_PART2.md 🎨 Frontend & keeper
├── FOUNDRY_GUIDE.md             🔨 Foundry reference
├── ARCHITECTURAL_DECISIONS.md   🤔 Design rationale
├── CLEANUP_SUMMARY.md           📝 What changed
└── archive_v1/                  📦 Old docs (reference)
```

---

## 🆘 Troubleshooting

### Can't find what you're looking for?

1. **Installation issues**: [QUICK_START.md](./QUICK_START.md) → Troubleshooting
2. **Foundry errors**: [FOUNDRY_GUIDE.md](./FOUNDRY_GUIDE.md) → Common Issues
3. **Contract issues**: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) → Smart Contracts
4. **Frontend issues**: [IMPLEMENTATION_PLAN_PART2.md](./IMPLEMENTATION_PLAN_PART2.md) → Section 10

### Still stuck?

- Check [Zama Discord](https://discord.gg/zama)
- Read [Foundry Book](https://book.getfoundry.sh/)
- Search [Zama Docs](https://docs.zama.ai/protocol)

---

## 📊 Documentation Stats

- **Total active docs**: 3,159 lines
- **Estimated read time**: 2-3 hours for all docs
- **Time to first deployment**: 30 minutes
- **Target network**: Sepolia testnet
- **Framework**: Foundry
- **Cost**: $0 (free testnet)

---

## 🎓 Recommended Reading Order

### Fast Track (2 hours)
1. README.md (5 min)
2. QUICK_START.md (30 min)
3. Build along with IMPLEMENTATION_PLAN.md (90 min)

### Complete Course (1 week)
- **Day 1**: README + QUICK_START
- **Day 2-3**: IMPLEMENTATION_PLAN (contracts)
- **Day 4-5**: IMPLEMENTATION_PLAN_PART2 (frontend)
- **Day 6**: FOUNDRY_GUIDE (testing & optimization)
- **Day 7**: ARCHITECTURAL_DECISIONS (deep understanding)

### Reference (as needed)
- Keep FOUNDRY_GUIDE.md open while coding
- Refer to ARCHITECTURAL_DECISIONS.md when making design choices

---

**Ready to start?** → [README.md](./README.md) 🚀
