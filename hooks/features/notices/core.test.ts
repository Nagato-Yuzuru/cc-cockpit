import { expect, test } from 'claude-code/testing'

import type { Notice } from '../../../types'
import { BUBBLES, newest, summarize } from './core.ts'

const at = (n: number, level: Notice['level'] = 'info'): Notice => ({ level, text: `n${n}`, at: n })

test('unread counts the notices after the last look, colored by the worst of them', () => {
  const log = [at(1, 'error'), at(2, 'info'), at(3, 'warn')]
  expect(summarize(log, 0)).toEqual({ unread: 3, worst: 'error' })
  expect(summarize(log, 1)).toEqual({ unread: 2, worst: 'warn' })
  expect(summarize(log, 3)).toEqual({ unread: 0, worst: null })
})

test('the bubbles show the newest notices first', () => {
  const log = Array.from({ length: BUBBLES + 2 }, (_, i) => at(i))
  const shown = newest(log)
  expect(shown.length).toBe(BUBBLES)
  expect(shown[0]?.text).toBe(`n${BUBBLES + 1}`)
})
