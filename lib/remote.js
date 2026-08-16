/**
 * Host Remote service (`ctx.gh`) used by the browser settings page.
 *
 * The service is registered through Cordis with a TypertRemote binding, so
 * the web client can call `ctx.remote.gh.catalog()`, `status()`, and
 * `execute()` directly. No shell or token data ever crosses this boundary.
 */

import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { buildTools, ghToolCatalog } from './tools.js'
import { runGh, parseJsonOutput } from './runner.js'

/**
 * Apply a `Remote(name)` marker without TypeScript decorator support.
 * @param {Function} serviceClass
 * @param {string} method
 * @param {string} [exportName]
 */
export function markRemoteMethod(serviceClass, method, exportName = method) {
  const instance = Object.create(serviceClass.prototype)
  const decorate = Remote(exportName)
  decorate(undefined, {
    kind: 'method',
    name: method,
    static: false,
    private: false,
    addInitializer(fn) {
      fn.call(instance)
    },
  })
}

export class GhRemoteService extends TypertRemoteService {
  static inject = []

  constructor(ctx, config = {}) {
    super(ctx, 'gh')
    this.ghBin = config.ghBin ?? 'gh'
    this.gitBin = config.gitBin ?? 'git'
    this.timeoutMs = config.timeoutMs ?? 30000
    this.run = config.run ?? ((bin, args) => runGh(bin, args, { timeoutMs: this.timeoutMs }))
    this.tools = buildTools({
      ghBin: this.ghBin,
      timeoutMs: this.timeoutMs,
      confirmDangerous: config.confirmDangerous ?? true,
    })
  }

  catalog() {
    return ghToolCatalog()
  }

  async repositories() {
    const login = await this.currentLogin()
    if (login.error !== undefined) return login
    const raw = await this.run(this.ghBin, ['repo', 'list', login.value, '--json', 'nameWithOwner,description,stargazerCount,visibility,updatedAt,url,defaultBranchRef,primaryLanguage', '--limit', '100'])
    if (!this.succeeded(raw)) return this.commandError('gh repo list', raw)
    const parsed = parseJsonOutput(raw.stdout)
    if (!Array.isArray(parsed)) return this.commandError('gh repo list', raw, 'unexpected gh repo list output')
    return {
      ok: true,
      repositories: parsed.map((repo) => ({
        nameWithOwner: repo.nameWithOwner ?? '',
        name: repo.nameWithOwner?.split('/')[1] ?? repo.nameWithOwner ?? '',
        description: repo.description ?? '',
        stars: repo.stargazerCount ?? 0,
        visibility: repo.visibility ?? '',
        updatedAt: repo.updatedAt ?? '',
        url: repo.url ?? '',
        defaultBranch: repo.defaultBranchRef?.name ?? '',
        language: repo.primaryLanguage?.name ?? '',
      })),
    }
  }

  async profile() {
    const login = await this.currentLogin()
    if (login.error !== undefined) return login
    const query = 'query($login:String!){user(login:$login){login name avatarUrl bio url contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount color}}}}}}'
    const raw = await this.run(this.ghBin, ['api', 'graphql', '-f', `login=${login.value}`, '-f', `query=${query}`, '--jq', '.data.user'])
    if (!this.succeeded(raw)) return this.commandError('gh api graphql', raw)
    const parsed = parseJsonOutput(raw.stdout)
    if (parsed === undefined || typeof parsed !== 'object' || parsed === null) return this.commandError('gh api graphql', raw, 'unexpected GitHub profile output')
    const calendar = parsed.contributionsCollection?.contributionCalendar
    return {
      ok: true,
      profile: {
        login: parsed.login ?? login.value,
        name: parsed.name ?? parsed.login ?? login.value,
        avatarUrl: parsed.avatarUrl ?? '',
        bio: parsed.bio ?? '',
        url: parsed.url ?? `https://github.com/${login.value}`,
      },
      heatmap: {
        totalContributions: calendar?.totalContributions ?? 0,
        weeks: (calendar?.weeks ?? []).map((week) => ({
          days: (week.contributionDays ?? []).map((day) => ({
            date: day.date ?? '',
            count: day.contributionCount ?? 0,
            color: day.color ?? '#ebedf0',
          })),
        })),
      },
    }
  }

