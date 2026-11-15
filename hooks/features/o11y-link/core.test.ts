import { describe, expect, test } from 'claude-code/testing'

import { alertOf, classify, isTelemetryOn, parseHeaders, planOf, toastFor } from './core.ts'

const ON = { CLAUDE_CODE_ENABLE_TELEMETRY: '1' } as const

test('telemetry is on only for a true switch value', () => {
  expect(isTelemetryOn('1')).toBe(true)
  expect(isTelemetryOn('TRUE')).toBe(true)
  expect(isTelemetryOn('0')).toBe(false)
  expect(isTelemetryOn('')).toBe(false)
  expect(isTelemetryOn(undefined)).toBe(false)
})

describe('planOf', () => {
  test('is off without telemetry, or without an OTLP exporter', () => {
    expect(planOf({ OTEL_LOGS_EXPORTER: 'otlp', OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf' })).toEqual({ kind: 'off' })
    expect(planOf({ ...ON, OTEL_LOGS_EXPORTER: 'console' })).toEqual({ kind: 'off' })
  })

  test('adds the signal path to the shared endpoint, for each OTLP signal', () => {
    const plan = planOf({
      ...ON,
      OTEL_METRICS_EXPORTER: 'otlp',
      OTEL_LOGS_EXPORTER: 'console,otlp',
      OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318/',
    })
    expect(plan).toEqual({
      kind: 'probe',
      targets: [
        { url: 'http://localhost:4318/v1/metrics', headers: { 'content-type': 'application/x-protobuf' }, body: '' },
        { url: 'http://localhost:4318/v1/logs', headers: { 'content-type': 'application/x-protobuf' }, body: '' },
      ],
    })
  })

  test('a signal setting wins over the shared one, and its endpoint is used as given', () => {
    const plan = planOf({
      ...ON,
      OTEL_LOGS_EXPORTER: 'otlp',
      OTEL_EXPORTER_OTLP_PROTOCOL: 'grpc',
      OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: 'http/json',
      OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: 'https://collector.example/otlp/logs',
      OTEL_EXPORTER_OTLP_HEADERS: 'authorization=Basic%20abc,x-team=a',
      OTEL_EXPORTER_OTLP_LOGS_HEADERS: 'x-team=b',
    })
    expect(plan).toEqual({
      kind: 'probe',
      targets: [
        {
          url: 'https://collector.example/otlp/logs',
          headers: { authorization: 'Basic abc', 'x-team': 'b', 'content-type': 'application/json' },
          body: '{}',
        },
      ],
    })
  })

  test('uses the OTLP/HTTP default endpoint when none is set', () => {
    const plan = planOf({ ...ON, OTEL_TRACES_EXPORTER: 'otlp', OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf' })
    expect(plan.kind === 'probe' ? plan.targets.map(t => t.url) : []).toEqual(['http://localhost:4318/v1/traces'])
  })

  test('a gRPC or unset protocol cannot be probed', () => {
    expect(planOf({ ...ON, OTEL_LOGS_EXPORTER: 'otlp', OTEL_EXPORTER_OTLP_PROTOCOL: 'grpc' })).toEqual({
      kind: 'unprobeable',
      protocol: 'grpc',
    })
    expect(planOf({ ...ON, OTEL_LOGS_EXPORTER: 'otlp' })).toEqual({ kind: 'unprobeable', protocol: 'unset' })
  })
})

test('parseHeaders reads percent-encoded pairs and skips malformed ones', () => {
  expect(parseHeaders('a=1, b = x%2Cy ,=bad,novalue,c=%E0%A4%A')).toEqual({ a: '1', b: 'x,y', c: '%E0%A4%A' })
  expect(parseHeaders(undefined)).toEqual({})
})

test('the worst answer stands for the link', () => {
  expect(classify([{ kind: 'answered', ok: true }])).toBe('up')
  expect(
    classify([
      { kind: 'answered', ok: true },
      { kind: 'answered', ok: false },
    ]),
  ).toBe('rejected')
  expect(classify([{ kind: 'answered', ok: false }, { kind: 'no-answer' }])).toBe('down')
})

test('a toast tells a break and a recovery, not the first probe', () => {
  expect(toastFor('unknown', 'down')).toBeUndefined()
  expect(toastFor('unknown', 'up')).toBeUndefined()
  expect(toastFor('up', 'up')).toBeUndefined()
  expect(toastFor('up', 'down')).toMatch(/stopped/)
  expect(toastFor('down', 'up')).toMatch(/again/)
  expect(toastFor('down', 'rejected')).toBeUndefined()
})

test('the footer names the link only while records are lost', () => {
  expect(alertOf('down')).toEqual({ label: 'o11y down', tone: 'error' })
  expect(alertOf('rejected')).toEqual({ label: 'o11y rejected', tone: 'warning' })
  for (const status of ['up', 'off', 'unknown', 'unprobeable'] as const) expect(alertOf(status)).toBeUndefined()
})
