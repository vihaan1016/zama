# Quick Start Guide - Testnet with Foundry (2026)

**Updated**: July 2026  
**Focus**: Sepolia testnet deployment with Foundry  
**Time to first deployment**: ~2 hours

---

## 🚀 Quick Start (30 Minutes)

### Prerequisites

- Node.js 20+
- Git
- Basic Solidity knowledge
- MetaMask or similar wallet

### Step 1: Install Foundry (5 min)

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash

# Update to latest
foundryup

# Verify
forge --version
cast --version
```

### Step 2: Clone FHEVM Template (5 min)

```bash
# Clone official Zama template
git clone https://github.com/zama-ai/fhevm-foundry-template.git fba-dex
cd fba-dex

# Install dependencies
forge install

# Build
forge build

# Run sample tests
forge test
```

### Step 3: Get Testnet ETH (10 min)

```bash
# Visit Sepolia faucet
open https://sepoliafaucet.com

# Get your address from MetaMask
# Request testnet ETH

# Verify you received it
cast balance YOUR_ADDRESS --rpc-url https://sepolia.infura.io/v3/YOUR_KEY
```

### Step 4: Deploy Sample Contract (10 min)

```bash
# Copy environment template
cp .env.example .env.sepolia

# Edit .env.sepolia
PRIVATE_KEY=0x...  # Your private key (testnet only!)
SEPOLIA_RPC_URL=https://sepolia.rpc.zama.ai
KEEPER_ADDRESS=0x...  # Can be same as your address for testing

# Deploy
forge script script/Deploy.s.sol \
  --rpc-url sepolia \
  --broadcast \
  -vvv

# Contract deployed! Note the address.
```

---

## 📁 Project Structure

```
fba-dex/
├── src/              # Smart contracts
│   └── core/
│       └── BatchAuctionDEX.sol
├── test/             # Tests
│   └── BatchAuctionDEX.t.sol
├── script/           # Deployment
│   └── Deploy.s.sol
├── foundry.toml      # Configuration
└── .env.sepolia      # Environment
```

---

## 🔑 Key Commands

### Development

```bash
# Build contracts
forge build

# Run tests
forge test

# Run with verbose output
forge test -vvv

# Run specific test
forge test --match-test testSubmitOrder

# Check gas usage
forge test --gas-report

# Coverage
forge coverage
```

### Deployment

```bash
# Simulate deployment
forge script script/Deploy.s.sol --rpc-url sepolia

# Deploy to Sepolia
forge script script/Deploy.s.sol \
  --rpc-url sepolia \
  --broadcast \
  --verify

# Verify contract manually
forge verify-contract \
  CONTRACT_ADDRESS \
  src/core/BatchAuctionDEX.sol:BatchAuctionDEX \
  --chain sepolia
```

### Contract Interaction

```bash
# Read current batch ID
cast call CONTRACT_ADDRESS \
  "currentBatchId()(uint256)" \
  --rpc-url sepolia

# Close batch (as keeper)
cast send CONTRACT_ADDRESS \
  "closeBatch()" \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY

# Get balance
cast balance YOUR_ADDRESS --rpc-url sepolia
```

---

## 🎯 Tech Stack at a Glance

| Component | Technology | Version |
|-----------|-----------|---------|
| **Smart Contracts** | Solidity | 0.8.26 |
| **Dev Framework** | Foundry | Latest |
| **FHE Library** | FHEVM | v0.11+ |
| **Frontend** | Next.js | 16.3 |
| **Web3 Hooks** | Wagmi | v3 |
| **FHE Client** | fhevmjs | 0.7.0 |
| **Network** | Sepolia | Testnet |

---

## 🏗️ Build Your First Feature

### 1. Edit the Contract

```solidity
// src/core/BatchAuctionDEX.sol

// Add a new function
function getMyOrders() external view returns (uint256[] memory) {
    return userOrders[msg.sender];
}
```

### 2. Write a Test

```solidity
// test/BatchAuctionDEX.t.sol

