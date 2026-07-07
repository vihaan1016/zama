import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ConnectButton } from '@/components/wallet/ConnectButton'
import ShaderBackground from '@/components/ui/ShaderBackground'
import { GooeyIntro } from '@/components/ui/GooeyIntro'

// The gooey greeting plays once per page load, not on SPA navigations back.
let introPlayedThisLoad = false

const fadeUp = (delay: number, duration = 0.7) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration, ease: [0.22, 1, 0.36, 1] as const },
})

const FEATURES = [
  {
    k: '01',
    title: 'Sealed submission',
    body: 'Price and size are encrypted client-side before they ever touch the mempool. Searchers see a slot fill — not its contents.',
  },
  {
    k: '02',
    title: 'One uniform price',
    body: 'On close, the contract computes a single clearing price over the encrypted book entirely under FHE. Everyone clears at the common price.',
  },
  {
    k: '03',
    title: 'Confidential settlement',
    body: 'Crossing orders settle as ERC-7984 transfers. You decrypt only your own fill; no one can read anyone else’s order.',
  },
]

export default function Landing() {
  const [showIntro, setShowIntro] = useState(() => !introPlayedThisLoad)

  useEffect(() => {
    document.body.classList.add('shader-bg')
    return () => document.body.classList.remove('shader-bg')
  }, [])

  const dismissIntro = () => {
    introPlayedThisLoad = true
    setShowIntro(false)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {showIntro && <GooeyIntro onDone={dismissIntro} />}
      <ShaderBackground darkMode={false} />

      <motion.header
        className="fixed top-0 left-0 right-0 z-40 px-6 h-14 flex items-center justify-between border-b backdrop-blur-md bg-[rgba(250,244,232,0.85)] border-[rgba(62,44,30,0.16)]"
        {...fadeUp(showIntro ? 0 : 3.2, 1)}
      >
        <span className="font-display font-800 text-sm tracking-wider text-[#231812]">
          CON<span className="text-[#C8102E]">CORD</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            to="/docs"
            className="text-xs font-display tracking-widest uppercase text-[rgba(35,24,18,0.62)] hover:text-[#231812] transition-colors duration-200"
          >
            Docs
          </Link>
          <ConnectButton />
        </div>
      </motion.header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-28 pb-20 text-center">
        <motion.p
          className="font-mono text-xs tracking-[0.3em] uppercase text-[#C8102E] mb-6"
          {...fadeUp(showIntro ? 0.1 : 3.4)}
        >
          Sealed-Bid Batch Auction · FHE
        </motion.p>

        <motion.h1
          className="font-display font-800 text-4xl sm:text-6xl leading-[1.05] tracking-tight text-[#231812] max-w-3xl"
          {...fadeUp(showIntro ? 0.2 : 3.5)}
        >
          Trade without <span className="text-[#C8102E]">showing your hand.</span>
        </motion.h1>

        <motion.p
          className="mt-6 font-serif text-lg sm:text-xl text-[rgba(35,24,18,0.72)] max-w-2xl"
          {...fadeUp(showIntro ? 0.3 : 3.6)}
        >
          Submit your order encrypted. The batch clears at one uniform price. The mempool never sees
          your bid — so nothing can front-run or sandwich you.
        </motion.p>

        <motion.div className="mt-10 flex items-center gap-4" {...fadeUp(showIntro ? 0.4 : 3.7)}>
          <Link
            to="/trade"
            className="px-6 py-3 rounded font-display text-sm tracking-wider uppercase bg-[#C8102E] text-white hover:bg-[#a50d26] transition-colors duration-200"
          >
            Start trading
          </Link>
          <Link
            to="/batches"
            className="px-6 py-3 rounded font-display text-sm tracking-wider uppercase border border-[rgba(62,44,30,0.28)] text-[#231812] hover:border-[#C8102E] transition-colors duration-200"
          >
            View batches
          </Link>
        </motion.div>

        <motion.div
          className="mt-20 grid gap-6 sm:grid-cols-3 max-w-5xl w-full text-left"
          {...fadeUp(showIntro ? 0.5 : 3.8)}
        >
          {FEATURES.map((f) => (
            <div
              key={f.k}
              className="rounded-lg border border-[rgba(62,44,30,0.18)] bg-[rgba(253,248,238,0.7)] p-6 backdrop-blur-sm"
            >
              <span className="font-mono text-xs text-[#C8102E]">{f.k}</span>
              <h3 className="mt-2 font-display font-700 text-lg text-[#231812]">{f.title}</h3>
              <p className="mt-2 font-serif text-sm text-[rgba(35,24,18,0.7)]">{f.body}</p>
            </div>
          ))}
        </motion.div>
      </main>
    </div>
  )
}
