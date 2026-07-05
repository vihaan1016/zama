import { useCallback, useState } from 'react'
import { useWriteContract } from 'wagmi'
import { BASE_TOKEN_ADDRESS, QUOTE_TOKEN_ADDRESS, CONFIDENTIAL_TOKEN_ABI } from '@/config/contracts'

/** Mint test base + quote tokens to the connected trader (testnet faucet). */
export function useFaucet() {
  const { writeContractAsync } = useWriteContract()
  const [minting, setMinting] = useState(false)

  const mint = useCallback(
    async (to: `0x${string}`, amount: bigint) => {
      setMinting(true)
      try {
        for (const token of [BASE_TOKEN_ADDRESS, QUOTE_TOKEN_ADDRESS]) {
          await writeContractAsync({
            address: token,
            abi: CONFIDENTIAL_TOKEN_ABI,
            functionName: 'mint',
            args: [to, amount],
          })
        }
      } finally {
        setMinting(false)
      }
    },
    [writeContractAsync],
  )

  return { mint, minting }
}
