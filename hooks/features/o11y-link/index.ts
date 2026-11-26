import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import { notify } from '../../shared/notice.ts'
import {
  alertOf,
  classify,
  NOT_CHECKED,
  planOf,
  PROBE_EVERY_MS,
  PROBE_TIMEOUT_MS,
  noticeFor,
  type Link,
  type OtelEnv,
  type Probe,
  type Target,
} from './core.ts'
import { view } from './view.tsx'

// v2: the status values changed; a v1 value reads as not checked.
const link = atom({ plugin: 'cockpit', key: 'o11y-link.link' } as const, NOT_CHECKED, { shape: 'v2' })

// `$.env.get` takes a literal name, so each variable is spelled out.
async function readOtelEnv($: EngineInterface): Promise<OtelEnv> {
  return {
    CLAUDE_CODE_ENABLE_TELEMETRY: await $.env.get('CLAUDE_CODE_ENABLE_TELEMETRY'),
    OTEL_METRICS_EXPORTER: await $.env.get('OTEL_METRICS_EXPORTER'),
    OTEL_LOGS_EXPORTER: await $.env.get('OTEL_LOGS_EXPORTER'),
    OTEL_TRACES_EXPORTER: await $.env.get('OTEL_TRACES_EXPORTER'),
    OTEL_EXPORTER_OTLP_PROTOCOL: await $.env.get('OTEL_EXPORTER_OTLP_PROTOCOL'),
    OTEL_EXPORTER_OTLP_METRICS_PROTOCOL: await $.env.get('OTEL_EXPORTER_OTLP_METRICS_PROTOCOL'),
    OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: await $.env.get('OTEL_EXPORTER_OTLP_LOGS_PROTOCOL'),
    OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: await $.env.get('OTEL_EXPORTER_OTLP_TRACES_PROTOCOL'),
    OTEL_EXPORTER_OTLP_ENDPOINT: await $.env.get('OTEL_EXPORTER_OTLP_ENDPOINT'),
    OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: await $.env.get('OTEL_EXPORTER_OTLP_METRICS_ENDPOINT'),
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: await $.env.get('OTEL_EXPORTER_OTLP_LOGS_ENDPOINT'),
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: await $.env.get('OTEL_EXPORTER_OTLP_TRACES_ENDPOINT'),
    OTEL_EXPORTER_OTLP_HEADERS: await $.env.get('OTEL_EXPORTER_OTLP_HEADERS'),
    OTEL_EXPORTER_OTLP_METRICS_HEADERS: await $.env.get('OTEL_EXPORTER_OTLP_METRICS_HEADERS'),
    OTEL_EXPORTER_OTLP_LOGS_HEADERS: await $.env.get('OTEL_EXPORTER_OTLP_LOGS_HEADERS'),
    OTEL_EXPORTER_OTLP_TRACES_HEADERS: await $.env.get('OTEL_EXPORTER_OTLP_TRACES_HEADERS'),
  }
}

async function probe($: EngineInterface, target: Target): Promise<Probe> {
  const timeout = $.clock.sleep(PROBE_TIMEOUT_MS).then((): Probe => ({ kind: 'no-answer' }))
  const answer = $.http.fetch(target.url, { method: 'POST', headers: { ...target.headers }, body: target.body }).then(
    (response): Probe => ({ kind: 'answered', ok: response.ok }),
    (): Probe => ({ kind: 'no-answer' }),
  )
  return Promise.race([answer, timeout])
}

async function check($: EngineInterface, targets: readonly Target[]): Promise<void> {
  const status = classify(await Promise.all(targets.map(target => probe($, target))))
  const checkedAt = await $.clock.now()
  const before = (await read($, link)).status
  await update($, link, () => ({ status, checkedAt }))
  const notice = noticeFor(before, status)
  if (notice !== undefined) await notify($, notice.level, notice.text)
}

export function install(on: On): void {
  // Only an interactive session draws the footer, so only it probes. The
  // exporter reads its settings once, at start, so the plan is made once. A
  // reload runs session.start again and drops the old timer: one timer runs.
  on('session.start', { isInteractive: true }, async ($, e, next) => {
    try {
      const plan = planOf(await readOtelEnv($))
      if (plan.kind === 'probe') {
        const tick = () => {
          check($, plan.targets).catch(() => undefined)
        }
        tick()
        $.clock.every(PROBE_EVERY_MS, tick)
      } else {
        const status = plan.kind
        await update($, link, (): Link => ({ status, checkedAt: null }))
      }
    } catch {
      // Without a probe the footer shows the last known status.
    }
    return next(e)
  })

  // The engine draws each mode label in one gray. The alert has a color of its
  // own, so the hook draws it after the engine's labels instead of adding it to
  // `modes`.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const modes = await next(e)
    try {
      const alert = alertOf((await read($, link)).status)
      if (alert === undefined) return modes
      return view($.ui.resolve(e), alert, modes, e.props.modes.length > 0)
    } catch {
      return modes
    }
  })
}
