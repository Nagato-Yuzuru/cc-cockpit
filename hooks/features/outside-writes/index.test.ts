import { expect, mock, test } from 'claude-code/testing'

test('a write outside the workspace is told at its level, and one inside is not', async ($, on) => {
  // An earlier version logged plain strings; a notice still shows over it.
  on('state.get', { key: 'notices.log' }, () => ({ value: { value: ['old'], version: 1 } }))
  mock.env(on, { HOME: '/Users/me' })
  mock.clock(on, { now: 0 })
  on('session.root', () => ({ value: '/Users/me/proj' }))
  on('session.cwd', () => ({ value: '/Users/me/proj' }))
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('tool.check', (_, e) => ({ decision: e.tool_use_id === 'w1' ? 'deny' : 'ask' }))
  on('tool.run', () => ({ result: 'ok' }))

  await $.tool.check({ tool: 'Edit', input: { file_path: '/Users/me/.zshrc' }, tool_use_id: 'w1' })
  await $.tool.check({ tool: 'Write', input: { file_path: '../other/x.ts' }, tool_use_id: 'w2' })
  await $.tool.run({ tool: 'Write', file_path: '/Users/me/other/x.ts', content: '', tool_use_id: 'w2' })
  // Inside the workspace: no notice.
  await $.tool.check({ tool: 'Write', input: { file_path: 'src/a.ts' }, tool_use_id: 'w3' })
  await $.tool.run({ tool: 'Write', file_path: 'src/a.ts', content: '', tool_use_id: 'w3' })

  expect(toasts).toEqual(['🔵 Edit blocked: ~/.zshrc', '🟡 Write asks to write ~/other/x.ts', '🔴 Write wrote ~/other/x.ts'])
})
