import test from 'node:test'
import assert from 'node:assert/strict'
import { Config } from '../index.js'

test('Config applies plugin defaults', () => {
  assert.deepEqual(Config({}), {
    ghBin: 'gh',
    timeoutMs: 30000,
    confirmDangerous: true,
  })
})

test('Config overrides accepted values', () => {
  assert.deepEqual(Config({ ghBin: '/usr/local/bin/gh', timeoutMs: 60000, confirmDangerous: false }), {
    ghBin: '/usr/local/bin/gh',
    timeoutMs: 60000,
    confirmDangerous: false,
  })
})

test('Config rejects invalid timeoutMs and ghBin', () => {
  assert.throws(() => Config({ timeoutMs: 0 }), /timeoutMs/)
  assert.throws(() => Config({ timeoutMs: -1 }), /timeoutMs/)
  assert.throws(() => Config({ ghBin: 3 }), /ghBin/)
})
