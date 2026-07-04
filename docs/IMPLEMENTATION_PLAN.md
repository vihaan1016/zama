# Sealed-Bid Batch Auction DEX - Testnet Implementation Plan (2026)

**Version**: 2.0 (Updated July 2026)  
**Focus**: Testnet deployment only with latest tech stack  
**Framework**: Foundry-based development

---

## 1. Technology Stack (2026)

### Blockchain & Smart Contracts

```toml
# foundry.toml dependencies
[profile.default]
solc = "0.8.26"
evm_version = "cancun"
ffi = true
optimizer = true
optimizer_runs = 200

[dependencies]
fhevm = "zama-ai/fhevm@v0.11"
forge-fhevm = "zama-ai/forge-fhevm@latest"
openzeppelin-confidential-contracts = "OpenZeppelin/openzeppelin-confidential-contracts@0.3.0"
forge-std = "foundry-rs/forge-std"
```

**Key Components**:
- **Solidity**: 0.8.26 (latest with Cancun fork support)
- **FHEVM**: v0.11+ (delegated decryption, improved performance)
- **Foundry**: Latest (blazing fast Rust-based toolkit)
- **forge-fhevm**: Official Zama plugin for Foundry
- **OpenZeppelin Confidential Contracts**: 0.3.0 (audited ERC-7984 implementation)

### Frontend

```json
{
  "dependencies": {
    "next": "^16.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "fhevmjs": "^0.7.0",
    "wagmi": "^3.0.0",
    "viem": "^2.22.0",
    "@tanstack/react-query": "^5.59.0",
    "connectkit": "^1.8.0",
    "@radix-ui/react-*": "latest",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0"
  }
}
```

**Key Updates**:
- **Next.js 16.3**: AI-native development, instant navigations, Turbopack caching
- **React 19**: useActionState (replaces useFormState), improved streaming
- **Wagmi v3**: Latest hooks, better TypeScript, viem 2.x integration
- **fhevmjs 0.7**: Delegated decryption support, better performance

### Backend Infrastructure

```json
{
  "dependencies": {
    "typescript": "^5.6.0",
    "ethers": "^6.13.0",
    "viem": "^2.22.0",
    "winston": "^3.14.0",
    "prom-client": "^15.1.0",
    "ioredis": "^5.4.0",
    "pg": "^8.12.0"
  }
}
```

### Target Network

**Sepolia Testnet with Zama FHEVM**:
- Chain ID: 11155111 (Sepolia)
- RPC: `https://sepolia.rpc.zama.ai`
- Explorer: `https://sepolia.etherscan.io`
- Faucet: `https://sepoliafaucet.com`

