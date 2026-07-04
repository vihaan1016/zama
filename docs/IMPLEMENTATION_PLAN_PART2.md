# Implementation Plan Part 2: Frontend & Infrastructure

## 6. Frontend with Next.js 16.3 & Wagmi v3

### 6.1 Setup Next.js 16.3 Project

```bash
# Create Next.js app with latest version
npx create-next-app@latest fba-dex-frontend \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"

cd fba-dex-frontend

# Install Web3 dependencies (2026 versions)
npm install wagmi@^3.0.0 viem@^2.22.0 \
  @tanstack/react-query@^5.59.0 \
  connectkit@^1.8.0 \
  fhevmjs@^0.7.0

# Install UI components
npm install @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-tabs \
  class-variance-authority \
  clsx tailwind-merge

# Install dev dependencies
npm install -D @types/node @types/react
```

### 6.2 Wagmi v3 Configuration

```typescript
// lib/wagmi-config.ts
import { createConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors'

// Custom Sepolia with Zama RPC
const sepoliaWithZama = {
  ...sepolia,
  rpcUrls: {
    default: {
      http: ['https://sepolia.rpc.zama.ai']
    },
    public: {
      http: ['https://sepolia.rpc.zama.ai']
    }
  }
}

export const config = createConfig({
  chains: [sepoliaWithZama],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!
    }),
    coinbaseWallet({
      appName: 'FBA DEX'
    })
  ],
  transports: {
    [sepolia.id]: http('https://sepolia.rpc.zama.ai')
  }
})
```

### 6.3 FHE Client Hook (Updated for fhevmjs 0.7)

```typescript
// hooks/useFHE.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createFhevmInstance, type FhevmInstance } from 'fhevmjs'
import { usePublicClient } from 'wagmi'

export function useFHE() {
  const [fhevmInstance, setFhevmInstance] = useState<FhevmInstance | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const publicClient = usePublicClient()
  
  useEffect(() => {
    initializeFHE()
  }, [publicClient])
  
  const initializeFHE = async () => {
    if (!publicClient) return
    
    try {
      setIsInitializing(true)
      
      // Create FHE instance for Sepolia
      const instance = await createFhevmInstance({
        chainId: 11155111, // Sepolia
        publicKey: process.env.NEXT_PUBLIC_FHE_PUBLIC_KEY!,
        gatewayUrl: 'https://gateway.sepolia.zama.ai',
        aclAddress: process.env.NEXT_PUBLIC_ACL_ADDRESS!
      })
      
      setFhevmInstance(instance)
      setIsInitializing(false)
    } catch (err) {
      console.error('Failed to initialize FHE:', err)
      setError('Failed to initialize encryption system')
      setIsInitializing(false)
    }
  }
  
  const encryptOrder = useCallback(async (
    price: bigint,
    size: bigint,
    isBuy: boolean,
    userAddress: string
  ) => {
    if (!fhevmInstance) {
      throw new Error('FHE not initialized')
    }
    
    try {
      // Create encrypted inputs
      const encryptedPrice = await fhevmInstance.createEncryptedInput(
        process.env.NEXT_PUBLIC_BATCH_AUCTION_ADDRESS!,
        userAddress
      )
      
      encryptedPrice.add64(price)
      const { handles: priceHandle, inputProof: priceProof } = 
        await encryptedPrice.encrypt()
      
      const encryptedSize = await fhevmInstance.createEncryptedInput(
        process.env.NEXT_PUBLIC_BATCH_AUCTION_ADDRESS!,
        userAddress
      )
      
      encryptedSize.add64(size)
      const { handles: sizeHandle, inputProof: sizeProof } = 
        await encryptedSize.encrypt()
      
      const encryptedIsBuy = await fhevmInstance.createEncryptedInput(
        process.env.NEXT_PUBLIC_BATCH_AUCTION_ADDRESS!,
        userAddress
      )
      
      encryptedIsBuy.addBool(isBuy)
      const { handles: isBuyHandle, inputProof: isBuyProof } = 
        await encryptedIsBuy.encrypt()
      
      return {
        handles: {
          price: priceHandle[0],
          size: sizeHandle[0],
          isBuy: isBuyHandle[0]
        },
        inputProof: priceProof + sizeProof.slice(2) + isBuyProof.slice(2)
      }
    } catch (err) {
      console.error('Encryption failed:', err)
      throw new Error('Failed to encrypt order')
    }
  }, [fhevmInstance])
  
  const requestDecryption = useCallback(async (
    handle: string,
    contractAddress: string
  ) => {
    if (!fhevmInstance) {
      throw new Error('FHE not initialized')
    }
    
    try {
      // Request re-encryption from gateway (delegated decryption in v0.7+)
      const decrypted = await fhevmInstance.requestDecryption({
        handle,
        contractAddress,
        userAddress: '...' // From wallet
      })
      
      return decrypted
    } catch (err) {
      console.error('Decryption failed:', err)
      throw new Error('Failed to decrypt data')
    }
  }, [fhevmInstance])
  
  return {
    fhevmInstance,
    isInitializing,
    error,
    encryptOrder,
    requestDecryption
  }
}
```

