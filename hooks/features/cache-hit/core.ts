import type { ModelUsage } from 'claude-code'

import type { Totals } from '../../../types'

export type { Totals }

export const NO_TOKENS: Totals = { read: 0, written: 0, uncached: 0 }

export type Rates = {
  // Share of the last turn's input tokens that the cache served; null before a turn.
  last: number | null
  // The same share over every main-loop turn of the session.
  session: number | null
}

export function toTotals(usage: ModelUsage): Totals {
  return { read: usage.cache_read_input_tokens, written: usage.cache_creation_input_tokens, uncached: usage.input_tokens }
}

export function add(a: Totals, b: Totals): Totals {
  return { read: a.read + b.read, written: a.written + b.written, uncached: a.uncached + b.uncached }
}

export function hitRate(t: Totals): number | null {
  const input = t.read + t.written + t.uncached
  return input === 0 ? null : t.read / input
}

export function toRates(last: Totals | null, session: Totals): Rates {
  return { last: last === null ? null : hitRate(last), session: hitRate(session) }
}
