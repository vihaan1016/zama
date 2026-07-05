import { initSDK, createInstance, SepoliaConfig, type FhevmInstance } from '@zama-fhe/relayer-sdk/web'
import { RELAYER_URL } from '@/config/contracts'

// Singleton Zama relayer instance. The web build loads a WASM module (initSDK) once,
// then createInstance fetches the network public key / CRS via the injected provider.
let instance: FhevmInstance | null = null
let initPromise: Promise<FhevmInstance> | null = null

export async function getFheInstance(): Promise<FhevmInstance> {
  if (instance) return instance
  if (!initPromise) {
    initPromise = (async () => {
      await initSDK()
      const eth = (window as unknown as { ethereum?: unknown }).ethereum
      const config = {
        ...SepoliaConfig,
        ...(eth ? { network: eth as never } : {}),
        ...(RELAYER_URL ? { relayerUrl: RELAYER_URL } : {}),
      }
      instance = await createInstance(config)
      return instance
    })()
  }
  return initPromise
}

export function isFheReady(): boolean {
  return instance !== null
}