### 6.4 Order Form Component (React 19 + Wagmi v3)

```typescript
// app/trade/components/OrderForm.tsx
'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, parseUnits } from 'viem'
import { useFHE } from '@/hooks/useFHE'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

const BATCH_AUCTION_ABI = [
  {
    name: 'submitOrder',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'encryptedPrice', type: 'bytes32' },
      { name: 'encryptedSize', type: 'bytes32' },
      { name: 'encryptedIsBuy', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' }
    ],
    outputs: [{ name: 'orderId', type: 'uint256' }]
  }
] as const

export function OrderForm() {
  const { address } = useAccount()
  const { encryptOrder, isInitializing } = useFHE()
  const { toast } = useToast()
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [price, setPrice] = useState('')
  const [size, setSize] = useState('')
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!address || isInitializing) {
      toast({
        title: 'Wallet not ready',
        description: 'Please connect wallet and wait for encryption to initialize',
        variant: 'destructive'
      })
      return
    }
    
    if (!price || !size) {
      toast({
        title: 'Missing information',
        description: 'Please enter both price and size',
        variant: 'destructive'
      })
      return
    }
    
    try {
      // Convert to wei/base units
      const priceInWei = parseUnits(price, 18)
      const sizeInWei = parseEther(size)
      const isBuy = side === 'buy'
      
      toast({
        title: 'Encrypting order...',
        description: 'This may take a few seconds'
      })
      
      // Encrypt the order
      const { handles, inputProof } = await encryptOrder(
        priceInWei,
        sizeInWei,
        isBuy,
        address
      )
      
      toast({
        title: 'Submitting transaction...',
        description: 'Please confirm in your wallet'
      })
      
      // Submit to contract
      writeContract({
        address: process.env.NEXT_PUBLIC_BATCH_AUCTION_ADDRESS as `0x${string}`,
        abi: BATCH_AUCTION_ABI,
        functionName: 'submitOrder',
        args: [handles.price, handles.size, handles.isBuy, inputProof]
      })
    } catch (err: any) {
      console.error('Failed to submit order:', err)
      toast({
        title: 'Order submission failed',
        description: err.message || 'Please try again',
        variant: 'destructive'
      })
    }
  }
  
  if (isSuccess) {
    toast({
      title: 'Order submitted! 🎉',
      description: `Transaction hash: ${hash?.slice(0, 10)}...`
    })
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 border rounded-lg">
      <h2 className="text-2xl font-bold">Place Encrypted Order</h2>
      
      <div className="flex gap-4">
        <Button
          type="button"
          variant={side === 'buy' ? 'default' : 'outline'}
          onClick={() => setSide('buy')}
          className="flex-1"
        >
          Buy
        </Button>
        <Button
          type="button"
          variant={side === 'sell' ? 'default' : 'outline'}
          onClick={() => setSide('sell')}
          className="flex-1"
        >
          Sell
        </Button>
      </div>
      
      <div>
        <Label htmlFor="price">Price (USDC per ETH)</Label>
        <Input
          id="price"
          type="number"
          step="0.01"
          placeholder="2500.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          disabled={isPending || isConfirming}
        />
      </div>
      
      <div>
        <Label htmlFor="size">Size (ETH)</Label>
        <Input
          id="size"
          type="number"
          step="0.001"
          placeholder="1.5"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          disabled={isPending || isConfirming}
        />
      </div>
      
      <Button
        type="submit"
        disabled={isInitializing || isPending || isConfirming}
        className="w-full"
      >
        {isInitializing && 'Initializing encryption...'}
        {!isInitializing && isPending && 'Encrypting and signing...'}
        {!isInitializing && isConfirming && 'Confirming on-chain...'}
        {!isInitializing && !isPending && !isConfirming && 'Submit Encrypted Order'}
      </Button>
      
      <p className="text-sm text-muted-foreground">
        🔒 Your order is encrypted client-side before submission. No one can see your price or size.
      </p>
    </form>
  )
}
```

### 6.5 Main App Layout (Next.js 16.3)

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'FBA DEX - Sealed Bid Auction',
  description: 'Privacy-preserving DEX using FHE',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

// app/providers.tsx
'use client'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectKitProvider } from 'connectkit'
import { config } from '@/lib/wagmi-config'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>{children}</ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

---

## 7. Keeper Bot (Simplified for Testnet)

### 7.1 Minimal Keeper Setup

