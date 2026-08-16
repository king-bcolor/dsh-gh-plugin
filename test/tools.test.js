import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, chmod, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildTools } from '../lib/tools.js'

async function makeFakeGh(t) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gh-tools-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const bin = join(dir, 'gh')
  const script = `#!/bin/sh
if [ -n "$FAKE_GH_ARGS_FILE" ]; then printf '%s\\n' "$@" > "$FAKE_GH_ARGS_FILE"; fi
if [ -n "$FAKE_GH_STDOUT" ]; then printf '%s' "$FAKE_GH_STDOUT"; fi
if [ -n "$FAKE_GH_STDERR" ]; then printf '%s' "$FAKE_GH_STDERR" >&2; fi
exit "\${FAKE_GH_EXIT_CODE:-0}"
`
  await writeFile(bin, script)
  await chmod(bin, 0o755)
  return bin
}


test('every registered tool executes with its minimal valid arguments', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gh-tool-smoke-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const ghBin = await makeFakeGh(t)
  const tools = buildTools({ ghBin, timeoutMs: 2000 })
  const cases = [
    ['gh_auth_status', {}],
    ['gh_repo_create', { name: 'demo' }],
    ['gh_repo_view', { repo: 'owner/repo' }],
    ['gh_repo_list', {}],
    ['gh_repo_edit', { repo: 'owner/repo' }],
    ['gh_repo_delete', { repo: 'owner/repo', confirm: true }],
    ['gh_issue_create', { repo: 'owner/repo', title: 'title' }],
    ['gh_issue_list', { repo: 'owner/repo' }],
    ['gh_issue_view', { repo: 'owner/repo', issue: 1 }],
    ['gh_issue_edit', { repo: 'owner/repo', issue: 1 }],
    ['gh_issue_close', { repo: 'owner/repo', issue: 1 }],
    ['gh_issue_reopen', { repo: 'owner/repo', issue: 1 }],
    ['gh_issue_comment', { repo: 'owner/repo', issue: 1, body: 'body' }],
    ['gh_pr_create', { repo: 'owner/repo', title: 'title' }],
    ['gh_pr_list', { repo: 'owner/repo' }],
    ['gh_pr_view', { repo: 'owner/repo', pr: 1 }],
    ['gh_pr_merge', { repo: 'owner/repo', pr: 1, confirm: true }],
    ['gh_pr_review', { repo: 'owner/repo', pr: 1, decision: 'approve' }],
    ['gh_pr_checkout', { repo: 'owner/repo', pr: 1 }],
    ['gh_pr_close', { repo: 'owner/repo', pr: 1 }],
    ['gh_pr_reopen', { repo: 'owner/repo', pr: 1 }],
    ['gh_search_repos', { query: 'deepseek' }],
    ['gh_search_issues', { query: 'bug' }],
    ['gh_search_prs', { query: 'fix' }],
    ['gh_search_code', { query: 'defineTool' }],
    ['gh_workflow_list', { repo: 'owner/repo' }],
    ['gh_run_list', { repo: 'owner/repo' }],
    ['gh_run_view', { repo: 'owner/repo', runId: 1 }],
    ['gh_release_create', { repo: 'owner/repo', tag: 'v0.1.0' }],
    ['gh_release_list', { repo: 'owner/repo' }],
    ['gh_release_view', { repo: 'owner/repo', tag: 'v0.1.0' }],
    ['gh_api', { path: 'repos/owner/repo' }],
    ['gh_alias_set', { alias: 'co', expansion: 'pr checkout' }],
  ]
  const byName = new Map(tools.map((tool) => [tool.name, tool]))
  for (const [name, args] of cases) {
    const tool = byName.get(name)
    assert.ok(tool, `missing smoke-case tool ${name}`)
    const result = await tool.execute(args, {})
    assert.equal(result.ok, true, `${name} should succeed with minimal args`)
    assert.equal(result.exitCode, 0, `${name} exit code`)
  }
})
test('buildTools registers one tool per gh command with unique names', () => {
  const tools = buildTools()
  const names = tools.map((tool) => tool.name)
  assert.equal(new Set(names).size, names.length)
  for (const name of [
    'gh_auth_status', 'gh_repo_create', 'gh_repo_view', 'gh_repo_list', 'gh_repo_edit', 'gh_repo_delete',
    'gh_issue_create', 'gh_issue_list', 'gh_issue_view', 'gh_issue_edit', 'gh_issue_close', 'gh_issue_reopen', 'gh_issue_comment',
    'gh_pr_create', 'gh_pr_list', 'gh_pr_view', 'gh_pr_merge', 'gh_pr_review', 'gh_pr_checkout', 'gh_pr_close', 'gh_pr_reopen',
    'gh_search_repos', 'gh_search_issues', 'gh_search_prs', 'gh_search_code',
    'gh_workflow_list', 'gh_run_list', 'gh_run_view', 'gh_release_create', 'gh_release_list', 'gh_release_view', 'gh_api',
    'gh_alias_set',
  ]) {
    assert.ok(names.includes(name), `expected tool ${name}`)
  }
})

