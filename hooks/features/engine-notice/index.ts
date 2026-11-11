import type { On } from 'claude-code'

import { isSupportedEngine, MIN_ENGINE_VERSION } from '../../shared/version.ts'

export function install(on: On): void {
  on('session.start', async ($, e, next) => {
    const { version } = await $.session.version()
    if (!isSupportedEngine(version)) {
      $.ui.log(`cockpit needs Claude Code ${MIN_ENGINE_VERSION} or later (this is ${version}); it stays off.`)
    }
    return next(e)
  })
}
