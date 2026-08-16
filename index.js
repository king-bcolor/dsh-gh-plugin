/**
 * dsh-gh-plugin — DeepSeek Harness plugin wrapping the GitHub CLI (gh).
 *
 * The plugin registers one `gh_*` tool per supported gh command. All command
 * arguments are passed as argv arrays (no shell), stdout is captured with a
 * configurable timeout, and `--json` is used where gh supports it.
 *
 * See docs/实现文档.md for the TDD plan and docs/用例目录/README.md for the
 * supported gh use cases.
 */

import z from '@deepseek-ai/schemastery'
import { buildTools } from './lib/tools.js'
import { GhRemoteService } from './lib/remote.js'

export const name = 'gh'
export const inject = ['tools']

export const Config = z.object({
  ghBin: z.string().default('gh'),
  timeoutMs: z.natural().min(1).default(30000),
  confirmDangerous: z.boolean().default(true),
})

export function apply(ctx, config = {}) {
  const tools = buildTools({
    ghBin: config.ghBin ?? 'gh',
    timeoutMs: config.timeoutMs ?? 30000,
    confirmDangerous: config.confirmDangerous ?? true,
  })

  for (const tool of tools) {
    ctx.tools.register(tool)
  }

  ctx.plugin(GhRemoteService, {
    ghBin: config.ghBin ?? 'gh',
    timeoutMs: config.timeoutMs ?? 30000,
    confirmDangerous: config.confirmDangerous ?? true,
  })
}