function testGetMyOrders() public {
    vm.startPrank(user1);
    
    uint256 orderId1 = _submitTestOrder(2500e18, 1e18, true);
    uint256 orderId2 = _submitTestOrder(2600e18, 2e18, true);
    
    uint256[] memory orders = auction.getMyOrders();
    
    assertEq(orders.length, 2);
    assertEq(orders[0], orderId1);
    assertEq(orders[1], orderId2);
    
    vm.stopPrank();
}
```

### 3. Test It

```bash
forge test --match-test testGetMyOrders -vvv
```

### 4. Deploy

```bash
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast
```

---

## 🔧 Frontend Setup

### Install Next.js App

```bash
# Create frontend
npx create-next-app@latest frontend --typescript --tailwind --app

cd frontend

# Install Web3 dependencies (2026 versions)
npm install wagmi@^3.0.0 viem@^2.22.0 \
  @tanstack/react-query@^5.59.0 \
  fhevmjs@^0.7.0 \
  connectkit@^1.8.0
```

### Configure Wagmi v3

```typescript
// lib/wagmi-config.ts
import { createConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http('https://sepolia.rpc.zama.ai')
  }
})
```

### Run Dev Server

```bash
npm run dev
# Open http://localhost:3000
```

---

## 🐛 Troubleshooting

### "Invalid proof" error

→ Check that contract address in FHE encryption matches deployed address

### "Out of gas" on deployment

→ Use `--gas-limit 10000000` flag

### "Only keeper" error

→ Verify KEEPER_ADDRESS matches the one in contract constructor

### Tests fail with "FHEVM not initialized"

→ Ensure test inherits from `FHEVMTest` and calls `super.setUp()`

### Frontend can't connect

→ Check RPC URL is correct: `https://sepolia.rpc.zama.ai`

---

## 📊 Monitoring Your Deployment

### Etherscan

```
https://sepolia.etherscan.io/address/YOUR_CONTRACT_ADDRESS
```

### Check Batch Status

```bash
# Get current batch ID
cast call $CONTRACT "currentBatchId()(uint256)" --rpc-url sepolia

# Get batch details
cast call $CONTRACT "batches(uint256)" 0 --rpc-url sepolia
```

### Watch Events

```bash
cast logs --address $CONTRACT --rpc-url sepolia
```

---

## 🎓 Next Steps

### Learn More

1. **Read Full Implementation Plan**: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
2. **Foundry Deep Dive**: [FOUNDRY_GUIDE.md](./FOUNDRY_GUIDE.md)
3. **Frontend Guide**: [IMPLEMENTATION_PLAN_PART2.md](./IMPLEMENTATION_PLAN_PART2.md)

### Enhance Your DEX

- [ ] Add order cancellation
- [ ] Implement clearing engine
- [ ] Build portfolio view
- [ ] Add batch statistics
- [ ] Deploy keeper bot
- [ ] Create admin dashboard

### Deploy to Production

⚠️ **Do NOT deploy to mainnet without**:
- Complete security audit
- Extensive testing
- Multi-sig admin controls
- Proper monitoring
- Incident response plan

---

## ✅ Quick Checklist

**Before Deploying**:
- [ ] Foundry installed and updated
- [ ] FHEVM template cloned
- [ ] Tests pass (`forge test`)
- [ ] Testnet ETH obtained
- [ ] `.env.sepolia` configured
- [ ] Deployment simulated successfully

**After Deploying**:
- [ ] Contract verified on Etherscan
- [ ] Frontend connected to contract
- [ ] Can submit test order
- [ ] Keeper can close batch
- [ ] Orders settle correctly

---

## 🆘 Get Help

### Official Resources
- [Zama FHEVM Docs](https://docs.zama.ai/protocol)
- [Foundry Book](https://book.getfoundry.sh/)
- [Wagmi v3 Docs](https://wagmi.sh/)

### Community
- [Zama Discord](https://discord.gg/zama)
- [Foundry Telegram](https://t.me/foundry_rs)

---

**Time Investment**:
- Setup: 30 minutes
- Basic contract: 2 hours
- Frontend: 3 hours
- Testing: 2 hours
- **Total**: ~8 hours to working testnet DEX

**Cost**:
- Development: $0 (all free tools)
- Testnet deployment: $0 (free testnet ETH)
- Vercel hosting: $0 (free tier)

**Start building now!** 🚀
