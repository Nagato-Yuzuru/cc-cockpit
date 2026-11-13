import type { Elements, Frozen, RenderElement, RenderInput } from 'claude-code'

export type BandInput = Frozen<RenderInput<'AbovePrompt'>>

// The element table a segment draws with: a view takes it as an argument, so
// only the wiring calls `$.ui.resolve`.
export type Ui = Elements[BandInput['surface']]

// Each feature adds one segment to the row above the prompt. The segments
// share the band through the hook chain: a feature's `ui.render` hook draws its
// segment in front of what the hooks beneath it drew (`rest`), so no feature
// knows about another. A segment keeps its width; when the row is too narrow,
// the segments after it go to the next line.
export function joinSegment({ Box }: Ui, segment: RenderElement, rest: RenderElement): RenderElement {
  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
      <Box flexShrink={0}>{segment}</Box>
      {rest}
    </Box>
  )
}
