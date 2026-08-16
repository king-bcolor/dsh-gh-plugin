# AGENTS.md — dsh-gh-plugin

This directory is a DeepSeek Harness plugin workspace (bundle).

## Layout
- `package.json` — npm package manifest with `dsh.bundle.patch` pointing to `cordis.patch.yml`
- `cordis.patch.yml` — bundle patch inserted into a DSH profile
- `index.js` — Cordis plugin entry (`name`, `inject`, `Config`, `apply`)
- `lib/runner.js` — gh child-process runner (argv only, timeout, JSON parsing)
- `lib/tools.js` — `gh_*` tool definitions and argument mapping
- `test/` — node:test tests with fake `gh` fixtures; run with `npm test`
- `docs/` — use-case, requirements, UI, implementation (TDD), submission docs

## Commands
```bash
npm test
DSH_HOME=$PWD/.dsh-test dsh --profile demo --dump-config
dsh plugin --profile <name> add .
```

## Rules
- Keep the workspace a valid installable bundle.
- Follow TDD: write a failing test before implementing each tool.
- Spawn `gh` with an argv array only — never through a shell string.
- Never commit credentials or login state; never log `GH_TOKEN` values.
