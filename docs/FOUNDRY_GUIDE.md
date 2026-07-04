# Foundry Development Guide for FBA DEX

This guide covers Foundry-specific development patterns, testing strategies, and best practices for building the FBA DEX.

---

## Quick Start with Foundry

### Installation

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Verify installation
forge --version
cast --version
anvil --version
```

### Initialize from FHEVM Template

```bash
# Clone the official Zama FHEVM Foundry template
git clone https://github.com/zama-ai/fhevm-foundry-template.git fba-dex
cd fba-dex

# Install dependencies
forge install

# Build
forge build

# Run tests
forge test
```

---

## Project Structure (Foundry Convention)

```
fba-dex/
├── foundry.toml              # Foundry configuration
├── remappings.txt            # Import remappings
├── .env.sepolia              # Environment variables
│
├── src/                      # Contracts (not "contracts/")
│   ├── core/
│   ├── tokens/
│   ├── libraries/
│   └── interfaces/
│
├── test/                     # Tests
│   ├── unit/                 # Unit tests (.t.sol)
│   ├── integration/          # Integration tests
│   └── invariant/            # Invariant/fuzz tests
│
├── script/                   # Deployment scripts (.s.sol)
│   └── Deploy.s.sol
│
├── lib/                      # Dependencies (managed by forge)
│   ├── fhevm/
│   ├── forge-std/
│   └── openzeppelin-contracts/
│
└── out/                      # Build artifacts (auto-generated)
```

---

## Foundry Configuration

### foundry.toml

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.26"
evm_version = "cancun"

# Optimizer
optimizer = true
optimizer_runs = 200

# Testing
fuzz_runs = 256
fuzz_max_test_rejects = 65536

# Verbosity
verbosity = 2

# Gas reporting
gas_reports = ["*"]

# FFI (for FHEVM operations)
ffi = true

# Remappings
remappings = [
    "fhevm/=lib/fhevm/",
    "forge-std/=lib/forge-std/src/",
    "@openzeppelin/=lib/openzeppelin-contracts/",
]

[profile.ci]
fuzz_runs = 10000
verbosity = 4

[profile.local]
fuzz_runs = 50

[rpc_endpoints]
sepolia = "${SEPOLIA_RPC_URL}"
mainnet = "${MAINNET_RPC_URL}"

[etherscan]
sepolia = { key = "${ETHERSCAN_API_KEY}" }
```

### remappings.txt

```
fhevm/=lib/fhevm/
forge-std/=lib/forge-std/src/
@openzeppelin/=lib/openzeppelin-contracts/
```

---

## Testing with Foundry

### Test File Structure

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "forge-fhevm/FHEVMTest.sol";
import "../src/core/BatchAuctionDEX.sol";

contract BatchAuctionDEXTest is FHEVMTest {
    // Contract instances
    BatchAuctionDEX public auction;
    
    // Test users
    address public owner;
    address public user1;
    address public user2;
    
    // Setup runs before each test
    function setUp() public override {
        super.setUp(); // Initialize FHEVM
        
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
        // Deploy contracts
        auction = new BatchAuctionDEX(address(0), owner);
        
        // Fund users
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
    }
    
    // Test functions must start with "test"
    function testSubmitOrder() public {
        // Test implementation
    }
    
    // Tests expecting reverts
    function testRevertWhenBatchFull() public {
        vm.expectRevert(BatchAuctionDEX.BatchFull.selector);
        // Call that should revert
    }
    
    // Fuzz tests (random inputs)
    function testFuzz_SubmitOrder(uint64 price, uint64 size) public {
        vm.assume(price > 0 && size > 0);
        // Test with random inputs
    }
}
```

### Foundry Cheatcodes

```solidity
// Time manipulation
vm.warp(block.timestamp + 300); // Fast forward 5 minutes
vm.roll(block.number + 100);    // Fast forward blocks

// Pranks (change msg.sender)
vm.prank(user1);                // Next call from user1
auction.submitOrder(...);

vm.startPrank(user1);           // All calls from user1
auction.submitOrder(...);
auction.anotherCall(...);
vm.stopPrank();

