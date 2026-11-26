import { expect, test } from 'claude-code/testing'

import { isUnder, normalize, shorten, writeTarget } from './core.ts'

test('only the file-writing tools have a write target', () => {
  expect(writeTarget('Edit', { file_path: '/a' })).toBe('/a')
  expect(writeTarget('NotebookEdit', { notebook_path: '/n.ipynb' })).toBe('/n.ipynb')
  expect(writeTarget('Read', { file_path: '/a' })).toBe(undefined)
  expect(writeTarget('Write', { file_path: '' })).toBe(undefined)
  expect(writeTarget('Write', null)).toBe(undefined)
})

test('a path that climbs out of the workspace is outside it', () => {
  const root = '/ws/proj'
  expect(isUnder(normalize('src/a.ts', root), [root])).toBe(true)
  expect(isUnder(normalize('../other/a.ts', root), [root])).toBe(false)
  // A sibling that shares the prefix is not under the root.
  expect(isUnder('/ws/proj-b/a.ts', [root])).toBe(false)
})

test('a path under home is shown from ~', () => {
  expect(shorten('/Users/me/.zshrc', '/Users/me')).toBe('~/.zshrc')
  expect(shorten('/Users/meow/x', '/Users/me')).toBe('/Users/meow/x')
})
