import type { Notice, NoticeLevel } from '../../../types'

// Bubbles a press shows; older notices stay in the log.
export const BUBBLES = 5

export type Summary = { unread: number; worst: NoticeLevel | null }

const RANK: Record<NoticeLevel, number> = { info: 0, warn: 1, error: 2 }

// Unread: told after the person last opened the log. `worst` is the highest
// level among them.
export function summarize(log: readonly Notice[], seenAt: number): Summary {
  let unread = 0
  let worst: NoticeLevel | null = null
  for (const n of log) {
    if (n.at <= seenAt) continue
    unread += 1
    if (worst === null || RANK[n.level] > RANK[worst]) worst = n.level
  }
  return { unread, worst }
}

// The newest notices first: the toast stack draws the first one on top.
export function newest(log: readonly Notice[]): Notice[] {
  return log.slice(-BUBBLES).toReversed()
}

export function clock(at: number): string {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
