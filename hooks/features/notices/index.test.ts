import { expect, mock, test } from 'claude-code/testing'

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

test('the bell ignores an earlier log, counts unread notices, and a press replays them as read', async ($, on) => {
  // An earlier version stored the log as plain strings, without a shape tag.
  let isSeeded = true
  on('state.get', { key: 'notices.log' }, (_, e, next) => {
    if (!isSeeded) return next(e)
    isSeeded = false
    return { value: { value: ['old'], version: 1 } }
  })
  const clock = mock.clock(on, { now: 1000 })
  mock.env(on, { HOME: '/Users/me' })
  on('session.root', () => ({ value: '/Users/me/proj' }))
  on('session.cwd', () => ({ value: '/Users/me/proj' }))
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('tool.check', () => ({ decision: 'deny' }))
  on('tool.run', () => ({ result: 'ok' }))

  const bell = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const text = (await ui.find({ type: 'Text', text: /🔔/ }))?.text
    await ui.unmount()
    return text
  }
  expect(await bell()).toBe(undefined)

  // Two notices from outside-writes, through the shared notify.
  await $.tool.check({ tool: 'Edit', input: { file_path: '/Users/me/.zshrc' }, tool_use_id: 'w1' })
  await clock.advance(60_000)
  await $.tool.run({ tool: 'Write', file_path: '/Users/me/x.ts', content: '', tool_use_id: 'w2' })
  expect(await bell()).toBe('🔔 2')

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  toasts.length = 0
  await ui.press({ key: 'notices.open' })
  await ui.unmount()
  // Newest first; the time is local, so only its shape is checked.
  expect(toasts.map(t => t.replace(/\d\d:\d\d$/, 'hh:mm'))).toEqual(['🔴 Write wrote ~/x.ts hh:mm', '🔵 Edit blocked: ~/.zshrc hh:mm'])
  expect(await bell()).toBe('🔔')
})
