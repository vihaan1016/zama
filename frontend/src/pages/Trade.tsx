import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { useCurrentBatch } from '@/hooks/useBatches'
import { useSubmitOrder } from '@/hooks/useSubmitOrder'
import { useFaucet } from '@/hooks/useFaucet'
import { useOperatorApproval } from '@/hooks/useOperatorApproval'
import { useFhe } from '@/hooks/useFhe'
import { OrderType, isConfigured } from '@/config/contracts'
import { tickLabel, MAX_SIZE } from '@/lib/ticks'
import { BatchCountdown, BatchStatusPill, SealedSlots } from '@/components/batch/BatchVisualizer'
import { TickSlider } from '@/components/batch/TickSlider'
import { ClearingResult } from '@/components/batch/ClearingResult'

export default function Trade() {
  const { address } = useAccount()
  const { toast } = useToast()
  const { ready: fheReady, error: fheError, retry: retryFhe } = useFhe()
  const { data: batch } = useCurrentBatch()
  const { submit, step, reset } = useSubmitOrder()
  const { mint, minting } = useFaucet()
  const { isApproved, approveOperator, approving } = useOperatorApproval()

  const [side, setSide] = useState<OrderType>(OrderType.Buy)
  const [tick, setTick] = useState(15)
  const [size, setSize] = useState('')

  const sizeNum = size ? Number(size) : 0
  const valid = sizeNum > 0 && sizeNum <= MAX_SIZE

  const onSubmit = async () => {
    if (!address) return toast('error', 'Connect a wallet')
    if (!fheReady) {
      return toast('error', fheError ? `Encryption init failed: ${fheError.message}` : 'Encryption still initialising')
    }
    if (!valid) return toast('error', 'Enter a valid size')
    try {
      await submit({ side, tick, size: sizeNum })
      toast('success', 'Sealed order submitted 🔒')
      setSize('')
      setTimeout(reset, 1500)
    } catch (e) {
      toast('error', `Submission failed: ${(e as Error).message}`)
    }
  }

  if (!isConfigured) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <h1 className="font-display font-800 text-2xl text-text-primary">Not configured</h1>
        <p className="mt-3 font-serif text-text-muted">
          Set <code className="font-mono">VITE_DEX_ADDRESS</code> and the token addresses in{' '}
          <code className="font-mono">.env</code> from the deploy output, then reload.
        </p>
      </div>
    )
  }

  const busy = step === 'encrypting' || step === 'submitting'
  const submitLabel =
    step === 'encrypting' ? 'Encrypting…' : step === 'submitting' ? 'Confirming…' : 'Submit sealed order'

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* Batch status */}
      <section className="rounded-lg border border-border bg-bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-700 text-lg text-text-primary">
            Batch #{batch?.batchId ?? '—'}
          </h2>
          <BatchStatusPill status={batch?.status ?? 'Open'} />
        </div>
        <div className="mt-6">
          <div className="text-xs font-mono uppercase tracking-wider text-text-subtle mb-2">
            Sealed orders ({batch?.orderCount ?? 0})
          </div>
          <SealedSlots count={batch?.orderCount ?? 0} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <Stat label="Closes in" value={<BatchCountdown endTime={batch?.endTime ?? null} />} />
          <Stat
            label="Clearing price"
            value={batch?.clearingTick != null ? tickLabel(batch.clearingTick) : '—'}
          />
          <Stat label="Matched volume" value={batch?.matchedVolume ?? '—'} />
        </div>
        <p className="mt-6 font-serif text-sm text-text-muted">
          Orders accumulate encrypted. On close, the keeper computes one uniform clearing price over the
          sealed book and settles crossing orders confidentially.
        </p>

        {batch?.clearingTick != null && (
          <div className="mt-6">
            <ClearingResult clearingTick={batch.clearingTick} matchedVolume={batch.matchedVolume} />
          </div>
        )}
      </section>

      {/* Order form */}
      <section className="rounded-lg border border-border bg-bg-surface p-6 h-fit">
        <h2 className="font-display font-700 text-lg text-text-primary mb-4">Place sealed order</h2>

        <div className="flex gap-2 mb-4">
          <SideButton active={side === OrderType.Buy} accent="yes" onClick={() => setSide(OrderType.Buy)}>
            Buy
          </SideButton>
          <SideButton active={side === OrderType.Sell} accent="no" onClick={() => setSide(OrderType.Sell)}>
            Sell
          </SideButton>
        </div>

        <TickSlider tick={tick} onChange={setTick} />

        <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-1 mt-4">
          Size
        </label>
        <Input
          type="number"
          step="1"
          placeholder="10"
          value={size}
          onChange={(e) => setSize(e.target.value)}
        />

        <div className="mt-5 flex flex-col gap-2">
          {!isApproved && (
            <Button variant="muted" onClick={approveOperator} loading={approving}>
              Approve DEX operator
            </Button>
          )}
          {address && (
            <Button variant="ghost" onClick={() => mint(address, 1_000_000n)} loading={minting}>
              Faucet: mint test tokens
            </Button>
          )}
          <Button onClick={onSubmit} loading={busy} disabled={!valid || !isApproved || !fheReady}>
            {submitLabel}
          </Button>
        </div>

        {fheError && (
          <div className="mt-3 rounded border border-[var(--accent-no)]/40 bg-[rgba(200,16,46,0.04)] p-3">
            <p className="font-mono text-xs text-[var(--accent-no)]">
              Encryption init failed: {fheError.message}
            </p>
            <p className="mt-2 font-serif text-xs text-text-muted">
              Encrypted order submission is paused until the browser encryption SDK finishes setup.
              Faucet minting can still work because it is a normal token transaction.
            </p>
            <Button className="mt-3" size="sm" variant="ghost" onClick={retryFhe}>
              Retry encryption setup
            </Button>
          </div>
        )}

        <p className="mt-4 font-serif text-xs text-text-subtle">
          🔒 Your price and size are encrypted in your browser before submission. No one — not even the
          keeper — can read them.
        </p>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-mono uppercase tracking-wider text-text-subtle">{label}</div>
      <div className="mt-1 font-mono text-lg text-text-primary">{value}</div>
    </div>
  )
}

function SideButton({
  active,
  accent,
  onClick,
  children,
}: {
  active: boolean
  accent: 'yes' | 'no'
  onClick: () => void
  children: React.ReactNode
}) {
  const color = accent === 'yes' ? 'var(--accent-yes)' : 'var(--accent-no)'
  return (
    <button
      onClick={onClick}
      className="flex-1 py-2 rounded font-display text-sm uppercase tracking-wider border transition-colors"
      style={{
        borderColor: active ? color : 'var(--border)',
        color: active ? '#fff' : 'var(--text-muted)',
        background: active ? color : 'transparent',
      }}
    >
      {children}
    </button>
  )
}
