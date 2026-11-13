import type { TurnCompleteInput } from 'claude-code'
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

const turn = (read: number, written: number, agentId?: string): TurnCompleteInput => ({
  turnId: 't',
  answer: '',
  durationMs: 1,
  isAborted: false,
  reason: 'answer',
  ...(agentId === undefined ? {} : { agentId }),
  usage: { model: 'm', input_tokens: 0, output_tokens: 1, cache_read_input_tokens: read, cache_creation_input_tokens: written },
})

test('the cache segment ignores earlier session totals and counts main-loop turns only', async ($, on) => {
  // An earlier version stored the session total as a hit count, without a shape tag.
  // It answers the first read only, as a value the next write replaces.
  let isSeeded = true
  on('state.get', { key: 'cache-hit.session' }, (_, e, next) => {
    if (!isSeeded) return next(e)
    isSeeded = false
    return { value: { value: { hits: 7 }, version: 1 } }
  })
  on('turn.complete', (_, e) => ({ text: e.answer }))

  await $.turn.complete(turn(0, 1000))
  await $.turn.complete(turn(3000, 0))
  // A subagent's turn reads its own cache entry; it is left out.
  await $.turn.complete(turn(0, 50_000, 'a1'))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /^cache/ }))?.text).toBe('cache 100% · session 75%')
    await ui.unmount()
  }
})
