import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'

import { joinSegment } from '../../shared/band.tsx'
import { nextTold, toMeter, toReading, type Reading, type Severity } from './core.ts'
import { view } from './view.tsx'

const reading = atom({ plugin: 'cockpit', key: 'context-meter.reading' } as const, null as Reading | null, { shape: 'v1' })
const told = atom({ plugin: 'cockpit', key: 'context-meter.told' } as const, 'ok' as Severity, { shape: 'v1' })

export function install(on: On): void {
  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    if (!e.changed.includes('context')) return result
    try {
      // Only the breakdown carries the compaction threshold. The summary form
      // estimates locally and makes no API call.
      const { context } = await $.session.usage({ breakdown: 'summary' })
      const compactAt = context.breakdown?.isAutoCompactEnabled === true ? context.breakdown.autoCompactThreshold : undefined
      const now = toReading(e.context, compactAt)
      await update($, reading, () => now)
      if (now === null) return result

      const step = nextTold(await read($, told), toMeter(now).severity)
      await update($, told, () => step.told)
      if (step.toast !== undefined) $.ui.toast(step.toast)
    } catch {
      // The meter keeps its last reading; the measurement goes on.
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const rest = await next(e)
    if (e.props.hasSurvey) return rest
    try {
      const now = await read($, reading)
      if (now === null) return rest
      const ui = $.ui.resolve(e)
      return joinSegment(ui, view(ui, toMeter(now)), rest)
    } catch {
      return rest
    }
  })
}
