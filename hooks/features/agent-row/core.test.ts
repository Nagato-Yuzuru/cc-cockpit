import { expect, test } from 'claude-code/testing'

import {
  costText,
  depth,
  duration,
  effortText,
  fit,
  flag,
  layout,
  modelName,
  QUIET_AFTER_MS,
  tokens,
  width,
  type Agent,
  type Part,
} from './core.ts'

const NOW = 10_000_000

const agent = (over: Partial<Agent> = {}): Agent => ({
  type: 'Explore',
  label: 'Reading the settings module',
  status: 'running',
  startTime: NOW - 65_000,
  model: 'claude-haiku-4-5-20251001',
  contextWindowSize: 200_000,
  tokenCount: 15_634,
  ...over,
})

const text = (parts: Part[]) => parts.map(p => p.text).join('')

test('model ids read as display names, and other ids pass through', () => {
  expect(modelName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
  expect(modelName('claude-opus-5-5')).toBe('Opus 5.5')
  expect(modelName('claude-fable-5[1m]')).toBe('Fable 5 [1m]')
  expect(modelName('gpt-x')).toBe('gpt-x')
})

test('the effort shows what the last request sent, and a lowered effort shows both', () => {
  expect(effortText(agent())).toBe(undefined)
  expect(effortText(agent({ effort: 'high' }))).toBe('high')
  expect(effortText(agent({ effort: 'high', lastRequest: { at: NOW, effort: 'high' } }))).toBe('high')
  expect(effortText(agent({ effort: 'max', lastRequest: { at: NOW, effort: 'high' } }))).toBe('max→high')
  expect(effortText(agent({ effort: 'low', lastRequest: { at: NOW } }))).toBe('low→none')
  // An agent that takes the session's effort shows what its request carried.
  expect(effortText(agent({ lastRequest: { at: NOW, effort: 'medium' } }))).toBe('medium')
})

test('the cost is left out until there is one, and marks an unknown price', () => {
  expect(costText(undefined)).toBe(undefined)
  expect(costText({ usd: 0 })).toBe(undefined)
  expect(costText({ usd: 0.034 })).toBe('$0.03')
  expect(costText({ usd: 0.5, hasUnknownPrice: true })).toBe('≥$0.50')
  expect(costText({ usd: 123.4 })).toBe('$123')
})

test('durations and token counts use the old row formats', () => {
  expect([6_000, 65_000, 3_720_000, -5].map(duration)).toEqual(['6s', '1m05s', '1h02m', '0s'])
  expect([612, 15_634, 138_200, 1_234_567].map(tokens)).toEqual(['612', '15.6k', '138k', '1.2M'])
})

test('a waiting agent is flagged, and a running one after two quiet minutes', () => {
  expect(flag(agent({ status: 'waiting' }), NOW)).toBe('waiting')
  expect(flag(agent({ lastRequest: { at: NOW - QUIET_AFTER_MS + 1 } }), NOW)).toBe(undefined)
  expect(flag(agent({ lastRequest: { at: NOW - 185_000 } }), NOW)).toBe('quiet 3m05s')
  // Between turns an agent sends nothing on purpose.
  expect(flag(agent({ status: 'idle', lastRequest: { at: 0 } }), NOW)).toBe(undefined)
  expect(flag(agent(), NOW)).toBe(undefined)
})

test('East Asian wide characters take two columns, and a cut ends in an ellipsis', () => {
  expect(width('設定を読む')).toBe(10)
  expect(fit('設定を読む', 6)).toBe('設定…')
  expect(fit('abc', 3)).toBe('abc')
  expect(fit('abcdef', 4)).toBe('abc…')
  expect(fit('abc', 0)).toBe('')
})

test('the row puts the type and label left and the cluster at the right edge', () => {
  const row = layout(agent({ effort: 'low', cost: { usd: 0.034 } }), NOW, 90)
  expect(text(row)).toBe('Explore  Reading the settings module   Haiku 4.5 low · $0.03 · 1m05s · ↓ 15.6k tokens (7%)')
  expect(width(text(row))).toBe(90)
})

const lastPart = (tokenCount: number) => layout(agent({ tokenCount }), NOW, 120).at(-1)

test('the context share is colored as the window fills', () => {
  expect(lastPart(100_000)).toEqual({ text: '(50%)', tone: 'plain' })
  expect(lastPart(120_000)).toEqual({ text: '(60%)', tone: 'warn' })
  expect(lastPart(170_000)).toEqual({ text: '(85%)', tone: 'alert' })
})

test('a narrow row drops the cost first and the flag last', () => {
  const busy = agent({ status: 'waiting', effort: 'high', cost: { usd: 1.5 } })
  expect(text(layout(busy, NOW, 60))).toBe('Explore  Rea… waiting · Haiku 4.5 high · ↓ 15.6k tokens (7%)')
  expect(text(layout(busy, NOW, 20))).toBe('Explore  Re… waiting')
})

test('only the first line of a label shows, with no escape sequences', () => {
  expect(text(layout(agent({ label: 'Step one\u001B[31m\nStep two' }), NOW, 80))).toMatch(/^Explore {2}Step one\[31m +Haiku/)
})

test('the depth counts parents up to the main loop, and a cycle ends it', () => {
  const parents = new Map([
    ['a', undefined],
    ['b', 'a'],
    ['c', 'b'],
    ['x', 'y'],
    ['y', 'x'],
  ])
  expect(depth('a', parents)).toBe(0)
  expect(depth('c', parents)).toBe(2)
  expect(depth('x', parents)).toBe(1)
})
