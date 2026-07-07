import { useEffect, useState } from 'react'
import { useCallback } from 'react'
import { getFheInstance } from '@/lib/fhe'

/** Initialise the relayer SDK once and expose readiness. */
export function useFhe() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setError(null)
    getFheInstance()
      .then(() => active && setReady(true))
      .catch((e) => {
        if (!active) return
        setReady(false)
        setError(e as Error)
      })
    return () => {
      active = false
    }
  }, [attempt])

  const retry = useCallback(() => {
    setReady(false)
    setAttempt((value) => value + 1)
  }, [])

  return { ready, error, retry }
}
