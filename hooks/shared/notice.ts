import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Notice, NoticeLevel } from '../../types'

export type { Notice, NoticeLevel }

// The log keeps the newest notices; older ones go.
export const LOG_MAX = 50

// The engine lists the state a module touches by reading each read and write
// next to its atom, so the atom stays in this file: features use the functions.
const log = atom({ plugin: 'cockpit', key: 'notices.log' } as const, [] as Notice[], { shape: 'v1' })

// A toast takes no color, and an emoji keeps its own.
export const EMOJI: Record<NoticeLevel, string> = { info: '🔵', warn: '🟡', error: '🔴' }

// Tells the person something, as a logger does: a level and a line. The notice
// shows as a toast and goes into the log the notices segment reads. The toast
// goes first: a notice that cannot be logged is still shown.
//
// One function, the level a value: the engine loads a call that passes `$` to
// a plain function, and refuses one through a member (`notify.warn($)`).
export async function notify($: EngineInterface, level: NoticeLevel, text: string): Promise<void> {
  $.ui.toast(`${EMOJI[level]} ${text}`)
  try {
    const at = await $.clock.now()
    await update($, log, list => [...list, { level, text, at }].slice(-LOG_MAX))
  } catch {
    // Shown, not logged.
  }
}

// The log, oldest first.
export async function readLog($: EngineInterface): Promise<Notice[]> {
  return read($, log)
}