test('gh_auth_status uses --json hosts and never --show-token', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gh-auth-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const argsFile = join(dir, 'args.txt')
  const ghBin = await makeFakeGh(t)
  const tool = buildTools({ ghBin }).find((entry) => entry.name === 'gh_auth_status')
  process.env.FAKE_GH_ARGS_FILE = argsFile
  t.after(() => { delete process.env.FAKE_GH_ARGS_FILE })
  const result = await tool.execute({}, {})
  const args = (await readFile(argsFile, 'utf8')).trim().split('\n').filter(Boolean)
  assert.ok(result.ok)
  assert.deepEqual(args, ['auth', 'status', '--json', 'hosts'])
  assert.ok(!args.includes('--show-token'))
})

test('gh_issue_create maps repo, title, body and repeated labels', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gh-issue-create-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const argsFile = join(dir, 'args.txt')
  const ghBin = await makeFakeGh(t)
  const tool = buildTools({ ghBin }).find((entry) => entry.name === 'gh_issue_create')
  process.env.FAKE_GH_ARGS_FILE = argsFile
  t.after(() => { delete process.env.FAKE_GH_ARGS_FILE })
  const result = await tool.execute({
    repo: 'owner/repo', title: 'bug', body: 'it broke', labels: ['bug', 'urgent'],
  }, {})
  const args = (await readFile(argsFile, 'utf8')).trim().split('\n').filter(Boolean)
  assert.ok(result.ok)
  assert.deepEqual(args, [
    'issue', 'create', '-R', 'owner/repo',
    '--title', 'bug', '--body', 'it broke', '--label', 'bug', '--label', 'urgent',
  ])
})


test('gh_repo_edit visibility requires acknowledgement and uses --visibility', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gh-repo-edit-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const argsFile = join(dir, 'args.txt')
  const ghBin = await makeFakeGh(t)
  const tool = buildTools({ ghBin, confirmDangerous: true }).find((entry) => entry.name === 'gh_repo_edit')
  await assert.rejects(tool.execute({ repo: 'owner/repo', visibility: 'private' }, {}), /acceptVisibilityChange: true/)
  process.env.FAKE_GH_ARGS_FILE = argsFile
  t.after(() => { delete process.env.FAKE_GH_ARGS_FILE })
  const result = await tool.execute({ repo: 'owner/repo', visibility: 'private', acceptVisibilityChange: true }, {})
  const args = (await readFile(argsFile, 'utf8')).trim().split('\n').filter(Boolean)
  assert.ok(result.ok)
  assert.deepEqual(args, [
    'repo', 'edit', 'owner/repo', '--visibility', 'private',
    '--accept-visibility-change-consequences',
  ])
})
test('gh_repo_delete refuses without confirm when confirmDangerous is enabled', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gh-repo-delete-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const argsFile = join(dir, 'args.txt')
  const ghBin = await makeFakeGh(t)
  const tool = buildTools({ ghBin, confirmDangerous: true }).find((entry) => entry.name === 'gh_repo_delete')
  await assert.rejects(tool.execute({ repo: 'owner/repo', confirm: false }, {}), /confirm: true/)
})

