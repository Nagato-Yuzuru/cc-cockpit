import { describe, expect, test } from 'claude-code/testing'

import { isSupportedEngine } from '../hooks/core/version.ts'

describe('isSupportedEngine', () => {
  test('accepts the minimum and later versions', () => {
    expect(isSupportedEngine('2.1.322', '2.1.322')).toBe(true)
    expect(isSupportedEngine('2.2.0', '2.1.322')).toBe(true)
  })

  test('rejects an earlier version', () => {
    expect(isSupportedEngine('2.1.321', '2.1.322')).toBe(false)
  })

  test('counts a development build as its release', () => {
    expect(isSupportedEngine('2.1.322-dev', '2.1.322')).toBe(true)
  })

  test('rejects a version that does not parse', () => {
    expect(isSupportedEngine('unknown', '2.1.322')).toBe(false)
  })
})
