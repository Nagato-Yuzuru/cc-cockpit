import type { RenderElement } from 'claude-code'

import type { Ui } from '../../shared/band.tsx'
import type { Rates } from './core.ts'

function color(rate: number): 'success' | 'warning' | 'error' {
  return rate >= 0.8 ? 'success' : rate >= 0.5 ? 'warning' : 'error'
}

function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

// One Text with inline parts: the band moves the segment as a whole.
export function view({ Text }: Ui, rates: Rates): RenderElement {
  return (
    <Text>
      <Text dimColor>cache </Text>
      {rates.last === null ? <Text dimColor>–</Text> : <Text color={color(rates.last)}>{percent(rates.last)}</Text>}
      {rates.session === null ? null : <Text dimColor>{` · session ${percent(rates.session)}`}</Text>}
    </Text>
  )
}
