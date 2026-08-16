import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { GhRemoteService } from '../lib/remote.js'
import { ghToolCatalog } from '../lib/tools.js'

test('ghToolCatalog exposes every tool with UI-safe parameter metadata', () => {
  const catalog = ghToolCatalog()
  assert.equal(catalog.length, 33)
  const byName = new Map(catalog.map((tool) => [tool.name, tool]))
  assert.ok(byName.get('gh_issue_create').parameters.some((param) => param.key === 'title' && param.required))
  assert.ok(byName.get('gh_repo_delete').dangerous)
  assert.ok(byName.get('gh_api').apiMethodGuard)
  assert.ok(catalog.every((tool) => typeof tool.category === 'string' && Array.isArray(tool.parameters)))
})

test('GhRemoteService registers catalog, status and execute remotes', async () => {
  const root = new Context()
  const fiber = root.plugin(GhRemoteService, { ghBin: 'gh', timeoutMs: 1000, confirmDangerous: true })
  await fiber
  const service = root.gh
  assert.ok(service)
  const methods = remoteMethods(service).map((entry) => entry.method).sort()
  assert.deepEqual(methods, ['catalog', 'execute', 'status'])
  assert.deepEqual(service.catalog(), ghToolCatalog())
  fiber.dispose()
})

test('GhRemoteService.execute returns a structured gh result', async () => {
  const root = new Context()
  const fiber = root.plugin(GhRemoteService, { ghBin: process.execPath, timeoutMs: 1000, confirmDangerous: true })
  await fiber
  const service = root.gh
  // Use node itself as a stand-in gh binary: the alias tool sends two args
  // that node interprets as script paths. A missing script produces a
  // structured non-zero result rather than a thrown spawn error.
  const result = await service.execute('gh_alias_set', { alias: 'co', expansion: 'pr checkout' })
  assert.equal(result.ok, false)
  assert.equal(result.timedOut, false)
  assert.equal(typeof result.stdout, 'string')
  assert.equal(typeof result.stderr, 'string')
  fiber.dispose()
})
