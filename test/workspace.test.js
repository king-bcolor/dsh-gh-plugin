import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

test('dsh-gh-plugin workspace is a valid DSH bundle', async () => {
  const pkg = require('../package.json')
  assert.equal(pkg.name, 'dsh-gh-plugin')
  assert.equal(pkg.type, 'module')
  assert.equal(pkg.main, 'index.js')
  assert.deepEqual(pkg.dsh, { bundle: { patch: './cordis.patch.yml' } })
  assert.ok(pkg.files.includes('index.js'))
  assert.ok(pkg.files.includes('cordis.patch.yml'))
})

test('dsh-gh-plugin cordis.patch.yml inserts the plugin row', async () => {
  const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
  assert.ok(patch.includes('id: gh'))
  assert.ok(patch.includes('name: dsh-gh-plugin'))
})

test('dsh-gh-plugin entry exports name, inject and apply', async () => {
  const mod = await import('../index.js')
  assert.equal(typeof mod.name, 'string')
  assert.equal(typeof mod.apply, 'function')
  assert.ok(Array.isArray(mod.inject))
  assert.ok(mod.inject.includes('tools'))
  assert.ok(['function', 'object'].includes(typeof mod.Config))
})

test('dsh-gh-plugin apply registers every gh tool', async () => {
  const mod = await import('../index.js')
  const registered = []
  mod.apply({ tools: { register(tool) { registered.push(tool.name) } } })
  assert.ok(registered.includes('gh_auth_status'))
  assert.ok(registered.includes('gh_repo_create'))
  assert.ok(registered.includes('gh_api'))
})
