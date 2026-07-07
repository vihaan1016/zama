import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  injectedWallet,
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { createConfig, http, fallback } from 'wagmi'
import { sepolia } from 'wagmi/chains'

// Ethereum Sepolia with the Zama FHEVM coprocessor. Use a dedicated RPC — public
// nodes rate-limit (429) the relayer decrypt flow and multi-step tx sequences.
const RPC_PRIMARY = import.meta.env.VITE_RPC_URL || 'https://sepolia.rpc.zama.ai'

// WalletConnect requires a real project id; gate it so wallet connect never 403s.
const rawProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined
const projectId = rawProjectId && rawProjectId !== 'dev' ? rawProjectId : undefined

const walletGroups = [
  {
    groupName: 'Recommended',
    wallets: [
      injectedWallet,
      coinbaseWallet,
      // Both build a WalletConnect connector internally — gated without a project id.
      // MetaMask still connects via injectedWallet.
      ...(projectId ? [metaMaskWallet, walletConnectWallet] : []),
    ],
  },
]

const connectors = connectorsForWallets(walletGroups, {
  appName: 'Concord',
  projectId: projectId ?? '',
})

export const wagmiConfig = createConfig({
  connectors,
  chains: [sepolia],
  transports: {
    [sepolia.id]: fallback([
      http(RPC_PRIMARY, { batch: true, retryCount: 5, retryDelay: 300 }),
      http('https://ethereum-sepolia-rpc.publicnode.com', { batch: true, retryCount: 3, retryDelay: 300 }),
    ]),
  },
  ssr: false,
})