// Expectations
vm.expectRevert();              // Expect next call reverts
vm.expectEmit(true, true, false, true);
emit OrderSubmitted(orderId, user, batchId);

// Deal (set balances)
vm.deal(user1, 100 ether);      // Give ETH
deal(address(token), user1, 1000e18); // Give tokens

// Labels (for trace output)
vm.label(address(auction), "BatchAuction");
vm.label(user1, "Alice");
vm.label(user2, "Bob");

// Mock calls
vm.mockCall(
    address(oracle),
    abi.encodeWithSelector(Oracle.getPrice.selector),
    abi.encode(2500e18)
);
```

### Running Tests

```bash
# Run all tests
forge test

# Run with verbosity (-vvvv shows traces)
forge test -vvvv

# Run specific test
forge test --match-test testSubmitOrder

# Run tests in specific file
forge test --match-path test/unit/BatchAuctionDEX.t.sol

# Run with gas reporting
forge test --gas-report

# Generate coverage
forge coverage

# Detailed coverage (lcov format)
forge coverage --report lcov
genhtml lcov.info -o coverage/

# Run only failing tests
forge test --fail-fast

# Run tests matching pattern
forge test --match-contract Auction
```

### Snapshot Testing (Gas Optimization)

```bash
# Create gas snapshot
forge snapshot

# Compare with previous snapshot
forge snapshot --diff

# Check specific function gas
forge snapshot --match-test testSubmitOrder
```

---

## Deployment with Foundry

### Deployment Script

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/core/BatchAuctionDEX.sol";
import "../src/core/ClearingEngine.sol";

contract DeployScript is Script {
    function run() external {
        // Read private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address keeper = vm.envAddress("KEEPER_ADDRESS");
        
        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy ClearingEngine
        ClearingEngine clearingEngine = new ClearingEngine();
        console.log("ClearingEngine:", address(clearingEngine));
        
        // Deploy BatchAuctionDEX
        BatchAuctionDEX auction = new BatchAuctionDEX(
            address(clearingEngine),
            keeper
        );
        console.log("BatchAuctionDEX:", address(auction));
        
        // Initialize
        clearingEngine.setBatchAuction(address(auction));
        
        vm.stopBroadcast();
        
        // Save addresses to file
        string memory deployments = string(abi.encodePacked(
            "BATCH_AUCTION_ADDRESS=", vm.toString(address(auction)), "\n",
            "CLEARING_ENGINE_ADDRESS=", vm.toString(address(clearingEngine)), "\n"
        ));
        
        vm.writeFile(".env.deployed", deployments);
        
        console.log("\nDeployment complete!");
    }
}
```

### Deploy to Sepolia

```bash
# Load environment
source .env.sepolia

# Dry run (simulation)
forge script script/Deploy.s.sol \
  --rpc-url sepolia \
  -vvvv

# Deploy for real
forge script script/Deploy.s.sol \
  --rpc-url sepolia \
  --broadcast \
  --verify \
  -vvvv

# Verify on Etherscan
forge verify-contract \
  0xYourContractAddress \
  src/core/BatchAuctionDEX.sol:BatchAuctionDEX \
  --chain sepolia \
  --watch
```

---

## Debugging with Foundry

### Interactive Debugging

```bash
# Run test in debug mode
forge test --debug testSubmitOrder

# Opens TUI debugger:
# - Step through opcodes
# - Inspect stack/memory
# - View source code
# - Set breakpoints
```

### Trace Analysis

```bash
# Generate detailed trace
forge test --match-test testSubmitOrder -vvvvv > trace.log

# Use Cast to decode
cast 4byte 0x12345678  # Decode function selector
cast 4byte-event 0x...  # Decode event topic
```

### Gas Profiling

```bash
# Profile gas usage
forge test --gas-report

# Example output:
# | Function      | avg gas | median | max   |
# |---------------|---------|--------|-------|
# | submitOrder   | 150000  | 150000 | 160000|
# | closeBatch    | 80000   | 80000  | 85000 |
```

---

## Cast Commands (Foundry's CLI Tool)

### Reading Contract Data

