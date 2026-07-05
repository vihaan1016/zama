import { useCallback, useState } from 'react'
import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import {
  BASE_TOKEN_ADDRESS,
  QUOTE_TOKEN_ADDRESS,
  DEX_ADDRESS,
  CONFIDENTIAL_TOKEN_ABI,
} from '@/config/contracts'

const THIRTY_DAYS = 30 * 24 * 3600

/**
 * The DEX must be an ERC-7984 operator on both token legs before it can move a
 * trader's funds during settlement. One-time per token (until expiry).
 */
export function useOperatorApproval() {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const [approving, setApproving] = useState(false)

  const { data: baseOk, refetch: refetchBase } = useReadContract({
    address: BASE_TOKEN_ADDRESS,
    abi: CONFIDENTIAL_TOKEN_ABI,
    functionName: 'isOperator',
    args: address ? [address, DEX_ADDRESS] : undefined,
    query: { enabled: !!address },
  })
  const { data: quoteOk, refetch: refetchQuote } = useReadContract({
    address: QUOTE_TOKEN_ADDRESS,
    abi: CONFIDENTIAL_TOKEN_ABI,
    functionName: 'isOperator',
    args: address ? [address, DEX_ADDRESS] : undefined,
    query: { enabled: !!address },
  })

  const isApproved = Boolean(baseOk) && Boolean(quoteOk)

  const approveOperator = useCallback(async () => {
    setApproving(true)
    try {
      const until = BigInt(Math.floor(Date.now() / 1000) + THIRTY_DAYS)
      for (const token of [BASE_TOKEN_ADDRESS, QUOTE_TOKEN_ADDRESS]) {
        await writeContractAsync({
          address: token,
          abi: CONFIDENTIAL_TOKEN_ABI,
          functionName: 'setOperator',
          args: [DEX_ADDRESS, until],
        })
      }
      await Promise.all([refetchBase(), refetchQuote()])
    } finally {
      setApproving(false)
    }
  }, [writeContractAsync, refetchBase, refetchQuote])

  return { isApproved, approveOperator, approving }
}
