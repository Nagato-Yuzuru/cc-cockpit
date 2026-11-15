import type { Register } from 'claude-code'

import { install as contextMeter } from './features/context-meter/index.ts'

// The band draws the segments left to right in this order.
export const register: Register = on => {
  contextMeter(on)
}
