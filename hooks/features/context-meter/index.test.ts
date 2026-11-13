import type { SessionUsage } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'cockpit',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

// The meter reads only the compaction fields of the breakdown.
const usageWith = (tokens: number) => ({
  value: {
    startedAt: 0,
    rateLimits: [],
    context: { tokens, window: 200_000, breakdown: { isAutoCompactEnabled: true, autoCompactThreshold: 160_000 } },
  } as unknown as SessionUsage,
})

test('the meter ignores an earlier reading, then shows the measured fill and tells each rise once', async ($, on) => {
  // An earlier version stored the fill as a bare number, without a shape tag.
  let isSeeded = true
  on('state.get', { key: 'context-meter.reading' }, (_, e, next) => (isSeeded ? { value: { value: 42, version: 1 } } : next(e)))
  let tokens = 50_000
  on('session.usage', () => usageWith(tokens))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  const measure = () => $.session.measure({ context: { tokens, window: 200_000 }, rateLimits: [], changed: ['context'] })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /ctx/ })).toBeUndefined()
    await ui.unmount()
  }

  isSeeded = false
  await measure()
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /^ctx/ }))?.text).toBe('ctx ███░░░░░│░ 25% of 200k · 110k to compact')
    await ui.unmount()
  }
  expect(toasts).toEqual([])

  tokens = 130_000
  await measure()
  tokens = 135_000
  await measure()
  expect(toasts).toHaveLength(1)
})

test('with auto-compact off, the meter measures against the window', async ($, on) => {
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      rateLimits: [],
      context: { tokens: 150_000, window: 200_000, breakdown: { isAutoCompactEnabled: false, autoCompactThreshold: 160_000 } },
    } as unknown as SessionUsage,
  }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  await $.session.measure({ context: { tokens: 150_000, window: 200_000 }, rateLimits: [], changed: ['context'] })

  // At 160k compaction this fill would be 94% of the limit, with a mark on the bar.
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /^ctx/ }))?.text).toBe('ctx ████████░░ 75% of 200k · 50k left')
    await ui.unmount()
  }
  expect(toasts).toEqual(['Context is 75% of the way to its limit'])
})
