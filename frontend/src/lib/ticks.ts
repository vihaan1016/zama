// Price grid math — mirrors the on-chain TickMath (32-tick grid).
// The contract stores the encrypted limit as a TICK INDEX (0..31), not a raw price;
// the UI converts a human USD price to a tick before encrypting.

export const MIN_TICK = 0
export const MAX_TICK = 31
export const TICK_COUNT = 32

export const MIN_PRICE_WEI = 10n ** 16n // $0.01 (18 decimals)
export const TICK_SPACING_WEI = 10n ** 17n // $0.10
export const MAX_PRICE_WEI = MIN_PRICE_WEI + BigInt(MAX_TICK) * TICK_SPACING_WEI

/** Conservative demo cap so size and size*tick stay well within euint64. */
export const MAX_SIZE = 1_000_000

export function tickToPriceWei(tick: number): bigint {
  return MIN_PRICE_WEI + BigInt(clampTick(tick)) * TICK_SPACING_WEI
}

export function tickToUsd(tick: number): number {
  return Number(tickToPriceWei(tick)) / 1e18
}

/** Floor a USD price onto the grid and return its tick index. */
export function priceUsdToTick(usd: number): number {
  const wei = BigInt(Math.round(usd * 1e18))
  const clamped = wei < MIN_PRICE_WEI ? MIN_PRICE_WEI : wei > MAX_PRICE_WEI ? MAX_PRICE_WEI : wei
  return Number((clamped - MIN_PRICE_WEI) / TICK_SPACING_WEI)
}

export function clampTick(t: number): number {
  return Math.max(MIN_TICK, Math.min(MAX_TICK, Math.round(t)))
}

export function formatUsd(usd: number): string {
  return `$${usd.toFixed(2)}`
}

export function tickLabel(tick: number): string {
  return formatUsd(tickToUsd(tick))
}
