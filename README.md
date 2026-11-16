# cc-cockpit

My own Claude Code mod. It is for my personal use only.

It needs Claude Code 2.1.322 or later.

## Set up

```sh
mise trust && mise install
pnpm install
pnpm dev
```

Run `pnpm dev` once before `pnpm check`: the type check and the type-aware lint rules need the engine types. CI has no interactive session, so it skips them.

`pnpm verify` runs all checks (`check`, `validate`, `test`). The pre-push hook runs it.
