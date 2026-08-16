import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runGh, parseJsonOutput } from '../lib/runner.js'

async function makeFakeGh(t, { argsFile } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-gh-runner-'))
  t.after(() => import('node:fs/promises').then(fs => fs.rm(dir, { recursive: true, force: true })))
  const script = `#!/bin/sh
if [ -n "$FAKE_GH_ARGS_FILE" ]; then printf '%s\\n' "$@" > "$FAKE_GH_ARGS_FILE"; fi
if [ -n "$FAKE_GH_STDOUT" ]; then printf '%s' "$FAKE_GH_STDOUT"; fi
if [ -n "$FAKE_GH_STDERR" ]; then printf '%s' "$FAKE_GH_STDERR" >&2; fi
if [ -n "$FAKE_GH_SLEEP_SECONDS" ]; then sleep "$FAKE_GH_SLEEP_SECONDS"; fi
exit "\${FAKE_GH_EXIT_CODE:-0}"
`
  const bin = join(dir, 'gh')
  await writeFile(bin, script)
  await chmod(bin, 0o755)
  return bin
}

test('runGh resolves stdout, stderr and exit code for successful command', async (t) => {
  const bin = await makeFakeGh(t)
  const result = await runGh(bin, ['auth', 'status'], {
    env: { ...process.env, FAKE_GH_STDOUT: 'ok', FAKE_GH_STDERR: 'warn' },
    timeoutMs: 5000,
  })
  assert.equal(result.exitCode, 0)
  assert.equal(result.timedOut, false)
  assert.equal(result.stdout, 'ok')
  assert.equal(result.stderr, 'warn')
  assert.equal(result.signal, null)
})

test('runGh passes args as an array (no shell quoting)', async (t) => {
  const argsFile = join(await mkdtemp(join(tmpdir(), 'dsh-gh-args-')), 'args.txt')
  t.after(() => import('node:fs/promises').then(fs => fs.rm(argsFile, { force: true })))
  const bin = await makeFakeGh(t)
  await runGh(bin, ['repo', 'view', 'owner/repo', '--json', 'name,description'], {
    env: { ...process.env, FAKE_GH_ARGS_FILE: argsFile },
    timeoutMs: 5000,
  })
  const recorded = (await readFile(argsFile, 'utf8')).trim().split('\n')
  assert.deepEqual(recorded, ['repo', 'view', 'owner/repo', '--json', 'name,description'])
})

test('runGh resolves non-zero exit instead of throwing', async (t) => {
  const bin = await makeFakeGh(t)
  const result = await runGh(bin, ['repo', 'view', 'owner/repo'], {
    env: { ...process.env, FAKE_GH_EXIT_CODE: '4', FAKE_GH_STDERR: 'auth required' },
    timeoutMs: 5000,
  })
  assert.equal(result.exitCode, 4)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'auth required')
})

test('runGh times out and kills the process', async (t) => {
  const bin = await makeFakeGh(t)
  const result = await runGh(bin, ['repo', 'list'], {
    env: { ...process.env, FAKE_GH_SLEEP_SECONDS: '5' },
    timeoutMs: 100,
  })
  assert.equal(result.timedOut, true)
  assert.equal(result.exitCode, null)
})

test('runGh rejects with GH_NOT_FOUND when gh is missing', async () => {
  await assert.rejects(
    runGh(join(tmpdir(), 'definitely-missing-gh-binary'), ['auth', 'status'], { timeoutMs: 500 }),
    (error) => {
      assert.equal(error.code, 'GH_NOT_FOUND')
      assert.match(error.message, /gh/i)
      return true
    },
  )
})

test('parseJsonOutput parses JSON stdout and returns undefined for plain text', () => {
  assert.deepEqual(parseJsonOutput('{"a":1}'), { a: 1 })
  assert.deepEqual(parseJsonOutput('[{"b":2}]'), [{ b: 2 }])
  assert.equal(parseJsonOutput('open\t12\n'), undefined)
})
