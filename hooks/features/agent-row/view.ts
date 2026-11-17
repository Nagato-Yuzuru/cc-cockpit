import type { Part, Tone } from './core.ts'

// SGR foreground colors. Plain text keeps the row's own style, which the
// engine dims or bolds as the row is selected.
const COLOR: Record<Tone, string | undefined> = { plain: undefined, warn: '33', alert: '31' }

// The row body: `body` takes text alone, so the view is a string with SGR styles.
export function view(parts: readonly Part[]): string {
  return parts
    .map(({ text, tone }) => {
      const color = COLOR[tone]
      return color === undefined ? text : `\u001B[${color}m${text}\u001B[39m`
    })
    .join('')
}