**Why Sepolia?**:
- Official Zama support on Sepolia
- Stable testnet (won't be deprecated like Goerli)
- Good infrastructure (explorers, faucets)
- Free testnet ETH available

---

## 2. Project Structure

```
fba-dex/
├── foundry.toml                    # Foundry configuration
├── remappings.txt                  # Import remappings
├── .env.sepolia                    # Testnet environment variables
│
├── src/                            # Smart contracts (Foundry convention)
│   ├── core/
│   │   ├── BatchAuctionDEX.sol
│   │   ├── ClearingEngine.sol
│   │   └── PriceGridRegistry.sol
│   ├── tokens/
│   │   └── ConfidentialERC7984.sol
│   ├── libraries/
│   │   ├── OrderLib.sol
│   │   └── TickMath.sol
│   └── interfaces/
│       └── IBatchAuction.sol
│
├── test/                           # Foundry tests
│   ├── unit/
│   │   ├── BatchAuctionDEX.t.sol
│   │   ├── ClearingEngine.t.sol
│   │   └── TickMath.t.sol
│   ├── integration/
│   │   └── BatchLifecycle.t.sol
│   └── invariant/
│       └── Invariants.t.sol
│
├── script/                         # Deployment scripts (Foundry)
│   ├── Deploy.s.sol
│   ├── Initialize.s.sol
│   └── utils/
│       └── HelperConfig.s.sol
│
├── keeper/                         # Off-chain keeper bot
│   ├── src/
│   │   ├── index.ts
│   │   ├── services/
│   │   └── config/
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                       # Next.js 16 application
│   ├── app/
│   │   ├── page.tsx
│   │   ├── trade/
│   │   └── portfolio/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── package.json
│
└── docs/
    ├── IMPLEMENTATION_PLAN_V2.md   # This file
    └── FOUNDRY_GUIDE.md            # Foundry-specific guide
```

---

## 3. Smart Contracts with Foundry

### 3.1 Setup Foundry Project

```bash
# Install Foundry (if not already installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Initialize project using FHEVM template
git clone https://github.com/zama-ai/fhevm-foundry-template.git fba-dex
cd fba-dex

# Install dependencies
forge install

# Install forge-fhevm plugin
forge install zama-ai/forge-fhevm

# Verify installation
forge build
```

### 3.2 BatchAuctionDEX Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "fhevm/lib/TFHE.sol";
import "fhevm/gateway/GatewayCaller.sol";
import {ZamaSepoliaConfig} from "fhevm/config/ZamaSepoliaConfig.sol";

/**
 * @title BatchAuctionDEX
 * @notice Sealed-bid batch auction DEX using FHE
 * @dev Testnet version - simplified for learning and demonstration
 */
contract BatchAuctionDEX is ZamaSepoliaConfig, GatewayCaller {
    
    // ============ Type Declarations ============
    
    enum OrderStatus { PENDING, FILLED, EXPIRED, CANCELLED }
    enum BatchStatus { OPEN, CLOSING, CLEARING, SETTLED }
    
    struct Order {
        uint256 id;
        address owner;
        uint256 batchId;
        
        // Encrypted order details
        euint64 encPrice;       // Price in quote/base with 18 decimals
        euint64 encSize;        // Size in base token
        ebool encIsBuy;         // Buy or sell
        euint64 encFilled;      // Amount filled (for Phase 2)
        
        uint64 timestamp;
        OrderStatus status;
        bool isActive;
    }
    
    struct Batch {
        uint256 id;
        uint256[] orderIds;
        BatchStatus status;
        
        // Clearing results
        uint16 clearingTick;
        euint64 clearingPrice;
        
        // Timing
        uint64 openedAt;
        uint64 closedAt;
        uint64 clearedAt;
        
        // Stats
        uint256 totalOrders;
        uint256 filledOrders;
    }
    
    // ============ State Variables ============
    
    mapping(uint256 => Order) public orders;
    mapping(uint256 => Batch) public batches;
    mapping(address => uint256[]) public userOrders;
    
    uint256 public currentBatchId;
    uint256 public nextOrderId;
    
    // Configuration
    uint256 public constant BATCH_DURATION = 300; // 5 minutes
    uint256 public constant MAX_ORDERS_PER_BATCH = 100; // Testnet limit
    uint256 public constant MIN_ORDER_SIZE = 1e16; // 0.01 ETH
    
    address public keeper;
    address public clearingEngine;
    
    // ============ Events ============
    
    event BatchOpened(uint256 indexed batchId, uint64 timestamp);
    event BatchClosed(uint256 indexed batchId, uint64 timestamp);
    event BatchCleared(uint256 indexed batchId, uint16 clearingTick);
    event OrderSubmitted(
        uint256 indexed orderId,
        address indexed user,
        uint256 indexed batchId
    );
    event OrderSettled(uint256 indexed orderId, OrderStatus status);
    
    // ============ Errors ============
    
    error BatchNotOpen();
    error BatchFull();
    error OnlyKeeper();
    error InvalidOrderSize();
    error InvalidPrice();
    
    // ============ Modifiers ============
    
    modifier onlyKeeper() {
        if (msg.sender != keeper) revert OnlyKeeper();
        _;
    }
    
    modifier batchOpen() {
        if (batches[currentBatchId].status != BatchStatus.OPEN) {
            revert BatchNotOpen();
        }
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _clearingEngine, address _keeper) 
        ZamaSepoliaConfig() 
    {
        clearingEngine = _clearingEngine;
        keeper = _keeper;
        
        // Open first batch
        _openNewBatch();
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Submit encrypted order to current batch
     * @param encryptedPrice Encrypted price
     * @param encryptedSize Encrypted size
     * @param encryptedIsBuy Encrypted side
     * @param inputProof ZK proof of valid encryption
     */
    function submitOrder(
        einput encryptedPrice,
        einput encryptedSize,
        einput encryptedIsBuy,
        bytes calldata inputProof
    ) external batchOpen returns (uint256 orderId) {
        Batch storage batch = batches[currentBatchId];
        
        if (batch.orderIds.length >= MAX_ORDERS_PER_BATCH) {
            revert BatchFull();
        }
        
        // Convert encrypted inputs with proof verification
        euint64 price = TFHE.asEuint64(encryptedPrice, inputProof);
        euint64 size = TFHE.asEuint64(encryptedSize, inputProof);
        ebool isBuy = TFHE.asEbool(encryptedIsBuy, inputProof);
        
        // Validate size (decrypt for this check - acceptable tradeoff)
        uint64 plainSize = TFHE.decrypt(size);
        if (plainSize < MIN_ORDER_SIZE) {
            revert InvalidOrderSize();
        }
        
        // Create order
        orderId = nextOrderId++;
        Order storage order = orders[orderId];
        order.id = orderId;
        order.owner = msg.sender;
        order.batchId = currentBatchId;
        order.encPrice = price;
        order.encSize = size;
        order.encIsBuy = isBuy;
        order.encFilled = TFHE.asEuint64(0);
        order.timestamp = uint64(block.timestamp);
        order.status = OrderStatus.PENDING;
        order.isActive = true;
        
        // Set ACL permissions
        TFHE.allow(price, msg.sender);
        TFHE.allow(size, msg.sender);
        TFHE.allow(isBuy, msg.sender);
        TFHE.allow(price, clearingEngine);
        TFHE.allow(size, clearingEngine);
        TFHE.allow(isBuy, clearingEngine);
        TFHE.allow(price, address(this));
        TFHE.allow(size, address(this));
        TFHE.allow(isBuy, address(this));
        
        // Add to batch and user tracking
        batch.orderIds.push(orderId);
        batch.totalOrders++;
        userOrders[msg.sender].push(orderId);
        
        emit OrderSubmitted(orderId, msg.sender, currentBatchId);
        
        return orderId;
    }
    
    /**
     * @notice Close current batch and open new one
     * @dev Called by keeper when batch duration elapsed or batch full
     */
    function closeBatch() external onlyKeeper {
        Batch storage batch = batches[currentBatchId];
        
        require(
            batch.status == BatchStatus.OPEN,
            "Batch not open"
        );
        
        require(
            block.timestamp >= batch.openedAt + BATCH_DURATION ||
            batch.orderIds.length >= MAX_ORDERS_PER_BATCH,
            "Batch not ready to close"
        );
        
        batch.status = BatchStatus.CLOSING;
        batch.closedAt = uint64(block.timestamp);
        
        emit BatchClosed(currentBatchId, batch.closedAt);
        
        // Open next batch
        _openNewBatch();
        
        // Transition to clearing
        batch.status = BatchStatus.CLEARING;
    }
    
    /**
     * @notice Get order IDs in a batch
     */
    function getBatchOrderIds(uint256 batchId) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return batches[batchId].orderIds;
    }
    
    /**
     * @notice Get encrypted order data (for clearing engine)
     */
    function getOrderEncryptedData(uint256 orderId)
        external
        view
        returns (
            euint64 encPrice,
            euint64 encSize,
            ebool encIsBuy
        )
    {
        Order storage order = orders[orderId];
        return (order.encPrice, order.encSize, order.encIsBuy);
    }
    
    // ============ Internal Functions ============
    
    function _openNewBatch() internal {
        currentBatchId++;
        Batch storage newBatch = batches[currentBatchId];
        newBatch.id = currentBatchId;
        newBatch.status = BatchStatus.OPEN;
        newBatch.openedAt = uint64(block.timestamp);
        
        emit BatchOpened(currentBatchId, newBatch.openedAt);
    }
}
```

### 3.3 Foundry Test Example

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "forge-fhevm/FHEVMTest.sol";
import "../src/core/BatchAuctionDEX.sol";

/**
 * @title BatchAuctionDEXTest
 * @notice Foundry tests for BatchAuctionDEX
 */
contract BatchAuctionDEXTest is FHEVMTest {
    BatchAuctionDEX public auction;
    
    address public owner;
    address public user1;
    address public user2;
    address public keeper;
    
    function setUp() public override {
        super.setUp(); // Initialize FHEVM test environment
        
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        keeper = makeAddr("keeper");
        
        // Deploy mock clearing engine
        address mockClearingEngine = address(0x123);
        
        // Deploy BatchAuctionDEX
        auction = new BatchAuctionDEX(mockClearingEngine, keeper);
        
        // Fund test users
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
    }
    
    function testSubmitBuyOrder() public {
        vm.startPrank(user1);
        
        // Encrypt order data
        uint64 price = 2500e18; // $2500
        uint64 size = 1e18; // 1 ETH
        bool isBuy = true;
        
        (einput encPrice, bytes memory proofPrice) = encryptU64(price);
        (einput encSize, bytes memory proofSize) = encryptU64(size);
        (einput encIsBuy, bytes memory proofIsBuy) = encryptBool(isBuy);
        
        // Combine proofs
        bytes memory proof = abi.encodePacked(proofPrice, proofSize, proofIsBuy);
        
        // Submit order
        uint256 orderId = auction.submitOrder(
            encPrice,
            encSize,
            encIsBuy,
            proof
        );
        
        // Verify order was created
        assertEq(orderId, 0);
        
        (
            uint256 id,
            address orderOwner,
            ,,,,,,,
        ) = auction.orders(orderId);
        
        assertEq(id, 0);
        assertEq(orderOwner, user1);
        
        vm.stopPrank();
    }
    
    function testBatchClosing() public {
        // Submit some orders
        _submitTestOrder(user1, 2500e18, 1e18, true);
        _submitTestOrder(user2, 2400e18, 2e18, false);
        
        uint256 batchId = auction.currentBatchId();
        
        // Fast forward time
        vm.warp(block.timestamp + 301); // Past batch duration
        
        // Close batch as keeper
        vm.prank(keeper);
        auction.closeBatch();
        
        // Verify new batch opened
        assertEq(auction.currentBatchId(), batchId + 1);
    }
    
    function testBatchFullClosing() public {
        // Fill batch to max capacity
        for (uint i = 0; i < 100; i++) {
            _submitTestOrder(user1, 2500e18, 1e18, true);
        }
        
        // Batch should be closeable even before time elapsed
        vm.prank(keeper);
        auction.closeBatch();
        
        assertEq(auction.currentBatchId(), 1);
    }
    
    function testRevertWhenBatchFull() public {
        // Fill batch
        for (uint i = 0; i < 100; i++) {
            _submitTestOrder(user1, 2500e18, 1e18, true);
        }
        
        // Try to submit one more
        vm.expectRevert(BatchAuctionDEX.BatchFull.selector);
        _submitTestOrder(user2, 2500e18, 1e18, false);
    }
    
    // ============ Helper Functions ============
    
    function _submitTestOrder(
        address user,
        uint64 price,
        uint64 size,
        bool isBuy
    ) internal returns (uint256) {
        vm.startPrank(user);
        
        (einput encPrice, bytes memory proofPrice) = encryptU64(price);
        (einput encSize, bytes memory proofSize) = encryptU64(size);
        (einput encIsBuy, bytes memory proofIsBuy) = encryptBool(isBuy);
        
        bytes memory proof = abi.encodePacked(proofPrice, proofSize, proofIsBuy);
        
        uint256 orderId = auction.submitOrder(
            encPrice,
            encSize,
            encIsBuy,
            proof
        );
        
        vm.stopPrank();
        return orderId;
    }
}
```

---

## 4. Foundry Workflow

### 4.1 Common Commands

```bash
# Build contracts
forge build

# Run all tests
forge test

# Run specific test
forge test --match-test testSubmitBuyOrder -vvv

# Run tests with gas reporting
forge test --gas-report

# Run invariant/fuzz tests
forge test --match-contract Invariants

# Get test coverage
forge coverage

# Deploy to Sepolia
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --verify

# Verify contract on Etherscan
forge verify-contract <ADDRESS> src/core/BatchAuctionDEX.sol:BatchAuctionDEX \
  --chain sepolia \
  --etherscan-api-key <KEY>

# Interactive debugging
forge test --debug testSubmitBuyOrder

# Generate gas snapshots
forge snapshot
```

### 4.2 Environment Setup

```bash
# .env.sepolia
SEPOLIA_RPC_URL=https://sepolia.rpc.zama.ai
PRIVATE_KEY=0x... # NEVER commit this!
ETHERSCAN_API_KEY=...

# For keeper
KEEPER_PRIVATE_KEY=0x...
BATCH_AUCTION_ADDRESS=0x...
```

### 4.3 Deployment Script

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/core/BatchAuctionDEX.sol";
import "../src/core/ClearingEngine.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address keeper = vm.envAddress("KEEPER_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy ClearingEngine
        ClearingEngine clearingEngine = new ClearingEngine();
        console.log("ClearingEngine deployed to:", address(clearingEngine));
        
        // Deploy BatchAuctionDEX
        BatchAuctionDEX auction = new BatchAuctionDEX(
            address(clearingEngine),
            keeper
        );
        console.log("BatchAuctionDEX deployed to:", address(auction));
        
        // Link contracts
        clearingEngine.setBatchAuction(address(auction));
        
        vm.stopBroadcast();
        
        // Save deployment addresses
        string memory output = string(abi.encodePacked(
            "BATCH_AUCTION_ADDRESS=", vm.toString(address(auction)), "\n",
            "CLEARING_ENGINE_ADDRESS=", vm.toString(address(clearingEngine))
        ));
        
        vm.writeFile(".env.deployed", output);
    }
}
```

---

## 5. Key Differences: Testnet vs Production

| Aspect | Testnet (This Plan) | Production |
|--------|---------------------|------------|
| **Gas Costs** | Free (faucet) | Real ETH |
| **Batch Size** | 100 orders max | 500+ orders |
| **Security** | Basic testing | Full audit required |
| **Monitoring** | Optional | Critical |
| **Uptime** | Best effort | 99.9%+ required |
| **User Support** | Minimal | Full support needed |
| **Keeper Redundancy** | Single keeper OK | Multi-keeper required |
| **Data Persistence** | Can reset | Must persist forever |

### Testnet Simplifications

1. **No token wrapping**: Use test tokens directly
2. **Simpler ACLs**: Basic permissions only
3. **No partial fills**: All-or-nothing only
4. **Manual batch closing**: No automated keeper required
5. **Limited monitoring**: Basic logs sufficient
6. **No upgrade path**: Can redeploy if needed

---

_Continue to Part 2 for frontend implementation, keeper bot, and deployment guide..._
