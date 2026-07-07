import { useCallback, useState } from 'react'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { DEX_ADDRESS, DEX_ABI, OrderType } from '@/config/contracts'
import { estimateGasLimit, getGasFees } from '@/lib/gas'
import { useEncryptOrder } from './useEncryptOrder'

export type SubmitStep = 'idle' | 'encrypting' | 'submitting' | 'confirmed' | 'error'

export interface SubmitParams {
  side: OrderType
  tick: number
  size: number
}

/** Encrypt (size, tick) client-side then submit the sealed order on-chain. */
export function useSubmitOrder() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { encryptOrder } = useEncryptOrder()
  const { writeContractAsync } = useWriteContract()
  const queryClient = useQueryClient()

  const [step, setStep] = useState<SubmitStep>('idle')
  const [error, setError] = useState<Error | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()

  const submit = useCallback(
    async ({ side, tick, size }: SubmitParams) => {
      if (!address) throw new Error('Connect a wallet first')
      setError(null)
      try {
        setStep('encrypting')
        const enc = await encryptOrder(address, tick, size)

        setStep('submitting')
        const args = [side, enc.sizeHandle, enc.tickHandle, enc.sizeProof, enc.tickProof] as const
        const estimatedGas = await estimateGasLimit(
          publicClient,
          {
            address: DEX_ADDRESS,
            abi: DEX_ABI,
            functionName: 'submitOrder',
            args,
            account: address,
          },
          2_500_000n,
          { throwOnRevert: true },
        )
        // submitOrder is ~450k gas in Foundry. Wallet/RPC estimators can wildly
        // overshoot FHE calls, and Infura rejects those as "gas limit too high".
        // Use the lower of estimate and a Sepolia-safe ceiling, with a floor that
        // still leaves plenty of room over observed gas.
        const gas = estimatedGas > 800_000n ? 800_000n : estimatedGas < 650_000n ? 650_000n : estimatedGas
        console.info('submitOrder gas limit', gas.toString())
        const fees = await getGasFees(publicClient)
        const hash = await writeContractAsync({
          address: DEX_ADDRESS,
          abi: DEX_ABI,
          functionName: 'submitOrder',
          args,
          gas,
          ...fees,
        })
        setTxHash(hash)
        await publicClient?.waitForTransactionReceipt({ hash })

        setStep('confirmed')
        queryClient.invalidateQueries({ queryKey: ['currentBatch'] })
        queryClient.invalidateQueries({ queryKey: ['myOrders'] })
        return hash
      } catch (e) {
        setError(e as Error)
        setStep('error')
        throw e
      }
    },
    [address, encryptOrder, writeContractAsync, publicClient, queryClient],
  )

  const reset = useCallback(() => {
    setStep('idle')
    setError(null)
    setTxHash(undefined)
  }, [])

  return { submit, step, error, txHash, reset }
}
