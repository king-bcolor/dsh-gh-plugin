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
  assert.deepEqual(methods, ['branches', 'catalog', 'execute', 'inbox', 'profile', 'repoBranches', 'repositories', 'status'])
  assert.deepEqual(service.catalog(), ghToolCatalog())
  fiber.dispose()
})


function fakeRunner(responses) {
  return async (bin, args) => {
    const key = JSON.stringify([bin, ...args])
    if (Object.hasOwn(responses, key)) {
      const value = responses[key]
      if (value instanceof Error) throw value
      return { exitCode: 0, signal: null, timedOut: false, stdout: value.stdout ?? '', stderr: value.stderr ?? '' }
    }
    throw new Error(`unexpected command: ${key}`)
  }
}

test('GhRemoteService.repositories returns the authenticated owner repo list', async () => {
  const root = new Context()
  const responses = {}
  responses[JSON.stringify(['gh', 'api', 'user', '--jq', '.login'])] = { stdout: 'king-bcolor\n' }
  responses[JSON.stringify(['gh', 'repo', 'list', 'king-bcolor', '--json', 'nameWithOwner,description,stargazerCount,visibility,updatedAt,url,defaultBranchRef,primaryLanguage', '--limit', '100'])] = {
    stdout: JSON.stringify([{ nameWithOwner: 'king-bcolor/dsh-gh-plugin', description: 'demo', stargazerCount: 3, visibility: 'PUBLIC', updatedAt: 'now', url: 'https://github.com/king-bcolor/dsh-gh-plugin', defaultBranchRef: { name: 'main' } }]),
  }
  const fiber = root.plugin(GhRemoteService, { ghBin: 'gh', timeoutMs: 1000, run: fakeRunner(responses) })
  await fiber
  const result = await root.gh.repositories()
  assert.equal(result.ok, true)
  assert.equal(result.repositories.length, 1)
  assert.equal(result.repositories[0].defaultBranch, 'main')
  fiber.dispose()
})

test('GhRemoteService.profile returns GitHub profile and heatmap', async () => {
  const root = new Context()
  const responses = {}
  responses[JSON.stringify(['gh', 'api', 'user', '--jq', '.login'])] = { stdout: 'king-bcolor\n' }
  const graphqlKey = JSON.stringify(['gh', 'api', 'graphql', '-f', 'login=king-bcolor', '-f', 'query=query($login:String!){user(login:$login){login name avatarUrl bio url contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount color}}}}}}', '--jq', '.data.user'])
  responses[graphqlKey] = {
    stdout: JSON.stringify({ login: 'king-bcolor', name: 'king', avatarUrl: 'https://a', bio: 'builder', url: 'https://github.com/king-bcolor', contributionsCollection: { contributionCalendar: { totalContributions: 42, weeks: [{ contributionDays: [{ date: '2026-08-01', contributionCount: 3, color: '#216e39' }] }] } } }),
  }
  const fiber = root.plugin(GhRemoteService, { ghBin: 'gh', timeoutMs: 1000, run: fakeRunner(responses) })
  await fiber
  const result = await root.gh.profile()
  assert.equal(result.ok, true)
  assert.equal(result.profile.login, 'king-bcolor')
  assert.equal(result.heatmap.totalContributions, 42)
  assert.equal(result.heatmap.weeks[0].days[0].count, 3)
  fiber.dispose()
})

test('GhRemoteService.inbox and repoBranches return structured data', async () => {
  const root = new Context()
  const responses = {}
  responses[JSON.stringify(['gh', 'api', 'notifications', '--paginate'])] = {
    stdout: JSON.stringify([{ id: '1', subject: { title: 'PR review' }, repository: { full_name: 'owner/repo' }, reason: 'mention', updated_at: 'now', html_url: 'https://github.com/x' }]),
  }
  responses[JSON.stringify(['gh', 'api', 'repos/owner/repo/branches?per_page=100', '--paginate'])] = {
    stdout: JSON.stringify([{ name: 'main', commit: { sha: 'abc' }, protected: false }]),
  }
  const fiber = root.plugin(GhRemoteService, { ghBin: 'gh', timeoutMs: 1000, run: fakeRunner(responses) })
  await fiber
  const inbox = await root.gh.inbox()
  assert.equal(inbox.ok, true)
  assert.equal(inbox.notifications.length, 1)
  const branches = await root.gh.repoBranches('owner/repo')
  assert.equal(branches.ok, true)
  assert.equal(branches.branches[0].name, 'main')
  fiber.dispose()
})

test('GhRemoteService.branches parses local git for-each-ref output', async () => {
  const root = new Context()
  const responses = {}
  responses[JSON.stringify(['git', '-C', '/tmp/work', 'for-each-ref', '--format=%(refname:short)%00%(HEAD)%00%(upstream:short)%00%(upstream:track)%00%(objectname:short)%00%(subject)', 'refs/heads', 'refs/remotes'])] = {
    stdout: 'main\0*\0origin/main\0[ahead 1]\0abc123\0feat: gh ui\n',
  }
  const fiber = root.plugin(GhRemoteService, { ghBin: 'gh', gitBin: 'git', timeoutMs: 1000, run: fakeRunner(responses) })
  await fiber
  const result = await root.gh.branches('/tmp/work')
  assert.equal(result.ok, true)
  assert.equal(result.branches[0].name, 'main')
  assert.equal(result.branches[0].current, true)
  assert.equal(result.branches[0].upstream, 'origin/main')
  assert.equal(result.branches[0].commit, 'abc123')
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