  async inbox() {
    const raw = await this.run(this.ghBin, ['api', 'notifications', '--paginate'])
    if (!this.succeeded(raw)) return this.commandError('gh api notifications', raw)
    const parsed = parseJsonOutput(raw.stdout)
    if (!Array.isArray(parsed)) return this.commandError('gh api notifications', raw, 'unexpected notifications output')
    return {
      ok: true,
      notifications: parsed.map((notification) => ({
        id: notification.id ?? '',
        title: notification.subject?.title ?? '',
        type: notification.subject?.type ?? '',
        repository: notification.repository?.full_name ?? '',
        reason: notification.reason ?? '',
        updatedAt: notification.updated_at ?? '',
        url: notification.html_url ?? notification.subject?.url ?? '',
      })),
    }
  }

  async branches(cwd) {
    const directory = typeof cwd === 'string' && cwd.length > 0 ? cwd : process.cwd()
    const format = '%(refname:short)%00%(HEAD)%00%(upstream:short)%00%(upstream:track)%00%(objectname:short)%00%(subject)'
    const raw = await this.run(this.gitBin, ['-C', directory, 'for-each-ref', `--format=${format}`, 'refs/heads', 'refs/remotes'])
    if (!this.succeeded(raw)) return this.commandError('git for-each-ref', raw)
    const branches = raw.stdout.split('\n').filter((line) => line.length > 0).map((line) => {
      const [name, head, upstream, track, commit, subject] = line.split('\0')
      return {
        name: name ?? '',
        current: head === '*',
        upstream: upstream && upstream.length > 0 ? upstream : null,
        track: track && track.length > 0 ? track : null,
        commit: commit ?? '',
        subject: subject ?? '',
      }
    })
    return { ok: true, cwd: directory, branches }
  }

  async repoBranches(repo) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
      return { ok: false, error: `invalid repository ${repo}`, branches: [] }
    }
    const raw = await this.run(this.ghBin, ['api', `repos/${repo}/branches?per_page=100`, '--paginate'])
    if (!this.succeeded(raw)) return this.commandError(`gh api repos/${repo}/branches`, raw)
    const parsed = parseJsonOutput(raw.stdout)
    if (!Array.isArray(parsed)) return this.commandError(`gh api repos/${repo}/branches`, raw, 'unexpected branches output')
    return {
      ok: true,
      branches: parsed.map((branch) => ({
        name: branch.name ?? '',
        commit: branch.commit?.sha ?? '',
        protected: branch.protected === true,
      })),
    }
  }

  async currentLogin() {
    const raw = await this.run(this.ghBin, ['api', 'user', '--jq', '.login'])
    if (!this.succeeded(raw)) return this.commandError('gh api user', raw)
    return { value: raw.stdout.trim() }
  }

  succeeded(raw) {
    return raw !== undefined && raw.timedOut !== true && raw.exitCode === 0
  }

  commandError(command, raw, message) {
    return {
      ok: false,
      command,
      exitCode: raw?.exitCode ?? null,
      timedOut: raw?.timedOut === true,
      stdout: raw?.stdout ?? '',
      stderr: raw?.stderr ?? '',
      error: message ?? raw?.stderr ?? (raw?.timedOut ? 'command timed out' : 'gh command failed'),
    }
  }

  status() {
    return this.call('gh_auth_status', {})
  }

  execute(toolName, args) {
    return this.call(toolName, args ?? {})
  }

  async call(toolName, args) {
    const tool = this.tools.find((candidate) => candidate.name === toolName)
    if (tool === undefined) {
      return {
        ok: false,
        command: `gh ${toolName}`,
        exitCode: null,
        signal: null,
        timedOut: false,
        stdout: '',
        stderr: '',
        parsed: null,
        notice: `unknown gh tool: ${toolName}`,
        error: `unknown gh tool: ${toolName}`,
      }
    }
    try {
      return await tool.execute(args, {})
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        command: `gh ${toolName}`,
        exitCode: null,
        signal: null,
        timedOut: false,
        stdout: '',
        stderr: '',
        parsed: null,
        notice: message,
        error: message,
      }
    }
  }
}

markRemoteMethod(GhRemoteService, 'catalog')
markRemoteMethod(GhRemoteService, 'status')
markRemoteMethod(GhRemoteService, 'execute')
markRemoteMethod(GhRemoteService, 'repositories')
markRemoteMethod(GhRemoteService, 'profile')
markRemoteMethod(GhRemoteService, 'inbox')
markRemoteMethod(GhRemoteService, 'branches')
markRemoteMethod(GhRemoteService, 'repoBranches')
