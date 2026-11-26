import type { EngineInterface as Engine, On } from 'claude-code'

import { notify } from '../../shared/notice.ts'
import { isUnder, normalize, shorten, writeTarget } from './core.ts'

// The workspace is the project root and the shared scratch directories.
// Directories added with /add-dir are not read yet.
async function workspace($: Engine): Promise<string[]> {
  return [await $.session.root(), '/tmp', '/private/tmp']
}

// The target, shortened for a notice, when a file-writing call aims outside
// the workspace.
async function outsideTarget($: Engine, tool: string, input: unknown): Promise<string | undefined> {
  const raw = writeTarget(tool, input)
  if (raw === undefined) return undefined
  const path = normalize(raw, await $.session.cwd())
  return isUnder(path, await workspace($)) ? undefined : shorten(path, await $.env.get('HOME'))
}

// A hook on tool.run turns off, for each tool it may match, the move to the
// background and live output. Matching the write tools alone keeps those for
// every other tool.
const WRITES = { tool: ['Edit', 'Write', 'NotebookEdit'] } as const

export function install(on: On): void {
  // The verdict as it stands after every rule, hook and mode beneath. A refusal
  // is good news; an ask needs the person.
  on('tool.check', WRITES, async ($, e, next) => {
    const verdict = await next(e)
    if (e.tool_use_id === undefined || verdict.decision === 'allow') return verdict
    try {
      const path = await outsideTarget($, e.tool, e.input)
      if (path === undefined) return verdict
      if (verdict.decision === 'deny') await notify($, 'info', `${e.tool} blocked: ${path}`)
      else await notify($, 'warn', `${e.tool} asks to write ${path}`)
    } catch {
      // No notice; the decision stands.
    }
    return verdict
  })

  // A call that reaches here was allowed, by a rule or by a person.
  on('tool.run', WRITES, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined) return ran
    try {
      const path = await outsideTarget($, e.tool, e)
      if (path !== undefined) await notify($, 'error', `${e.tool} wrote ${path}`)
    } catch {
      // The write went on; only the notice is lost.
    }
    return ran
  })
}
