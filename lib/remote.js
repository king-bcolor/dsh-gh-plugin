/**
 * Host Remote service (`ctx.gh`) used by the browser settings page.
 *
 * The service is registered through Cordis with a TypertRemote binding, so
 * the web client can call `ctx.remote.gh.catalog()`, `status()`, and
 * `execute()` directly. No shell or token data ever crosses this boundary.
 */

import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { buildTools, ghToolCatalog } from './tools.js'

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
    this.tools = buildTools({
      ghBin: config.ghBin ?? 'gh',
      timeoutMs: config.timeoutMs ?? 30000,
      confirmDangerous: config.confirmDangerous ?? true,
    })
  }

  catalog() {
    return ghToolCatalog()
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