test('gh_repo_delete adds --yes when confirm is true', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gh-repo-delete-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const argsFile = join(dir, 'args.txt')
  const ghBin = await makeFakeGh(t)
  const tool = buildTools({ ghBin, confirmDangerous: true }).find((entry) => entry.name === 'gh_repo_delete')
  process.env.FAKE_GH_ARGS_FILE = argsFile
  t.after(() => { delete process.env.FAKE_GH_ARGS_FILE })
  const result = await tool.execute({ repo: 'owner/repo', confirm: true }, {})
  const args = (await readFile(argsFile, 'utf8')).trim().split('\n').filter(Boolean)
  assert.ok(result.ok)
  assert.deepEqual(args, ['repo', 'delete', 'owner/repo', '--yes'])
})


test('gh_api GET does not require confirm and omits -X', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gh-api-get-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const argsFile = join(dir, 'args.txt')
  const ghBin = await makeFakeGh(t)
  const tool = buildTools({ ghBin }).find((entry) => entry.name === 'gh_api')
  process.env.FAKE_GH_ARGS_FILE = argsFile
  t.after(() => { delete process.env.FAKE_GH_ARGS_FILE })
  const result = await tool.execute({ path: 'repos/owner/repo' }, {})
  const args = (await readFile(argsFile, 'utf8')).trim().split('\n').filter(Boolean)
  assert.ok(result.ok)
  assert.deepEqual(args, ['api', 'repos/owner/repo'])
})
test('gh_api defaults to GET and requires confirm for write methods', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gh-api-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const argsFile = join(dir, 'args.txt')
  const ghBin = await makeFakeGh(t)
  const tool = buildTools({ ghBin, confirmDangerous: true }).find((entry) => entry.name === 'gh_api')
  await assert.rejects(tool.execute({ path: 'repos/owner/repo', method: 'POST', confirm: false }, {}), /confirm: true/)
})

test('gh_api maps method, path, jq, field and raw-field', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gh-api-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const argsFile = join(dir, 'args.txt')
  const ghBin = await makeFakeGh(t)
  const tool = buildTools({ ghBin, confirmDangerous: true }).find((entry) => entry.name === 'gh_api')
  process.env.FAKE_GH_ARGS_FILE = argsFile
  t.after(() => { delete process.env.FAKE_GH_ARGS_FILE })
  const result = await tool.execute({
    path: 'repos/owner/repo', method: 'POST', confirm: true,
    jq: '.full_name', field: ['name=value'], rawField: ['q=hello world'],
  }, {})
  const args = (await readFile(argsFile, 'utf8')).trim().split('\n').filter(Boolean)
  assert.ok(result.ok)
  assert.deepEqual(args, [
    'api', 'repos/owner/repo', '-X', 'POST', '--jq', '.full_name',
    '-F', 'name=value', '-f', 'q=hello world',
  ])
})

test('gh_pr_merge requires confirm and maps merge method and delete-branch', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gh-pr-merge-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const argsFile = join(dir, 'args.txt')
  const ghBin = await makeFakeGh(t)
  const tool = buildTools({ ghBin, confirmDangerous: true }).find((entry) => entry.name === 'gh_pr_merge')
  await assert.rejects(tool.execute({ repo: 'owner/repo', pr: 123, method: 'squash', deleteBranch: true, confirm: false }, {}), /confirm: true/)
  process.env.FAKE_GH_ARGS_FILE = argsFile
  t.after(() => { delete process.env.FAKE_GH_ARGS_FILE })
  const result = await tool.execute({ repo: 'owner/repo', pr: 123, method: 'squash', deleteBranch: true, confirm: true }, {})
  const args = (await readFile(argsFile, 'utf8')).trim().split('\n').filter(Boolean)
  assert.ok(result.ok)
  assert.deepEqual(args, ['pr', 'merge', '123', '-R', 'owner/repo', '--squash', '--delete-branch'])
})

