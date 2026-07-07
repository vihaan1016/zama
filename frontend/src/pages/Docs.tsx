const SECTIONS = [
  {
    h: 'The pain',
    p: 'Every order on a transparent DEX sits in the mempool before it executes. Searchers read it, front-run it, sandwich it. The trader pays the MEV tax on every fill. Sealed bids remove the surface entirely: if no one can read your order before it clears, there is nothing to front-run.',
  },
  {
    h: 'How it works',
    p: 'A batch opens for a fixed window. Traders submit encrypted limit orders (price and size are FHE ciphertexts; only the side is public). On close, the contract computes one uniform clearing price over the sealed book — entirely under FHE — and settles crossing orders as confidential ERC-7984 transfers.',
  },
  {
    h: 'Why FHE',
    p: 'A ZK proof can show your bid is valid, but it cannot let a contract clear a price across many hidden bids. FHE can compute over ciphertext, so the contract itself discovers the clearing price without ever seeing an individual order.',
  },
  {
    h: 'Uniform-price clearing',
    p: 'Everyone who crosses trades at the same clearing price, not their own bid. Under sealed submission this is incentive-compatible — you bid your true value (Budish–Cramton–Shim, 2015).',
  },
  {
    h: 'What leaks, what does not',
    p: 'Individual orders (price, size) never leak. Clearing reveals only the winning tick and matched volume — an aggregate. You decrypt your own fill via an EIP-712 request; decrypting anyone else’s fails the on-chain access check.',
  },
  {
    h: 'Lifecycle',
    p: 'Open → Closed → Clearing → Cleared → Settled. A keeper drives the transitions: it closes the batch, scans the encrypted price grid in gas-sized chunks, public-decrypts the winner, and settles orders confidentially.',
  },
]

export default function Docs() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="font-display font-800 text-3xl text-text-primary">How Concord works</h1>
      <p className="mt-3 font-serif text-lg text-text-muted">
        A sealed-bid batch-auction DEX. Encrypted order flow → uniform-price clearing → confidential
        settlement.
      </p>

      <div className="mt-10 grid gap-8">
        {SECTIONS.map((s) => (
          <section key={s.h}>
            <h2 className="font-display font-700 text-lg text-[var(--accent-data)]">{s.h}</h2>
            <p className="mt-2 font-serif text-text-primary leading-relaxed">{s.p}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
