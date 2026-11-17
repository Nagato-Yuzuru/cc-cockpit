import type { On } from 'claude-code'

import { depth, layout } from './core.ts'
import { view } from './view.ts'

const DEFAULT_COLUMNS = 80

export function install(on: On): void {
  // Draws each agent row with the model, effort and cost beside the engine's
  // figures. The row replaces a `subagentStatusLine` command's text, which
  // arrives in `body` while the setting is still set.
  on('ui.render', { component: 'AgentRow' }, async ($, e, next) => {
    const agent = e.props
    let body: string
    try {
      // `columns` is a top-level row's width; a nested row's connector takes
      // two columns for each level.
      let levels = 0
      if (agent.parentId !== undefined) {
        const list = await $.agent.list()
        levels = depth(agent.id, new Map(list.map(a => [a.id, a.parentId])))
      }
      const columns = (agent.columns ?? DEFAULT_COLUMNS) - 2 * levels
      body = view(layout(agent, await $.clock.now(), columns))
    } catch {
      // The engine draws its own row.
      return next(e)
    }
    return next({ ...e, props: { ...agent, body } })
  })
}
