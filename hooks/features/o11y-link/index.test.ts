import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { PROBE_EVERY_MS, PROBE_TIMEOUT_MS } from './core.ts'

// What the footer draws about the link: the alert's text and color, and
// whether the engine's own labels stay in the tree in front of it.
const footerOn = async ($: Engine, surface: 'terminal' | 'desktop', modes: readonly string[] = []) => {
  const ui = await $.ui.mount({ plugin: 'cockpit', component: 'SessionMode', surface, props: { modes } })
  const alert = await ui.find({ type: 'Text', text: /o11y/ })
  const separator = await ui.find({ type: 'Text', text: ' & ' })
  const isKept = await ui.keepsBeneath()
  await ui.unmount()
  if (alert === undefined) return { isKept }
  return { alert: alert.text, color: alert.props.color, hasSeparator: separator !== undefined, isKept }
}

const NONE = { isKept: true }
const DOWN = { alert: 'o11y down', color: 'error', hasSeparator: false, isKept: true }

// The shape of the user's own settings: every signal over OTLP/HTTP to a local receiver.
const OTEL = {
  CLAUDE_CODE_ENABLE_TELEMETRY: '1',
  OTEL_METRICS_EXPORTER: 'otlp',
  OTEL_LOGS_EXPORTER: 'otlp',
  OTEL_TRACES_EXPORTER: 'otlp',
  OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
}

test('the footer ignores an earlier link, probes each signal endpoint, and names a break', async ($, on) => {
  // The v1 mod stored a status v2 no longer has.
  let isSeeded = true
  on('state.get', { key: 'o11y-link.link' }, (_, e, next) => {
    if (!isSeeded) return next(e)
    isSeeded = false
    return { value: { value: { shape: 'v1', value: { status: 'not-ready', checkedAt: 1 } }, version: 1 } }
  })
  const clock = mock.clock(on, { now: 1000 })
  mock.env(on, OTEL)
  const requests: string[] = []
  let isRunning = true
  on('http.fetch', (_, e) => {
    requests.push(`${e.init?.method} ${e.url} ${e.init?.headers?.['content-type']} ${JSON.stringify(e.init?.body)}`)
    if (!isRunning) throw new Error('connection refused')
    return { value: { status: 200, ok: true, headers: {}, text: '' } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  for (const surface of ['terminal', 'desktop'] as const) expect(await footerOn($, surface)).toEqual(NONE)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(requests).toEqual([
    'POST http://localhost:4318/v1/metrics application/x-protobuf ""',
    'POST http://localhost:4318/v1/logs application/x-protobuf ""',
    'POST http://localhost:4318/v1/traces application/x-protobuf ""',
  ])
  for (const surface of ['terminal', 'desktop'] as const) expect(await footerOn($, surface)).toEqual(NONE)
  expect(toasts).toEqual([])

  isRunning = false
  await clock.advance(PROBE_EVERY_MS)
  for (const surface of ['terminal', 'desktop'] as const) expect(await footerOn($, surface)).toEqual(DOWN)
  expect(toasts).toHaveLength(1)
})

test('with telemetry off, the footer names nothing and nothing is probed', async ($, on) => {
  mock.env(on, {})
  const urls: string[] = []
  on('http.fetch', (_, e) => {
    urls.push(e.url)
    return { value: { status: 200, ok: true, headers: {}, text: '' } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(await footerOn($, 'terminal')).toEqual(NONE)
  expect(urls).toEqual([])
})

test('a gRPC exporter is not probed, and the footer names nothing', async ($, on) => {
  mock.env(on, { ...OTEL, OTEL_EXPORTER_OTLP_PROTOCOL: 'grpc', OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4317' })
  const urls: string[] = []
  on('http.fetch', (_, e) => {
    urls.push(e.url)
    return { value: { status: 200, ok: true, headers: {}, text: '' } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(await footerOn($, 'terminal')).toEqual(NONE)
  expect(urls).toEqual([])
})

test('a collector that never answers is named down once the probe times out', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  mock.env(on, OTEL)
  // A port that takes the connection and never replies.
  on('http.fetch', () => new Promise<never>(() => undefined))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(PROBE_TIMEOUT_MS - 1)
  expect(await footerOn($, 'terminal')).toEqual(NONE)

  await clock.advance(1)
  expect(await footerOn($, 'terminal')).toEqual(DOWN)
})

test('the footer keeps the engine modes and names the link after them', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  mock.env(on, OTEL)
  on('http.fetch', () => ({ value: { status: 503, ok: false, headers: {}, text: '' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(await footerOn($, 'terminal', ['focus'])).toEqual({ alert: 'o11y rejected', color: 'warning', hasSeparator: true, isKept: true })
})
