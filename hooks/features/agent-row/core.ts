import type { AgentStatus, ModelEffort } from 'claude-code'

// The AgentRow props that the row reads.
export type Agent = {
  type: string
  label: string
  status: AgentStatus
  startTime: number
  model?: string
  effort?: ModelEffort | number
  contextWindowSize?: number
  tokenCount: number
  lastRequest?: { at: number; effort?: ModelEffort | number }
  cost?: { usd: number; hasUnknownPrice?: true }
}

// A run of text and how the view styles it.
export type Tone = 'plain' | 'warn' | 'alert'
export type Part = { text: string; tone: Tone }

// A running agent that sent no request for this long gets a flag. A slow tool,
// a long response and a hung agent all look the same here, so the flag tells
// the time and not a cause.
export const QUIET_AFTER_MS = 120_000

const WARN_SHARE = 0.6
const ALERT_SHARE = 0.85

// "claude-haiku-4-5-20251001" -> "Haiku 4.5", "claude-fable-5[1m]" -> "Fable 5 [1m]".
// An id of another shape is shown as it is.
export function modelName(id: string): string {
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d+))?(?:-\d{8})?(\[[^\]]*\])?$/.exec(id)
  if (m === null) return id
  const [, family = '', major, minor, suffix] = m
  const name = `${family.charAt(0).toUpperCase()}${family.slice(1)} ${major}${minor === undefined ? '' : `.${minor}`}`
  return suffix === undefined ? name : `${name} ${suffix}`
}

// The effort set for the agent, and the effort its last request sent when the
// model lowered it or took none: "high", or "max→high".
export function effortText(agent: Agent): string | undefined {
  const set = agent.effort
  if (agent.lastRequest === undefined) return set === undefined ? undefined : String(set)
  const sent = agent.lastRequest.effort
  if (set !== undefined && sent !== set) return `${set}→${sent ?? 'none'}`
  return sent === undefined ? undefined : String(sent)
}

export function costText(cost: Agent['cost']): string | undefined {
  if (cost === undefined || cost.usd === 0) return undefined
  const amount = cost.usd >= 100 ? cost.usd.toFixed(0) : cost.usd.toFixed(2)
  return `${cost.hasUnknownPrice === true ? '≥' : ''}$${amount}`
}

const twoDigits = (n: number) => String(n).padStart(2, '0')

// 6s, 1m05s, 1h02m
export function duration(ms: number): string {
  const s = Math.max(Math.floor(ms / 1000), 0)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m${twoDigits(s % 60)}s`
  return `${Math.floor(s / 3600)}h${twoDigits(Math.floor((s % 3600) / 60))}m`
}

// 612, 15.6k, 138k, 1.2M
export function tokens(n: number): string {
  if (n < 1000) return String(n)
  if (n < 100_000) return `${Math.floor(n / 100) / 10}k`
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k`
  return `${Math.floor(n / 100_000) / 10}M`
}

// Why the agent is not making progress, when the row can tell.
export function flag(agent: Agent, now: number): string | undefined {
  if (agent.status === 'waiting') return 'waiting'
  if (agent.status !== 'running' || agent.lastRequest === undefined) return undefined
  const quiet = now - agent.lastRequest.at
  return quiet >= QUIET_AFTER_MS ? `quiet ${duration(quiet)}` : undefined
}

function shareTone(share: number): Tone {
  return share >= ALERT_SHARE ? 'alert' : share >= WARN_SHARE ? 'warn' : 'plain'
}

// The right-hand cluster, each item with the rank at which it is dropped when
// the row is too narrow: the lowest rank goes first.
function cluster(agent: Agent, now: number): { parts: Part[]; rank: number }[] {
  const items: { parts: Part[]; rank: number }[] = []
  const add = (rank: number, ...parts: Part[]) => items.push({ parts, rank })

  const flagText = flag(agent, now)
  if (flagText !== undefined) add(6, { text: flagText, tone: 'warn' })
  const model = [agent.model === undefined ? undefined : modelName(agent.model), effortText(agent)].filter(s => s !== undefined)
  if (model.length > 0) add(4, { text: model.join(' '), tone: 'plain' })
  const cost = costText(agent.cost)
  if (cost !== undefined) add(1, { text: cost, tone: 'plain' })
  add(2, { text: duration(now - agent.startTime), tone: 'plain' })
  const size = agent.contextWindowSize
  if (size === undefined || size <= 0) {
    add(5, { text: `↓ ${tokens(agent.tokenCount)} tokens`, tone: 'plain' })
  } else {
    const share = agent.tokenCount / size
    add(
      5,
      { text: `↓ ${tokens(agent.tokenCount)} tokens `, tone: 'plain' },
      { text: `(${Math.floor(share * 100)}%)`, tone: shareTone(share) },
    )
  }
  return items
}

const WIDE = /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\u{FF00}-\u{FF60}\u{FFE0}-\u{FFE6}]/u

// Terminal columns: one per code point, two for an East Asian wide one.
export function width(text: string): number {
  let n = 0
  for (const c of text) n += WIDE.test(c) ? 2 : 1
  return n
}

// Cuts text to at most `columns`, with "…" in place of what was cut.
export function fit(text: string, columns: number): string {
  if (width(text) <= columns) return text
  if (columns <= 0) return ''
  let out = ''
  let used = 0
  for (const c of text) {
    const w = WIDE.test(c) ? 2 : 1
    if (used + w > columns - 1) break
    out += c
    used += w
  }
  return `${out}…`
}

// The first line of a model's progress summary, with no control characters, so
// it cannot put an escape sequence into the row.
function oneLine(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  // The pattern matches control characters on purpose: they are what it removes.
  // oxlint-disable-next-line no-control-regex
  return first.replace(/[\u0000-\u001F\u007F]/g, '')
}

const SEPARATOR: Part = { text: ' · ', tone: 'plain' }

// The row body laid out in `columns`: "<type>  <label>", padding, and the
// cluster at the right edge.
export function layout(agent: Agent, now: number, columns: number): Part[] {
  let items = cluster(agent, now)
  const lead = `${agent.type}  `
  const rightWidth = () =>
    items.reduce((n, item) => n + item.parts.reduce((m, p) => m + width(p.text), 0), 0) + Math.max(items.length - 1, 0) * 3
  // Keep the type and one column of label in view; drop cluster items to make room.
  while (items.length > 1 && width(lead) + 2 + rightWidth() > columns) {
    const lowest = Math.min(...items.map(item => item.rank))
    items = items.filter(item => item.rank !== lowest)
  }

  const right: Part[] = []
  for (const item of items) {
    if (right.length > 0) right.push(SEPARATOR)
    right.push(...item.parts)
  }
  const room = Math.max(columns - rightWidth() - 1, 0)
  const left = fit(`${lead}${oneLine(agent.label)}`, room)
  const pad = ' '.repeat(Math.max(columns - width(left) - rightWidth(), 1))
  return [{ text: left + pad, tone: 'plain' }, ...right]
}

// How deep the row sits in the agent tree: 0 for an agent the main loop spawned.
// A parent that is gone from the list ends the walk.
export function depth(id: string, parents: ReadonlyMap<string, string | undefined>): number {
  let n = 0
  const seen = new Set([id])
  for (let parent = parents.get(id); parent !== undefined && !seen.has(parent); parent = parents.get(parent)) {
    seen.add(parent)
    n++
  }
  return n
}
