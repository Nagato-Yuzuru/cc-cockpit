import type { RenderElement } from 'claude-code'

import type { Ui } from '../../shared/band.tsx'
import { formatTokens, type Meter, type Severity } from './core.ts'

const COLOR: Record<Severity, 'success' | 'warning' | 'error'> = { ok: 'success', warn: 'warning', high: 'error' }

// One Text with inline parts: the band moves the segment as a whole and never
// breaks it inside.
export function view({ Text }: Ui, meter: Meter): RenderElement {
  const { bar } = meter
  const limit = meter.isCompactOn ? 'to compact' : 'left'
  return (
    <Text>
      <Text dimColor>ctx </Text>
      <Text color={COLOR[meter.severity]}>{'█'.repeat(bar.used)}</Text>
      <Text color="subtle">{'░'.repeat(bar.free)}</Text>
      {bar.hasMark ? <Text color="warning">│</Text> : null}
      <Text color="subtle">{'░'.repeat(bar.beyond)}</Text>
      {` ${meter.percent}% of ${formatTokens(meter.window)}`}
      <Text dimColor>{` · ${formatTokens(meter.headroom)} ${limit}`}</Text>
    </Text>
  )
}
