import { expect, test } from 'claude-code/testing'

// This feature keeps no stored state, so there is no earlier value to seed.
for (const [version, expected] of [
  ['2.1.321', 1],
  ['2.1.322', 0],
] as const) {
  test(`at session start on ${version}, the notice is logged ${expected} times`, async ($, on) => {
    const lines: string[] = []
    on('session.version', () => ({ value: { version } }))
    on('ui.log', (_, e) => {
      lines.push(e.text)
      return { value: undefined }
    })
    on('session.start', (_, e) => ({ cwd: e.cwd }))

    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

    expect(lines.filter(line => line.includes('cockpit needs Claude Code'))).toHaveLength(expected)
  })
}
