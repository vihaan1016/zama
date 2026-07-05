import { useEffect, useState } from 'react'
import { getFheInstance } from '@/lib/fhe'

/** Initialise the relayer SDK once and expose readiness. */
export function useFhe() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let active = true
    getFheInstance()
      .then(() => active && setReady(true))
      .catch((e) => active && setError(e as Error))
    return () => {
      active = false
    }
  }, [])

  return { ready, error }
}
