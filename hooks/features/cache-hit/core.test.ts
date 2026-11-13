import { expect, test } from 'claude-code/testing'

import { add, hitRate, NO_TOKENS, toRates, toTotals } from './core.ts'

test('the hit rate is the share of input tokens the cache served', () => {
  const turn = toTotals({ input_tokens: 10, output_tokens: 500, cache_read_input_tokens: 900, cache_creation_input_tokens: 90 })
  expect(turn).toEqual({ read: 900, written: 90, uncached: 10 })
  expect(hitRate(turn)).toBe(0.9)
})

test('no input tokens gives no rate, not zero', () => {
  expect(hitRate(NO_TOKENS)).toBe(null)
  expect(toRates(null, NO_TOKENS)).toEqual({ last: null, session: null })
})

test('the session rate weighs each turn by its tokens', () => {
  const cold = { read: 0, written: 1000, uncached: 0 }
  const warm = { read: 3000, written: 0, uncached: 0 }
  expect(toRates(warm, add(add(NO_TOKENS, cold), warm))).toEqual({ last: 1, session: 0.75 })
})
