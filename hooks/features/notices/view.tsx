import type { RenderElement } from 'claude-code'

import type { Ui } from '../../shared/band.tsx'
import type { Summary } from './core.ts'

const COLOR = { info: 'suggestion', warn: 'warning', error: 'error' } as const

// The band segment: the unread count in the color of the worst unread level,
// or a dim bell when all are read. A press shows the newest notices again.
export function segment({ Button, Text }: Ui, summary: Summary, open: () => void): RenderElement {
  return (
    <Button key="notices.open" onPress={open}>
      {summary.worst === null ? (
        <Text dimColor>🔔</Text>
      ) : (
        <Text>
          {'🔔 '}
          <Text color={COLOR[summary.worst]}>{String(summary.unread)}</Text>
        </Text>
      )}
    </Button>
  )
}
