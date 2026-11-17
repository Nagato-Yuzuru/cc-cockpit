import type { AgentInfo, On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const START = 1_000_000
const NOW = START + 65_000

const info = (over: Partial<AgentInfo> = {}): AgentInfo => ({
  id: 'a1',
  description: 'Explore hooks layout',
  type: 'Explore',
  status: 'running',
  kind: 'local_agent',
  taskStatus: 'running',
  label: 'Reading the settings module',
  startTime: START,
  cwd: '/',
  model: 'claude-haiku-4-5-20251001',
  effort: 'low',
  contextWindowSize: 200_000,
  tokenCount: 170_000,
  tokenSamples: [170_000],
  lastRequest: { at: START, model: 'claude-haiku-4-5-20251001', effort: 'low' },
  cost: { usd: 0.034 },
  hasRow: true,
  ...over,
})

// Draws one row and answers the body the engine receives beneath the mod.
// A body that a `subagentStatusLine` command made arrives already set.
const bodyOf = async ($: Engine, on: On, agent: AgentInfo, columns: number) => {
  const bodies: (string | undefined)[] = []
  on('ui.render', { component: 'AgentRow' }, (_, e, next) => {
    bodies.push(e.props.body)
    return next(e)
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const props = { ...agent, rowIds: [agent.id], columns, isHidden: false, body: 'from the command' }
    const ui = await $.ui.mount({ plugin: 'cockpit', component: 'AgentRow', surface, props })
    await ui.unmount()
  }
  // Each surface gets the same row.
  expect(bodies.length).toBe(2)
  expect(bodies[1]).toBe(bodies[0])
  return bodies[0]
}

test('the row replaces the command text with the model, effort, cost and a colored context share', async ($, on) => {
  mock.clock(on, { now: NOW })
  expect(await bodyOf($, on, info(), 90)).toBe(
    'Explore  Reading the settings module   Haiku 4.5 low · $0.03 · 1m05s · ↓ 170k tokens \u001B[31m(85%)\u001B[39m',
  )
})

test('a nested row is narrower by two columns for each level', async ($, on) => {
  mock.clock(on, { now: NOW })
  const parent = info({ id: 'p' })
  const child = info({ id: 'c', parentId: 'p', status: 'waiting' })
  on('agent.list', () => ({ value: [parent, child] }))
  expect(await bodyOf($, on, child, 60)).toBe(
    'Explore  Re… \u001B[33mwaiting\u001B[39m · Haiku 4.5 low · ↓ 170k tokens \u001B[31m(85%)\u001B[39m',
  )
})

test('when the agent list fails, the engine row stays as it came', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('agent.list', () => ({ deny: 'unavailable' }))
  expect(await bodyOf($, on, info({ parentId: 'p' }), 90)).toBe('from the command')
})
