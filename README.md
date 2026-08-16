# dsh-gh-plugin

> **中文文档**：[README.zh-CN.md](./README.zh-CN.md)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that wraps the [GitHub CLI (`gh`)](https://cli.github.com) as model-callable tools.

## What it is
`dsh-gh-plugin` exposes GitHub operations to DSH agents: repositories, issues, pull requests, search, Actions, releases, and the GitHub API — all through structured JSON-backed tools.

## Features
- Browser settings page **GitHub**: auth status, generic forms for every `gh_*` tool, confirmations, and JSON/text results.
- Auth status and login guidance.
- Repository create/view/list/edit/delete with topic management.
- Issue create/list/view/close/reopen/comment/edit.
- Pull request create/list/view/merge/checkout/review.
- Search repos/issues/prs/code.
- Actions workflow/run views; release create/list/view.
- Raw `gh api` tool for advanced use.
- Dangerous operations require explicit confirmation.

## Use cases
- Ask the agent to list open issues and summarize them.
- Create an issue or PR from a conversation.
- Search GitHub for repositories matching a topic.
- Check CI run status and logs.
- Create a release with generated notes.

See [docs/用例目录/README.md](./docs/用例目录/README.md) for the full command/use-case/parameter catalog (Chinese).

## Installation
### Preconditions
- Node.js 22+, `dsh` CLI installed.
- `gh` installed and authenticated (`gh auth login`).

### Install from GitHub
```bash
dsh plugin --profile default add github:<owner>/dsh-gh-plugin
# allowlist build in $DSH_HOME/profiles/default/pnpm-workspace.yaml if requested
```

### Install locally
```bash
git clone https://github.com/<owner>/dsh-gh-plugin.git
cd dsh-gh-plugin
dsh plugin --profile default add .
```

## Usage
```bash
dsh --profile default
# or: dsh web
```
Open **Settings → GitHub** to run every gh tool from the browser UI.

Example prompts:
- `Use gh_issue_list to list open issues in this repo.`
- `Search GitHub for dsh-plugin repositories sorted by stars.`

## Configuration
```yaml
- id: gh
  name: dsh-gh-plugin
  config:
    ghBin: /usr/local/bin/gh
    timeoutMs: 30000
    confirmDangerous: true
```

## Development
TDD is mandatory:
```bash
pnpm install
npm test
```

## License
MIT