```bash
# Call view function
cast call $CONTRACT_ADDRESS \
  "currentBatchId()(uint256)" \
  --rpc-url sepolia

# Read storage slot
cast storage $CONTRACT_ADDRESS 0 --rpc-url sepolia

# Get balance
cast balance $ADDRESS --rpc-url sepolia

# Get nonce
cast nonce $ADDRESS --rpc-url sepolia
```

### Sending Transactions

```bash
# Send transaction
cast send $CONTRACT_ADDRESS \
  "closeBatch()" \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY

# Send with specific gas
cast send $CONTRACT_ADDRESS \
  "submitOrder(bytes32,bytes32,bytes32,bytes)" \
  $ARG1 $ARG2 $ARG3 $ARG4 \
  --gas-limit 500000 \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY
```

### Utilities

```bash
# Convert units
cast to-wei 1 ether        # -> 1000000000000000000
cast from-wei 1000000000000000000  # -> 1

# Compute address
cast compute-address --nonce 0 $DEPLOYER_ADDRESS

# Get transaction receipt
cast receipt $TX_HASH --rpc-url sepolia

# Decode transaction data
cast 4byte-decode 0x12345678...

# Generate ABI
cast interface $CONTRACT_ADDRESS --rpc-url sepolia
```

---

## Anvil (Local Testnet)

```bash
# Start local node
anvil

# Fork Sepolia
anvil --fork-url $SEPOLIA_RPC_URL

# Fork at specific block
anvil --fork-url $SEPOLIA_RPC_URL --fork-block-number 12345678

# Use with tests
forge test --fork-url http://localhost:8545
```

---

## Best Practices

### 1. Use Forge-Std Helpers

```solidity
import "forge-std/Test.sol";

contract MyTest is Test {
    // Use makeAddr for cleaner addresses
    address alice = makeAddr("alice");
    
    // Use bound for fuzz input ranges
    function testFuzz_Amount(uint256 amount) public {
        amount = bound(amount, 1, 1000 ether);
        // Test with bounded amount
    }
    
    // Use hoax for pranking with balance
    hoax(alice, 100 ether);
    contract.call{value: 1 ether}();
}
```

### 2. Organize Tests

```
test/
├── unit/              # Isolated function tests
│   ├── BatchAuctionDEX.t.sol
│   └── ClearingEngine.t.sol
├── integration/       # Multi-contract tests
│   └── FullFlow.t.sol
├── invariant/         # Property-based tests
│   └── Invariants.t.sol
└── fork/              # Mainnet fork tests
    └── MainnetIntegration.t.sol
```

### 3. Use Custom Errors

```solidity
// More gas efficient than require strings
error BatchNotOpen();
error OnlyKeeper();

function closeBatch() external {
    if (msg.sender != keeper) revert OnlyKeeper();
    // ...
}
```

### 4. Gas Optimization

```bash
# Use optimizer
forge build --optimize --optimizer-runs 200

# Check gas before/after changes
forge snapshot
# Make changes
forge snapshot --diff
```

### 5. CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: recursive
      
      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1
      
      - name: Run tests
        run: forge test -vvv
      
      - name: Check gas
        run: forge snapshot --check
```

---

## Common Issues & Solutions

### Issue: "Failed to resolve imports"

```bash
# Fix remappings
forge remappings > remappings.txt

# Or install missing dependency
forge install OpenZeppelin/openzeppelin-contracts
```

### Issue: "out of gas" in tests

```solidity
// Increase gas limit in foundry.toml
[profile.default]
gas_limit = 18446744073709551615  # Unlimited for tests
```

### Issue: FHEVM operations fail

```bash
# Make sure FFI is enabled
[profile.default]
ffi = true

# And forge-fhevm is installed
forge install zama-ai/forge-fhevm
```

---

## Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [Foundry GitHub](https://github.com/foundry-rs/foundry)
- [Zama FHEVM Foundry Template](https://github.com/zama-ai/fhevm-foundry-template)
- [Awesome Foundry](https://github.com/crisgarner/awesome-foundry)

---

**Next**: See IMPLEMENTATION_PLAN.md for the full project specification.