```typescript
// keeper/src/index.ts
import { createWalletClient, createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

const BATCH_AUCTION_ADDRESS = process.env.BATCH_AUCTION_ADDRESS as `0x${string}`
const KEEPER_PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY as `0x${string}`

// Create clients
const account = privateKeyToAccount(KEEPER_PRIVATE_KEY)

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://sepolia.rpc.zama.ai')
})

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http('https://sepolia.rpc.zama.ai')
})

// ABI
const BATCH_AUCTION_ABI = [
  {
    name: 'currentBatchId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'batches',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'orderIds', type: 'uint256[]' },
      { name: 'status', type: 'uint8' },
      { name: 'openedAt', type: 'uint64' }
    ]
  },
  {
    name: 'closeBatch',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  {
    name: 'BATCH_DURATION',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  }
] as const

async function shouldCloseBatch(): Promise<boolean> {
  try {
    const currentBatchId = await publicClient.readContract({
      address: BATCH_AUCTION_ADDRESS,
      abi: BATCH_AUCTION_ABI,
      functionName: 'currentBatchId'
    })
    
    const batch = await publicClient.readContract({
      address: BATCH_AUCTION_ADDRESS,
      abi: BATCH_AUCTION_ABI,
      functionName: 'batches',
      args: [currentBatchId]
    })
    
    const batchDuration = await publicClient.readContract({
      address: BATCH_AUCTION_ADDRESS,
      abi: BATCH_AUCTION_ABI,
      functionName: 'BATCH_DURATION'
    })
    
    const now = Math.floor(Date.now() / 1000)
    const batchAge = now - Number(batch[3]) // openedAt
    
    // Close if time elapsed and batch is open (status = 0)
    return batch[2] === 0 && batchAge >= Number(batchDuration)
  } catch (err) {
    console.error('Error checking batch:', err)
    return false
  }
}

async function closeBatch() {
  try {
    console.log('Closing batch...')
    
    const { request } = await publicClient.simulateContract({
      address: BATCH_AUCTION_ADDRESS,
      abi: BATCH_AUCTION_ABI,
      functionName: 'closeBatch',
      account
    })
    
    const hash = await walletClient.writeContract(request)
    console.log('Close batch tx sent:', hash)
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log('Batch closed in block:', receipt.blockNumber)
  } catch (err) {
    console.error('Failed to close batch:', err)
  }
}

async function main() {
  console.log('Keeper bot started')
  console.log('Keeper address:', account.address)
  console.log('Monitoring:', BATCH_AUCTION_ADDRESS)
  
  // Check every 30 seconds
  setInterval(async () => {
    console.log('Checking if batch should close...')
    
    const should = await shouldCloseBatch()
    
    if (should) {
      await closeBatch()
    }
  }, 30_000)
}

main().catch(console.error)
```

### 7.2 Run Keeper

```bash
# keeper/.env
BATCH_AUCTION_ADDRESS=0x...
KEEPER_PRIVATE_KEY=0x...

# Run keeper
cd keeper
npm install
npm run dev
```

---

## 8. Deployment to Sepolia

### 8.1 Get Testnet ETH

```bash
# Get Sepolia ETH from faucets
# Option 1: https://sepoliafaucet.com
# Option 2: https://www.alchemy.com/faucets/ethereum-sepolia
# Option 3: https://faucet.quicknode.com/ethereum/sepolia

# Check balance
cast balance <YOUR_ADDRESS> --rpc-url https://sepolia.rpc.zama.ai
```

### 8.2 Deploy Contracts

```bash
# Load environment
source .env.sepolia

# Deploy
forge script script/Deploy.s.sol \
  --rpc-url https://sepolia.rpc.zama.ai \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  -vvvv

# Contracts will be deployed and verified on Etherscan
```

### 8.3 Deploy Frontend

```bash
cd frontend

# Build
npm run build

# Deploy to Vercel
vercel --prod

# Or use any hosting (Netlify, Cloudflare Pages, etc.)
```

### 8.4 Start Keeper

```bash
cd keeper

# Set environment variables
cp .env.example .env
# Edit .env with deployed contract address

# Run
npm start

# Or use PM2 for persistent process
pm2 start npm --name "fba-keeper" -- start
```

---

## 9. Testing on Testnet

### 9.1 Manual Testing Checklist

- [ ] Connect wallet to Sepolia
- [ ] Get test ETH from faucet
- [ ] Submit buy order
- [ ] Submit sell order
- [ ] Wait for batch to close (5 minutes)
- [ ] Verify keeper closed batch
- [ ] Check orders settled
- [ ] Try to decrypt own order
- [ ] Verify cannot decrypt others' orders

### 9.2 Monitor Deployment

```bash
# Watch keeper logs
pm2 logs fba-keeper

# Check contract on Etherscan
open https://sepolia.etherscan.io/address/<CONTRACT_ADDRESS>

# Monitor frontend
open https://your-app.vercel.app
```

---

## 10. Troubleshooting

### Common Issues

**Issue**: FHE initialization fails
**Solution**: Check FHE_PUBLIC_KEY and gateway URL are correct for Sepolia

**Issue**: Transaction reverts with "OnlyKeeper"
**Solution**: Ensure keeper address matches the one set in constructor

**Issue**: Orders not appearing
**Solution**: Check RPC endpoint, verify transaction confirmed

**Issue**: Keeper not closing batches
**Solution**: Check keeper has ETH for gas, verify batch duration elapsed

---

_See FOUNDRY_GUIDE.md for more Foundry-specific tips and tricks._
