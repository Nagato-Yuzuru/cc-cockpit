const WRITE_TOOLS: Record<string, string> = { Edit: 'file_path', Write: 'file_path', NotebookEdit: 'notebook_path' }

// The path a file-writing tool call targets, or undefined for any other call.
export function writeTarget(tool: string, input: unknown): string | undefined {
  const field = WRITE_TOOLS[tool]
  if (field === undefined || typeof input !== 'object' || input === null) return undefined
  const value: unknown = Reflect.get(input, field)
  return typeof value === 'string' && value !== '' ? value : undefined
}

// Lexical: '.' and '..' collapse as the file tools collapse them. Symbolic
// links are not followed.
export function normalize(path: string, cwd: string): string {
  const out: string[] = []
  for (const part of (path.startsWith('/') ? path : `${cwd}/${path}`).split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return `/${out.join('/')}`
}

export function isUnder(path: string, roots: readonly string[]): boolean {
  return roots.some(root => path === root || path.startsWith(root.endsWith('/') ? root : `${root}/`))
}

// '/Users/me/x' -> '~/x', so a notice keeps the part that differs.
export function shorten(path: string, home: string | undefined): string {
  return home !== undefined && isUnder(path, [home]) ? `~${path.slice(home.length)}` : path
}
