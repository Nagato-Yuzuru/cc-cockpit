import { describe, expect, test } from 'claude-code/testing'

import { BAR_CELLS, formatTokens, nextTold, toMeter, toReading } from './core.ts'

describe('toReading', () => {
  test('has no reading before the first response of the window', () => {
    expect(toReading({ window: 200_000 }, 167_000)).toBe(null)
  })

  test('keeps the compaction threshold only when compaction is on', () => {
    expect(toReading({ tokens: 10, window: 100 }, 80)).toEqual({ tokens: 10, window: 100, compactAt: 80 })
    expect(toReading({ tokens: 10, window: 100 }, undefined)).toEqual({ tokens: 10, window: 100 })
  })
})

describe('toMeter', () => {
  test('measures the headroom to the compaction threshold', () => {
    const meter = toMeter({ tokens: 50_000, window: 200_000, compactAt: 160_000 })
    expect(meter.percent).toBe(25)
    expect(meter.headroom).toBe(110_000)
    expect(meter.isCompactOn).toBe(true)
    expect(meter.severity).toBe('ok')
  })

  test('measures against the window when compaction is off', () => {
    const meter = toMeter({ tokens: 180_000, window: 200_000 })
    expect(meter.headroom).toBe(20_000)
    expect(meter.isCompactOn).toBe(false)
    expect(meter.severity).toBe('high')
  })

  test('rates the severity against the limit that acts first', () => {
    expect(toMeter({ tokens: 120_000, window: 200_000, compactAt: 160_000 }).severity).toBe('warn')
    expect(toMeter({ tokens: 120_000, window: 200_000 }).severity).toBe('ok')
  })

  test('the bar always fills its cells, with the mark at the threshold', () => {
    const { bar } = toMeter({ tokens: 50_000, window: 200_000, compactAt: 160_000 })
    expect(bar).toEqual({ used: 3, free: 5, beyond: 1, hasMark: true })
    expect(bar.used + bar.free + 1 + bar.beyond).toBe(BAR_CELLS)
  })

  test('the bar drops the mark once the fill has passed it', () => {
    const { bar } = toMeter({ tokens: 190_000, window: 200_000, compactAt: 160_000 })
    expect(bar).toEqual({ used: 10, free: 0, beyond: 0, hasMark: false })
  })

  test('the bar stays in its cells past the window', () => {
    expect(toMeter({ tokens: 250_000, window: 200_000 }).bar).toEqual({ used: BAR_CELLS, free: 0, beyond: 0, hasMark: false })
  })
})

describe('nextTold', () => {
  test('tells each rise once', () => {
    expect(nextTold('ok', 'warn').toast).toBeDefined()
    expect(nextTold('warn', 'warn').toast).toBeUndefined()
    expect(nextTold('warn', 'high').toast).toBeDefined()
  })

  test('a drop lowers the told level, so the next rise is told again', () => {
    expect(nextTold('high', 'ok')).toEqual({ told: 'ok' })
    expect(nextTold('ok', 'high').toast).toBeDefined()
  })
})

test('formatTokens', () => {
  expect(formatTokens(950)).toBe('950')
  expect(formatTokens(48_400)).toBe('48k')
  expect(formatTokens(1_000_000)).toBe('1.0M')
})
