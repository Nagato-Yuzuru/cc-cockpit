import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import { joinSegment } from '../../shared/band.tsx'
import { EMOJI, readLog } from '../../shared/notice.ts'
import { clock, newest, summarize } from './core.ts'
import { segment } from './view.tsx'

const seenAt = atom({ plugin: 'cockpit', key: 'notices.seenAt' } as const, 0, { shape: 'v1' })

// How long a replayed bubble stays unless the pointer holds it or a click
// takes it off.
const BUBBLE_MS = 15_000

// Shows the newest notices again as bubbles, and marks the log read.
async function replay($: EngineInterface): Promise<void> {
  const list = await readLog($)
  for (const n of newest(list)) $.ui.toast(`${EMOJI[n.level]} ${n.text} ${clock(n.at)}`, { timeoutMs: BUBBLE_MS })
  const now = await $.clock.now()
  await update($, seenAt, () => now)
}

export function install(on: On): void {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const rest = await next(e)
    if (e.props.hasSurvey) return rest
    try {
      const list = await readLog($)
      if (list.length === 0) return rest
      const ui = $.ui.resolve(e)
      return joinSegment(
        ui,
        segment(ui, summarize(list, await read($, seenAt)), () => void replay($).catch(() => undefined)),
        rest,
      )
    } catch {
      return rest
    }
  })
}
