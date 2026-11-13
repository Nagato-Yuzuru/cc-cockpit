import type { On, SessionUsage, TurnCompleteInput } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

// The band as a whole: the features share it through the hook chain, so only a
// test with every feature loaded sees their order and their independence.

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

// The outer Text of each segment. An inner part such as 'ctx ' has nothing
// after its space, so it does not match.
const SEGMENT = /^(ctx|cache) ./

const turn: TurnCompleteInput = {
  turnId: 't',
  answer: '',
  durationMs: 1,
  isAborted: false,
  reason: 'answer',
  usage: { model: 'm', input_tokens: 0, output_tokens: 1, cache_read_input_tokens: 3000, cache_creation_input_tokens: 1000 },
}

const segmentsOn = async ($: Engine, surface: 'terminal' | 'desktop', hasSurvey = false) => {
  const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, hasSurvey } })
  const found = await ui.findAll({ type: 'Text', text: SEGMENT })
  await ui.unmount()
  return found.map(element => element.text)
}

// Gives each band feature a figure to draw: a context reading and one turn.
// Telemetry is off, so the o11y link, which draws in the footer, probes nothing.
const feedEveryFeature = async ($: Engine, on: On) => {
  mock.env(on, {})
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({
    value: { startedAt: 0, rateLimits: [], context: { tokens: 50_000, window: 200_000 } } as unknown as SessionUsage,
  }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('turn.complete', (_, e) => ({ text: e.answer }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure({ context: { tokens: 50_000, window: 200_000 }, rateLimits: [], changed: ['context'] })
  await $.turn.complete(turn)
}

const EVERY_SEGMENT = ['ctx ███░░░░░░░ 25% of 200k · 150k left', 'cache 75% · session 75%']

test('the band draws the segments in register order, and none while a survey shows', async ($, on) => {
  await feedEveryFeature($, on)

  for (const surface of ['terminal', 'desktop'] as const) {
    expect(await segmentsOn($, surface)).toEqual(EVERY_SEGMENT)
    expect(await segmentsOn($, surface, true)).toEqual([])
  }
})

test('a segment that fails to read its state leaves the band to the others', async ($, on) => {
  let isBroken = false
  on('state.get', { key: 'cache-hit.last' }, (_, e, next) => {
    if (isBroken) return { deny: 'store unavailable' }
    return next(e)
  })
  await feedEveryFeature($, on)

  isBroken = true
  for (const surface of ['terminal', 'desktop'] as const) {
    expect(await segmentsOn($, surface)).toEqual(EVERY_SEGMENT.filter(segment => !segment.startsWith('cache')))
  }
})
