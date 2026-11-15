import type { Elements, Frozen, RenderElement, RenderInput } from 'claude-code'

import type { Alert } from './core.ts'

export type FooterInput = Frozen<RenderInput<'SessionMode'>>
export type Ui = Elements[FooterInput['surface']]

// The engine draws its mode labels dim and gray. The alert goes after them in
// its own color, with the separator the engine puts between two labels.
export function view({ Box, Text }: Ui, alert: Alert, modes: RenderElement, hasModes: boolean): RenderElement {
  return (
    <Box flexDirection="row">
      {modes}
      {hasModes ? <Text dimColor>{' & '}</Text> : null}
      <Text color={alert.tone}>{alert.label}</Text>
    </Box>
  )
}
