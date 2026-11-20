import type { Register } from 'claude-code'

import { install as agentRow } from './features/agent-row/index.ts'
import { install as cacheHit } from './features/cache-hit/index.ts'
import { install as contextMeter } from './features/context-meter/index.ts'
import { install as notices } from './features/notices/index.ts'
import { install as o11yLink } from './features/o11y-link/index.ts'
import { install as outsideWrites } from './features/outside-writes/index.ts'

// The band draws the segments left to right in this order.
export const register: Register = on => {
  contextMeter(on)
  cacheHit(on)
  o11yLink(on)
  agentRow(on)
  outsideWrites(on)
  notices(on)
}
