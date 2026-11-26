import type { Link, LinkStatus } from '../../../types'

export type { Link }

// Whether the OTLP receiver takes the session's records.
//
// The engine does not report whether an export succeeded. The mod sends the
// receiver what Claude Code sends, minus the records: an empty export request
// to each signal's endpoint, built from the same environment variables.
export type Status = LinkStatus

export const NOT_CHECKED: Link = { status: 'unknown', checkedAt: null }

export const PROBE_EVERY_MS = 15_000
export const PROBE_TIMEOUT_MS = 3_000

// The variables the exporter reads; the wiring reads each by its literal name.
export type OtelEnv = Readonly<Partial<Record<OtelVariable, string>>>

export type OtelVariable =
  | 'CLAUDE_CODE_ENABLE_TELEMETRY'
  | 'OTEL_METRICS_EXPORTER'
  | 'OTEL_LOGS_EXPORTER'
  | 'OTEL_TRACES_EXPORTER'
  | 'OTEL_EXPORTER_OTLP_PROTOCOL'
  | 'OTEL_EXPORTER_OTLP_METRICS_PROTOCOL'
  | 'OTEL_EXPORTER_OTLP_LOGS_PROTOCOL'
  | 'OTEL_EXPORTER_OTLP_TRACES_PROTOCOL'
  | 'OTEL_EXPORTER_OTLP_ENDPOINT'
  | 'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT'
  | 'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT'
  | 'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT'
  | 'OTEL_EXPORTER_OTLP_HEADERS'
  | 'OTEL_EXPORTER_OTLP_METRICS_HEADERS'
  | 'OTEL_EXPORTER_OTLP_LOGS_HEADERS'
  | 'OTEL_EXPORTER_OTLP_TRACES_HEADERS'

// One request that the receiver answers as it would a real export.
export type Target = {
  url: string
  headers: Readonly<Record<string, string>>
  body: string
}

export type Plan =
  // Telemetry is off, or no signal exports over OTLP.
  | { kind: 'off' }
  // A signal exports over gRPC or an unknown protocol, which `$.http.fetch` cannot send.
  | { kind: 'unprobeable'; protocol: string }
  | { kind: 'probe'; targets: readonly Target[] }

export type Probe = { kind: 'answered'; ok: boolean } | { kind: 'no-answer' }

const SIGNALS = [
  {
    name: 'metrics',
    exporter: 'OTEL_METRICS_EXPORTER',
    protocol: 'OTEL_EXPORTER_OTLP_METRICS_PROTOCOL',
    endpoint: 'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT',
    headers: 'OTEL_EXPORTER_OTLP_METRICS_HEADERS',
  },
  {
    name: 'logs',
    exporter: 'OTEL_LOGS_EXPORTER',
    protocol: 'OTEL_EXPORTER_OTLP_LOGS_PROTOCOL',
    endpoint: 'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT',
    headers: 'OTEL_EXPORTER_OTLP_LOGS_HEADERS',
  },
  {
    name: 'traces',
    exporter: 'OTEL_TRACES_EXPORTER',
    protocol: 'OTEL_EXPORTER_OTLP_TRACES_PROTOCOL',
    endpoint: 'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
    headers: 'OTEL_EXPORTER_OTLP_TRACES_HEADERS',
  },
] as const satisfies readonly {
  name: string
  exporter: OtelVariable
  protocol: OtelVariable
  endpoint: OtelVariable
  headers: OtelVariable
}[]

// The OTLP/HTTP default (OpenTelemetry specification, "OTLP Exporter").
const DEFAULT_HTTP_ENDPOINT = 'http://localhost:4318'

// An empty export request is valid in both encodings: no bytes in protobuf, `{}` in JSON.
const ENCODINGS: Readonly<Record<string, { contentType: string; body: string }>> = {
  'http/protobuf': { contentType: 'application/x-protobuf', body: '' },
  'http/json': { contentType: 'application/json', body: '{}' },
}

// The values Claude Code reads as true in a switch variable.
export function isTelemetryOn(value: string | undefined): boolean {
  return value !== undefined && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function set(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === '' ? undefined : trimmed
}

// `key=value` pairs separated by commas, values percent-encoded (W3C Baggage form).
export function parseHeaders(value: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const pair of (value ?? '').split(',')) {
    const at = pair.indexOf('=')
    if (at <= 0) continue
    const key = pair.slice(0, at).trim()
    try {
      headers[key] = decodeURIComponent(pair.slice(at + 1).trim())
    } catch {
      headers[key] = pair.slice(at + 1).trim()
    }
  }
  return headers
}

// A signal endpoint is used as given; the shared one gets the signal's path.
function urlOf(env: OtelEnv, signal: (typeof SIGNALS)[number]): string {
  const own = set(env[signal.endpoint])
  if (own !== undefined) return own
  const base = set(env.OTEL_EXPORTER_OTLP_ENDPOINT) ?? DEFAULT_HTTP_ENDPOINT
  return `${base.replace(/\/+$/, '')}/v1/${signal.name}`
}

export function planOf(env: OtelEnv): Plan {
  if (!isTelemetryOn(env.CLAUDE_CODE_ENABLE_TELEMETRY)) return { kind: 'off' }

  const targets: Target[] = []
  for (const signal of SIGNALS) {
    const exporters = (env[signal.exporter] ?? '').split(',').map(name => name.trim())
    if (!exporters.includes('otlp')) continue

    const protocol = set(env[signal.protocol]) ?? set(env.OTEL_EXPORTER_OTLP_PROTOCOL) ?? 'unset'
    const encoding = ENCODINGS[protocol]
    if (encoding === undefined) return { kind: 'unprobeable', protocol }

    const headers = {
      ...parseHeaders(env.OTEL_EXPORTER_OTLP_HEADERS),
      ...parseHeaders(env[signal.headers]),
      'content-type': encoding.contentType,
    }
    targets.push({ url: urlOf(env, signal), headers, body: encoding.body })
  }
  return targets.length === 0 ? { kind: 'off' } : { kind: 'probe', targets }
}

// The worst answer stands for the link: one signal that fails loses its records.
export function classify(probes: readonly Probe[]): Status {
  if (probes.some(probe => probe.kind === 'no-answer')) return 'down'
  if (probes.some(probe => probe.kind === 'answered' && !probe.ok)) return 'rejected'
  return 'up'
}

// A notice tells when a working link breaks and when a broken one comes back:
// the edges, not the states. The first probe of a session tells nothing: the
// footer shows it.
export function noticeFor(before: Status, now: Status): { level: 'error' | 'info'; text: string } | undefined {
  if (before === now) return undefined
  if (before === 'up') return { level: 'error', text: 'o11y receiver stopped taking records; they are not exported' }
  if (now === 'up' && (before === 'down' || before === 'rejected')) return { level: 'info', text: 'o11y receiver takes records again' }
  return undefined
}

// What the footer tells about the link. The tone is how bad it is: nothing
// answers (`error`), or the receiver refuses the records (`warning`).
export type Alert = { label: string; tone: 'error' | 'warning' }

// The footer names the link only while the session loses records. Any other
// status needs no action, so it shows nothing.
export function alertOf(status: Status): Alert | undefined {
  if (status === 'down') return { label: 'o11y down', tone: 'error' }
  if (status === 'rejected') return { label: 'o11y rejected', tone: 'warning' }
  return undefined
}
