import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, chmod, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildTools } from '../lib/tools.js'

async function makeFakeGh(t) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gh-integration-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const bin = join(dir, 'gh')
  const script = `#!/bin/sh
if [ -n "$FAKE_GH_ARGS_FILE" ]; then printf '%s\\n' "$@" > "$FAKE_GH_ARGS_FILE"; fi
if [ -n "$FAKE_GH_STDOUT" ]; then printf '%s' "$FAKE_GH_STDOUT"; fi
if [ -n "$FAKE_GH_STDERR" ]; then printf '%s' "$FAKE_GH_STDERR" >&2; fi
if [ -n "$FAKE_GH_SLEEP_SECONDS" ]; then sleep "$FAKE_GH_SLEEP_SECONDS"; fi
exit "\${FAKE_GH_EXIT_CODE:-0}"
`
  await writeFile(bin, script)
  await chmod(bin, 0o755)
  return bin
}

function findTool(config, name) {
  return buildTools(config).find((tool) => tool.name === name)
}

test('gh_repo_list parses gh --json output into parsed data', async (t) => {
  const ghBin = await makeFakeGh(t)
  process.env.FAKE_GH_STDOUT = JSON.stringify([{ nameWithOwner: 'owner/repo', description: 'demo' }])
  t.after(() => { delete process.env.FAKE_GH_STDOUT })
  const tool = findTool({ ghBin }, 'gh_repo_list')
  const result = await tool.execute({ owner: 'owner', limit: 5 }, {})
  assert.equal(result.ok, true)
  assert.deepEqual(result.parsed, [{ nameWithOwner: 'owner/repo', description: 'demo' }])
  assert.equal(result.command, 'gh repo list owner --json nameWithOwner,description,stargazerCount,visibility,updatedAt,url --limit 5')
})

test('gh_auth_status maps gh exit code 4 to an authentication notice', async (t) => {
  const ghBin = await makeFakeGh(t)
  process.env.FAKE_GH_EXIT_CODE = '4'
  process.env.FAKE_GH_STDERR = 'You are not logged into any GitHub hosts.'
  t.after(() => {
    delete process.env.FAKE_GH_EXIT_CODE
    delete process.env.FAKE_GH_STDERR
  })
  const tool = findTool({ ghBin }, 'gh_auth_status')
  const result = await tool.execute({}, {})
  assert.equal(result.ok, false)
  assert.equal(result.exitCode, 4)
  assert.match(result.notice, /gh auth login/)
  assert.equal(result.parsed, null)
})

test('gh_run_view log mode omits --json and returns text', async (t) => {
  const argsFile = join(await mkdtemp(join(tmpdir(), 'dsh-gh-run-log-')), 'args.txt')
  t.after(() => rm(argsFile, { force: true }))
  const ghBin = await makeFakeGh(t)
  process.env.FAKE_GH_ARGS_FILE = argsFile
  process.env.FAKE_GH_STDOUT = 'step log line'
  t.after(() => {
    delete process.env.FAKE_GH_ARGS_FILE
    delete process.env.FAKE_GH_STDOUT
  })
  const tool = findTool({ ghBin }, 'gh_run_view')
  const result = await tool.execute({ repo: 'owner/repo', runId: 123, log: true }, {})
  const args = (await readFile(argsFile, 'utf8')).trim().split('\n').filter(Boolean)
  assert.deepEqual(args, ['run', 'view', '123', '-R', 'owner/repo', '--log'])
  assert.equal(result.parsed, null)
  assert.equal(result.stdout, 'step log line')
})

test('confirmDangerous: false allows gh_repo_delete without confirm', async (t) => {
  const argsFile = join(await mkdtemp(join(tmpdir(), 'dsh-gh-confirm-off-')), 'args.txt')
  t.after(() => rm(argsFile, { force: true }))
  const ghBin = await makeFakeGh(t)
  process.env.FAKE_GH_ARGS_FILE = argsFile
  t.after(() => { delete process.env.FAKE_GH_ARGS_FILE })
  const tool = findTool({ ghBin, confirmDangerous: false }, 'gh_repo_delete')
  const result = await tool.execute({ repo: 'owner/repo' }, {})
  assert.equal(result.ok, true)
  const args = (await readFile(argsFile, 'utf8')).trim().split('\n').filter(Boolean)
  assert.deepEqual(args, ['repo', 'delete', 'owner/repo', '--yes'])
})

test('timeout is surfaced as a structured result', async (t) => {
  const ghBin = await makeFakeGh(t)
  process.env.FAKE_GH_SLEEP_SECONDS = '5'
  t.after(() => { delete process.env.FAKE_GH_SLEEP_SECONDS })
  const tool = findTool({ ghBin, timeoutMs: 100 }, 'gh_repo_list')
  const result = await tool.execute({ owner: 'owner' }, {})
  assert.equal(result.ok, false)
  assert.equal(result.timedOut, true)
  assert.equal(result.exitCode, null)
  assert.match(result.notice, /timeout|超时/)
})

test('render includes gh stderr warnings even when parsed JSON is present', async (t) => {
  const ghBin = await makeFakeGh(t)
  process.env.FAKE_GH_STDOUT = JSON.stringify([{ nameWithOwner: 'owner/repo' }])
  process.env.FAKE_GH_STDERR = 'warning: token has no repo scope'
  t.after(() => {
    delete process.env.FAKE_GH_STDOUT
    delete process.env.FAKE_GH_STDERR
  })
  const tool = findTool({ ghBin }, 'gh_repo_list')
  const result = await tool.execute({ owner: 'owner' }, {})
  const [block] = tool.output.render({}, result)
  assert.ok(block.text.includes('[stderr]'))
  assert.ok(block.text.includes('warning: token has no repo scope'))
  assert.ok(block.text.includes('"nameWithOwner"'))
})
