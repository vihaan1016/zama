import { type Hex } from 'viem';
import { logger } from './logger.js';

/**
 * Result of a public decryption, shaped for BatchAuctionDEX.submitClearingResult:
 * the contract calls FHE.checkSignatures(handles, cleartexts, decryptionProof).
 */
export interface PublicDecryptResult {
  cleartexts: Hex; // abi.encodePacked(uint256[]) matching `handles` order
  decryptionProof: Hex; // KMS public-decryption proof
  values: bigint[]; // decoded plaintext values, for logging/bookkeeping
}

/**
 * Off-chain public decryption of the clearing winner via the Zama relayer.
 *
 * The relayer SDK verifies KMS signatures and returns both the decrypted values and the
 * proof blob the on-chain KMSVerifier expects. We pack the values as uint256 words so the
 * contract can `abi.decode(cleartexts, (uint256, uint256))`.
 */
export async function publicDecrypt(
  relayerUrl: string,
  chainId: number,
  handles: Hex[],
): Promise<PublicDecryptResult> {
  // Loaded lazily so unit-level use of the keeper does not require the native SDK.
  const { createInstance, SepoliaConfig } = await import('@zama-fhe/relayer-sdk/node');
  const instance = await createInstance({
    ...SepoliaConfig,
    chainId,
    relayerUrl,
    network: process.env.RPC_URL ?? 'https://eth-sepolia.public.blastapi.io',
  });

  logger.info('requesting public decryption', { handles });
  // SDK >=0.4 returns the ABI-packed cleartexts and proof in the exact shape
  // expected by FHE.checkSignatures, plus a handle -> plaintext map for logs.
  const res: {
    clearValues: Record<`0x${string}`, bigint | boolean | Hex>;
    abiEncodedClearValues: Hex;
    decryptionProof: Hex;
  } = await (instance as unknown as {
    publicDecrypt: (h: Hex[]) => Promise<{
      clearValues: Record<`0x${string}`, bigint | boolean | Hex>;
      abiEncodedClearValues: Hex;
      decryptionProof: Hex;
    }>;
  }).publicDecrypt(handles);

  const values = handles.map((h) => BigInt(res.clearValues[h] ?? res.clearValues[h.toLowerCase() as `0x${string}`] ?? 0));

  return { cleartexts: res.abiEncodedClearValues, decryptionProof: res.decryptionProof, values };
}
