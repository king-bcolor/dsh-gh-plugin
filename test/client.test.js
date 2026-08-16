import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

test('client bundle registers a GitHub settings section', async () => {
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  let handoff
  const document = {
    querySelector() { return null },
    createElement() {
      return { dataset: {}, textContent: '', style: {} }
    },
    head: { appendChild() {} },
  }
  const window = {
    __ModuleLoader__: { load(value) { handoff = value } },
  }
  const ReactStub = {
    createElement(tag, props, ...children) { return { tag, props, children } },
    useState(initial) { return [initial, () => {}] },
    useEffect() {},
    useMemo(fn) { return fn() },
  }
  const sandbox = { window, document, console, URL, JSON, Object, Array, String, Number, Boolean, Error, Promise, RegExp, Map, Set }
  sandbox.globalThis = sandbox
  vm.runInNewContext(source, sandbox, { filename: 'lib/client.js' })
  assert.ok(handoff, 'client bundle must call window.__ModuleLoader__.load')
  assert.equal(handoff.id, 'dsh-gh-plugin')

  const require = (spec) => {
    if (spec === 'react') return ReactStub
    if (spec === 'react/jsx-runtime') return { jsx: ReactStub.createElement, jsxs: ReactStub.createElement }
    throw new Error(`unexpected client require: ${spec}`)
  }
  const exports = handoff.factory(require)
  assert.ok(exports.inject.includes('slots'))
  assert.ok(exports.inject.includes('connection'))
  assert.ok(exports.inject.includes('sessions'))
  assert.equal(typeof exports.apply, 'function')

  const factories = {}
  const contributions = {}
  const components = {}
  const calls = []
  const ctx = {
    slots: {
      inject(name, registerFactory) {
        factories[name] = registerFactory
      },
      register(value, component) {
        contributions[value.name] = value
        components[value.name] = component
        return () => {}
      },
    },
    sessions: {
      list: {
        getSnapshot() {
          return { byId: { s1: { cwd: '/tmp/work' } } }
        },
      },
    },
    connection: {
      rpc: {
        call: async (...args) => {
          calls.push(args)
          return { ok: true, value: [] }
        },
      },
    },
  }
  exports.apply(ctx)
  factories['settings.section']()
  assert.equal(contributions['settings.section'].id, 'gh')
  assert.equal(contributions['settings.section'].label(), 'GitHub')

  const settingsInjected = contributions['settings.section'].inject()
  assert.equal(typeof settingsInjected.gh.catalog, 'function')
  assert.equal(typeof settingsInjected.gh.status, 'function')
  assert.equal(typeof settingsInjected.gh.execute, 'function')
  await settingsInjected.gh.catalog()
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], '/api')
  assert.equal(calls[0][1], 'gh/catalog')
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][2])), { args: {} })

  const settingsTree = components['settings.section']({ gh: settingsInjected.gh })
  assert.equal(settingsTree.tag, 'div')
  assert.equal(settingsTree.props.className, 'dgh_section')

  factories['conversation.view']()
  const view = contributions['conversation.view']
  assert.equal(view.id, 'gh')
  assert.equal(view.label(), 'GitHub')
  const viewInjected = view.inject('s1')
  assert.equal(viewInjected.cwd, '/tmp/work')
  assert.equal(typeof viewInjected.gh.profile, 'function')
  assert.equal(typeof viewInjected.gh.repositories, 'function')
  assert.equal(typeof viewInjected.gh.inbox, 'function')
  assert.equal(typeof viewInjected.gh.branches, 'function')
  assert.equal(typeof viewInjected.gh.repoBranches, 'function')
  await viewInjected.gh.profile()
  assert.equal(calls[1][0], '/api')
  assert.equal(calls[1][1], 'gh/profile')

  const viewTree = components['conversation.view']({ sessionId: 's1', gh: viewInjected.gh, cwd: '/tmp/work' })
  assert.equal(viewTree.tag, 'div')
  assert.equal(viewTree.props.className, 'dgh_dashboard')
})
