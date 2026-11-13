import type { SessionContextUsage } from 'claude-code'

import type { Reading, Severity } from '../../../types'

export type { Reading, Severity }

export type Meter = {
  tokens: number
  window: number
  percent: number
  // Tokens left before compaction runs, or before the window is full when it is off.
  headroom: number
  isCompactOn: boolean
  severity: Severity
  bar: Bar
}

// Bar cells, left to right: used, free before the compaction mark, free after it.
export type Bar = { used: number; free: number; beyond: number; hasMark: boolean }

export const BAR_CELLS = 10

// Severity is measured against the limit that acts first: the compaction
// threshold when compaction is on, else the window.
const WARN_AT = 0.75
const HIGH_AT = 0.9

const ORDER: readonly Severity[] = ['ok', 'warn', 'high']

export function toReading(context: SessionContextUsage, compactAt: number | undefined): Reading | null {
  if (context.tokens === undefined || context.window <= 0) return null
  return compactAt === undefined
    ? { tokens: context.tokens, window: context.window }
    : { tokens: context.tokens, window: context.window, compactAt }
}

export function toMeter(reading: Reading): Meter {
  const { tokens, window, compactAt } = reading
  const limit = compactAt !== undefined && compactAt > 0 ? Math.min(compactAt, window) : window
  const share = tokens / limit
  const severity: Severity = share >= HIGH_AT ? 'high' : share >= WARN_AT ? 'warn' : 'ok'
  return {
    tokens,
    window,
    percent: Math.round((tokens / window) * 100),
    headroom: Math.max(0, limit - tokens),
    isCompactOn: compactAt !== undefined,
    severity,
    bar: toBar(tokens, window, limit),
  }
}

// The mark takes one cell at the compaction threshold. It is left out when the
// threshold is the window's end, or when the fill has already passed it.
function toBar(tokens: number, window: number, limit: number): Bar {
  const cell = (n: number) => Math.min(BAR_CELLS, Math.max(0, Math.round((n / window) * BAR_CELLS)))
  const used = cell(tokens)
  const mark = cell(limit)
  if (mark >= BAR_CELLS || mark < used) return { used, free: BAR_CELLS - used, beyond: 0, hasMark: false }
  return { used, free: mark - used, beyond: BAR_CELLS - mark - 1, hasMark: true }
}

// A toast tells each rise in severity once. When the fill drops (after a
// compaction), the told level drops with it, so the next rise is told again.
export function nextTold(told: Severity, now: Severity): { told: Severity; toast?: string } {
  if (ORDER.indexOf(now) <= ORDER.indexOf(told)) return { told: now }
  const share = now === 'high' ? HIGH_AT : WARN_AT
  return { told: now, toast: `Context is ${share * 100}% of the way to its limit` }
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}
