/**
 * gh CLI runner for dsh-gh-plugin.
 *
 * The runner only spawns `gh` with an argv array (no shell), captures
 * stdout/stderr, applies the configured timeout, and normalizes the process
 * result. It never logs `GH_TOKEN`; the env map is forwarded untouched.
 */

import { spawn } from 'node:child_process'

export class GhRunnerError extends Error {
  constructor(message, code = 'GH_RUNNER_ERROR') {
    super(message)
    this.name = 'GhRunnerError'
    this.code = code
  }
}

/**
 * Spawn a gh command and resolve with a normalized result object.
 *
 * @param {string} ghBin path or name of the gh executable
 * @param {string[]} args argv entries passed to gh (never interpreted by a shell)
 * @param {{timeoutMs?: number, env?: NodeJS.ProcessEnv, cwd?: string}} [options]
 * @returns {Promise<{exitCode: number|null, signal: string|null, timedOut: boolean, stdout: string, stderr: string}>}
 */
export function runGh(ghBin, args, { timeoutMs = 30000, env = process.env, cwd = process.cwd() } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new GhRunnerError(`timeoutMs must be a positive finite number, got ${JSON.stringify(timeoutMs)}`, 'GH_BAD_TIMEOUT'))
  }
  if (typeof ghBin !== 'string' || ghBin.length === 0) {
    return Promise.reject(new GhRunnerError('ghBin must be a non-empty string', 'GH_BAD_BIN'))
  }

  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawn(ghBin, args, {
        env,
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        detached: process.platform !== 'win32',
      })
    } catch (error) {
      reject(new GhRunnerError(`failed to spawn gh CLI: ${error.message}`, 'GH_SPAWN_FAILED'))
      return
    }

    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false

    const timer = setTimeout(() => {
      timedOut = true
      // Kill the whole process group so gh child processes (e.g. git
      // helpers) cannot outlive the tool timeout.
      if (process.platform === 'win32') {
        child.kill('SIGKILL')
      } else {
        try {
          process.kill(-child.pid, 'SIGKILL')
        } catch {
          child.kill('SIGKILL')
        }
      }
    }, timeoutMs)

    const cleanup = () => clearTimeout(timer)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    child.on('error', (error) => {
      if (settled) return
      settled = true
      cleanup()
      if (error.code === 'ENOENT') {
        reject(new GhRunnerError(
          `gh CLI not found at "${ghBin}". Install it from https://cli.github.com or set the plugin ghBin config to the gh executable path.`,
          'GH_NOT_FOUND',
        ))
      } else {
        reject(new GhRunnerError(`failed to run gh CLI: ${error.message}`, 'GH_SPAWN_FAILED'))
      }
    })

    child.on('close', (code, signal) => {
      if (settled) return
      settled = true
      cleanup()
      resolve({
        exitCode: timedOut ? null : code,
        signal: signal ?? null,
        timedOut,
        stdout,
        stderr,
      })
    })
  })
}

/**
 * Try to parse `text` as a JSON value.
 *
 * @param {string} text stdout text
 * @returns {unknown} parsed JSON value, or `undefined` when `text` is not valid JSON
 */
export function parseJsonOutput(text) {
  if (typeof text !== 'string') return undefined
  const trimmed = text.trim()
  if (trimmed.length === 0) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

/**
 * Map a gh exit code to a short, actionable notice. The special code 4 means
 * authentication failed or no credentials are available.
 *
 * @param {number|null} exitCode
 * @returns {string|undefined}
 */
export function ghExitNotice(exitCode) {
  if (exitCode === 4) return 'gh 未认证或认证已失效：请先运行 `gh auth login` 或设置 GH_TOKEN 后重试。'
  if (exitCode === 1) return 'gh 命令执行失败，详见 stderr。'
  if (exitCode === 0 || exitCode === null) return undefined
  return `gh 命令以退出码 ${exitCode} 结束，详见 stderr。`
}
