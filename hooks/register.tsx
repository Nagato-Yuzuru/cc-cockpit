import type { Register } from 'claude-code'

import { install as engineNotice } from './features/engine-notice/index.ts'

export const register: Register = on => {
  engineNotice(on)
}
