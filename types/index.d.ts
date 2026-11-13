// The $.state contract. The engine reads this file alone, so it imports nothing:
// each feature's core imports the stored types from here.

// context-meter: what the engine measured after the last response, and the
// token count at which automatic compaction runs (absent when it is off).
export type Reading = { tokens: number; window: number; compactAt?: number }
export type Severity = 'ok' | 'warn' | 'high'

declare module 'claude-code' {
  interface PluginState {
    cockpit: {
      'context-meter.reading': Shaped<Reading | null>
      // The highest severity a toast has told since the fill last dropped.
      'context-meter.told': Shaped<Severity>
    }
  }
}
