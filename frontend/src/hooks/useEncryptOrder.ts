import { useCallback, useState } from 'react'
import { bytesToHex } from 'viem'
import { getFheInstance } from '@/lib/fhe'
import { DEX_ADDRESS } from '@/config/contracts'

/** Encrypted order payload matching BatchAuctionDEX.submitOrder(...). */
export interface EncryptedOrder {
  sizeHandle: `0x${string}`
  sizeProof: `0x${string}`
  tickHandle: `0x${string}`
  tickProof: `0x${string}`
}

/**
 * Encrypt an order client-side. `size` and `tick` are two separate ciphertexts,
 * each with its own input proof (the contract verifies both via FHE.fromExternal).
 */
export function useEncryptOrder() {
  const [encrypting, setEncrypting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const encryptOrder = useCallback(
    async (user: `0x${string}`, tick: number, size: number): Promise<EncryptedOrder> => {
      setEncrypting(true)
      setError(null)
      try {
        const fhe = await getFheInstance()

        const sizeInput = fhe.createEncryptedInput(DEX_ADDRESS, user)
        sizeInput.add64(BigInt(size))
        const s = await sizeInput.encrypt()

        const tickInput = fhe.createEncryptedInput(DEX_ADDRESS, user)
        tickInput.add64(BigInt(tick))
        const t = await tickInput.encrypt()

        return {
          sizeHandle: bytesToHex(s.handles[0]),
          sizeProof: bytesToHex(s.inputProof),
          tickHandle: bytesToHex(t.handles[0]),
          tickProof: bytesToHex(t.inputProof),
        }
      } catch (e) {
        setError(e as Error)
        throw e
      } finally {
        setEncrypting(false)
      }
    },
    [],
  )

  return { encryptOrder, encrypting, error }
}
