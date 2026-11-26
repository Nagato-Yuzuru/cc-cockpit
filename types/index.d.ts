// The $.state contract. The engine reads this file alone, so it imports nothing:
// each feature's core imports the stored types from here.

// context-meter: what the engine measured after the last response, and the
// token count at which automatic compaction runs (absent when it is off).
export type Reading = { tokens: number; window: number; compactAt?: number }
export type Severity = 'ok' | 'warn' | 'high'

// cache-hit: input tokens by how the prompt cache served them.
export type Totals = { read: number; written: number; uncached: number }

// o11y-link: whether the OTLP receiver takes the session's records.
export type LinkStatus =
  // Telemetry is off for the session, or no signal exports over OTLP.
  | 'off'
  // A signal exports over a protocol the mod cannot send, such as gRPC.
  | 'unprobeable'
  // No probe has finished yet.
  | 'unknown'
  | 'up'
  // The receiver answered an export with an error status.
  | 'rejected'
  // Nothing answered: the receiver is not running, or the endpoint is wrong.
  | 'down'
export type Link = { status: LinkStatus; checkedAt: number | null }

// notices: what the features told the person, in the order told. `at` is
// milliseconds since the epoch.
export type NoticeLevel = 'info' | 'warn' | 'error'
export type Notice = { level: NoticeLevel; text: string; at: number }

declare module 'claude-code' {
  interface PluginState {
    cockpit: {
      'context-meter.reading': Shaped<Reading | null>
      // The highest severity a toast has told since the fill last dropped.
      'context-meter.told': Shaped<Severity>
      // The last main-loop turn, and every main-loop turn of the session.
      'cache-hit.last': Shaped<Totals | null>
      'cache-hit.session': Shaped<Totals>
      'o11y-link.link': Shaped<Link>
      'notices.log': Shaped<Notice[]>
      // When the person last opened the log: later notices are unread.
      'notices.seenAt': Shaped<number>
    }
  }
}
