import { useCallback, useState } from 'react'
import { useAccount, useSignTypedData } from 'wagmi'
import { getFheInstance } from '@/lib/fhe'
import { DEX_ADDRESS } from '@/config/contracts'

/**
 * User-decryption of a handle the caller owns (their own order/fill/balance).
 * Flow: generate an ephemeral keypair → sign an EIP-712 authorization → ask the
 * relayer to re-encrypt to that key → return the plaintext. Decrypting a handle
 * the caller is not ACL-authorized for fails — that denial is the privacy proof.
 */
export function useUserDecrypt() {
  const { address } = useAccount()
  const { signTypedDataAsync } = useSignTypedData()
  const [decrypting, setDecrypting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const decrypt = useCallback(
    async (handle: string): Promise<bigint> => {
      if (!address) throw new Error('Connect a wallet first')
      setDecrypting(true)
      setError(null)
      try {
        const fhe = await getFheInstance()
        const { publicKey, privateKey } = fhe.generateKeypair()
        const start = Math.floor(Date.now() / 1000).toString()
        const days = '7'
        const eip712 = fhe.createEIP712(publicKey, [DEX_ADDRESS], start, days)

        // viem derives EIP712Domain itself; drop it from the explicit types.
        const types = { ...(eip712.types as Record<string, unknown>) }
        delete (types as { EIP712Domain?: unknown }).EIP712Domain

        const signature = await signTypedDataAsync({
          domain: eip712.domain as never,
          types: types as never,
          primaryType: (eip712 as { primaryType: string }).primaryType,
          message: (eip712 as { message: Record<string, unknown> }).message,
        })

        const res = await fhe.userDecrypt(
          [{ handle, contractAddress: DEX_ADDRESS }],
          privateKey,
          publicKey,
          signature,
          [DEX_ADDRESS],
          address,
          start,
          days,
        )
        return BigInt(res[handle] as string | number | bigint)
      } catch (e) {
        setError(e as Error)
        throw e
      } finally {
        setDecrypting(false)
      }
    },
    [address, signTypedDataAsync],
  )

  return { decrypt, decrypting, error }
}