test('gh_release_create maps tag, title, notes and generate-notes', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gh-release-create-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const argsFile = join(dir, 'args.txt')
  const ghBin = await makeFakeGh(t)
  const tool = buildTools({ ghBin }).find((entry) => entry.name === 'gh_release_create')
  process.env.FAKE_GH_ARGS_FILE = argsFile
  t.after(() => { delete process.env.FAKE_GH_ARGS_FILE })
  const result = await tool.execute({ repo: 'owner/repo', tag: 'v0.1.0', title: 'v0.1.0', notes: 'release', generateNotes: true }, {})
  const args = (await readFile(argsFile, 'utf8')).trim().split('\n').filter(Boolean)
  assert.ok(result.ok)
  assert.deepEqual(args, [
    'release', 'create', 'v0.1.0', '-R', 'owner/repo',
    '--title', 'v0.1.0', '--notes', 'release', '--generate-notes',
  ])
})

test('gh_issue_edit maps title, body, add-labels and remove-labels', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gh-issue-edit-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const argsFile = join(dir, 'args.txt')
  const ghBin = await makeFakeGh(t)
  const tool = buildTools({ ghBin }).find((entry) => entry.name === 'gh_issue_edit')
  process.env.FAKE_GH_ARGS_FILE = argsFile
  t.after(() => { delete process.env.FAKE_GH_ARGS_FILE })
  const result = await tool.execute({
    repo: 'owner/repo', issue: 42, title: 'new title', body: 'new body',
    addLabels: ['bug'], removeLabels: ['wontfix'],
  }, {})
  const args = (await readFile(argsFile, 'utf8')).trim().split('\n').filter(Boolean)
  assert.ok(result.ok)
  assert.deepEqual(args, [
    'issue', 'edit', '42', '-R', 'owner/repo',
    '--title', 'new title', '--body', 'new body',
    '--add-label', 'bug', '--remove-label', 'wontfix',
  ])
})

test('gh_pr_checkout maps pr and checkout options', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gh-pr-checkout-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const argsFile = join(dir, 'args.txt')
  const ghBin = await makeFakeGh(t)
  const tool = buildTools({ ghBin }).find((entry) => entry.name === 'gh_pr_checkout')
  process.env.FAKE_GH_ARGS_FILE = argsFile
  t.after(() => { delete process.env.FAKE_GH_ARGS_FILE })
  const result = await tool.execute({ repo: 'owner/repo', pr: 123, branch: 'review-123', force: true }, {})
  const args = (await readFile(argsFile, 'utf8')).trim().split('\n').filter(Boolean)
  assert.ok(result.ok)
  assert.deepEqual(args, ['pr', 'checkout', '123', '-R', 'owner/repo', '--branch', 'review-123', '--force'])
})

test('gh_release_view uses --json with release fields', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gh-release-view-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const argsFile = join(dir, 'args.txt')
  const ghBin = await makeFakeGh(t)
  const tool = buildTools({ ghBin }).find((entry) => entry.name === 'gh_release_view')
  process.env.FAKE_GH_ARGS_FILE = argsFile
  t.after(() => { delete process.env.FAKE_GH_ARGS_FILE })
  const result = await tool.execute({ repo: 'owner/repo', tag: 'v0.1.0' }, {})
  const args = (await readFile(argsFile, 'utf8')).trim().split('\n').filter(Boolean)
  assert.ok(result.ok)
  assert.deepEqual(args, ['release', 'view', 'v0.1.0', '-R', 'owner/repo', '--json', 'tagName,name,body,isDraft,isPrerelease,publishedAt,url,author'])
})
