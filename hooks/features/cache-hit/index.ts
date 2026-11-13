import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'

import { joinSegment } from '../../shared/band.tsx'
import { add, NO_TOKENS, toRates, toTotals, type Totals } from './core.ts'
import { view } from './view.tsx'

const last = atom({ plugin: 'cockpit', key: 'cache-hit.last' } as const, null as Totals | null, { shape: 'v1' })
const session = atom({ plugin: 'cockpit', key: 'cache-hit.session' } as const, NO_TOKENS, { shape: 'v1' })

export function install(on: On): void {
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    // A subagent's turns use their own cache entries; the meter is for the main loop.
    if (e.agentId !== undefined || e.usage === undefined) return result
    const turn = toTotals(e.usage)
    try {
      await update($, last, () => turn)
      await update($, session, total => add(total, turn))
    } catch {
      // The segment keeps its last figures.
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const rest = await next(e)
    if (e.props.hasSurvey) return rest
    try {
      const rates = toRates(await read($, last), await read($, session))
      if (rates.last === null && rates.session === null) return rest
      const ui = $.ui.resolve(e)
      return joinSegment(ui, view(ui, rates), rest)
    } catch {
      return rest
    }
  })
}
