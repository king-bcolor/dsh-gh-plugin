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
  assert.equal(typeof exports.apply, 'function')

  let contribution
  let Component
  let factory
  const calls = []
  const ctx = {
    slots: {
      inject(name, registerFactory) {
        factory = registerFactory
      },
      register(value, component) {
        contribution = value
        Component = component
        return () => {}
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
  factory()
  assert.equal(contribution.name, 'settings.section')
  assert.equal(contribution.id, 'gh')
  assert.equal(contribution.label(), 'GitHub')

  const injected = contribution.inject()
  assert.equal(typeof injected.gh.catalog, 'function')
  assert.equal(typeof injected.gh.status, 'function')
  assert.equal(typeof injected.gh.execute, 'function')
  await injected.gh.catalog()
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], '/api')
  assert.equal(calls[0][1], 'gh/catalog')
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][2])), { args: {} })

  const tree = Component({ gh: injected.gh })
  assert.equal(tree.tag, 'div')
  assert.equal(tree.props.className, 'dgh_section')
})
