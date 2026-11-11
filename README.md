# cc-cockpit

cockpit is a Claude Code mod. It adds interface parts to the Claude Code terminal for one user's own work. The first part is a context window meter above the prompt: a colored bar that shows how much of the window is used, how much is left before automatic compaction, and a toast when the use crosses a threshold.

The mod uses the function hooks API, which is early access. It needs Claude Code 2.1.322 or later.

## Set up

```sh
mise trust && mise install   # tools from mise.toml; also installs the git hooks
pnpm install
pnpm dev                     # loads the mod; the engine writes its types to .claude-plugin/types/
```

Run `pnpm dev` once before `pnpm check`: the type check and the type-aware lint rules need the engine types. CI has no interactive session, so it skips them.

`pnpm verify` runs all checks (`check`, `validate`, `test`). The pre-push hook runs it.
