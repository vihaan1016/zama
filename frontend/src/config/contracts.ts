// ---------------------------------------------------------------------------
// FBA DEX contract config. Addresses come from the deploy output via Vite env
// (VITE_DEX_ADDRESS / VITE_BASE_TOKEN / VITE_QUOTE_TOKEN); ABIs are generated in
// ../abis (copied from Foundry `out/`). See docs/FRONTEND_GUIDE.md.
// ---------------------------------------------------------------------------
import type { Abi } from 'viem'
import DEX_ABI_JSON from '@/abis/BatchAuctionDEX.json'
import TOKEN_ABI_JSON from '@/abis/ConfidentialToken.json'

export const CHAIN_ID = 11155111 // Ethereum Sepolia (Zama FHEVM)

const ZERO = '0x0000000000000000000000000000000000000000' as const

export const DEX_ADDRESS = (import.meta.env.VITE_DEX_ADDRESS ?? ZERO) as `0x${string}`
export const BASE_TOKEN_ADDRESS = (import.meta.env.VITE_BASE_TOKEN ?? ZERO) as `0x${string}`
export const QUOTE_TOKEN_ADDRESS = (import.meta.env.VITE_QUOTE_TOKEN ?? ZERO) as `0x${string}`

export const DEX_ABI = DEX_ABI_JSON as Abi
export const CONFIDENTIAL_TOKEN_ABI = TOKEN_ABI_JSON as Abi

export const RELAYER_URL = (import.meta.env.VITE_RELAYER_URL ??
  'https://relayer.testnet.zama.org') as string

/** BatchStatus mirror (IBatchAuction.BatchStatus). */
export enum BatchStatus {
  Open = 0,
  Closed = 1,
  Clearing = 2,
  Cleared = 3,
  Settled = 4,
}

/** OrderType mirror. */
export enum OrderType {
  Buy = 0,
  Sell = 1,
}

export const isConfigured = DEX_ADDRESS !== ZERO
