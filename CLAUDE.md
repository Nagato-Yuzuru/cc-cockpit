# cc-cockpit

cockpit is a Claude Code mod for one user. It uses the function hooks API, which is early access. Load the `plugin-authoring` skill before you change a hook.

## Architecture

The engine supplies the event chain, the state store, and the drawing surface. Do not build a second layer for these. Keep the mod thin: each abstraction of our own is one more thing to change when the engine API changes.

### Organize by feature

A feature is one interface part, for example the context window meter. Each feature has its own directory. A change to one feature touches one directory. To remove a feature, delete its directory and its line in `register.tsx`.

```
hooks/
  register.tsx          # lists the features; no logic
  features/<name>/
    core.ts             # pure calculation: event input -> model
    view.tsx            # model -> tree; no calculation
    index.ts            # wiring; exports install(on)
  shared/               # code that two or more features use
types/index.d.ts        # the $.state contract
```

A small feature can be one file.

### Rules

- A feature does not import another feature. Dependencies go from `features` to `shared` only.
- Move code to `shared/` when a second feature needs it, not before.
- `core.ts` is pure. It does not import a view, and it imports only types from `claude-code`.
- Only `index.ts` and `register.tsx` call the engine through `$`.
- Do not add a layer across surfaces, a configuration system, or a base class for parts. Use `$.ui.resolve(e)` and the manifest `userConfig`.

### State

- A value that must stay after a reload goes in `$.state`, with a declaration in `types/index.d.ts`. A reload clears module variables, so use them only as a cache.
- Each feature uses its own key prefix in the contract.
- Do not store a value that you can calculate from stored values. Calculate it during the draw.
- A value in `$.store` can come from an earlier version of the mod. Check its shape before you use it.

### Failure

- The mod must not break a session. A hook calls `next(e)` unless it answers the event on purpose. On an error, a feature draws nothing.

### Tests

- Test `core.ts` with unit tests.
- Give each feature one test that runs through `claude plugin test` and seeds stored state from an earlier version.
