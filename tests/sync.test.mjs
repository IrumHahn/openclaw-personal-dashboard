import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultConfig } from '../lib/config.js'
import { applyBundle, applyRemoteConfig, fetchBundle, validateBundle } from '../lib/sync.js'

const remote = { version: 1, name: '대표님의 AI 오피스', week: 2, menus: [{ key: 'tasks', owner: 'mira' }, { key: 'kakao' }, { key: 'settings' }], favorites: ['tasks', 'kakao'], agents: [{ id: 'mira', name: '미라', emoji: '🧭', menus: ['tasks'] }] }

test('remote config adds menus/owners/agents/week but keeps local order and favorites', () => {
  const local = defaultConfig()
  local.favorites = ['notes', 'tasks']
  const merged = applyRemoteConfig(local, remote)
  assert.deepEqual(merged.menus.map(m => m.key), ['tasks', 'agents', 'email', 'ideas', 'notes', 'settings', 'kakao'])
  assert.equal(merged.menus.find(m => m.key === 'tasks').owner, 'mira')
  assert.deepEqual(merged.favorites, ['notes', 'tasks'])
  assert.equal(merged.week, 2)
  assert.equal(merged.name, '대표님의 AI 오피스')
  assert.equal(merged.agents[0].id, 'mira')
})

test('applyBundle merges records, registered agents and reports version', () => {
  const data = { tasks: [] }
  const bundle = { manifest: { version: 'abc123', reasons: ['x'] }, config: remote, seed: { records: { tasks: [{ title: 'a', source: 's', sourceId: '1' }] }, agents: [{ id: 'mira', name: '미라', sessionsCount: 1 }, { id: 'BAD id' }] } }
  const result = applyBundle({ bundle, config: defaultConfig(), data })
  assert.equal(result.merge.added, 1)
  assert.equal(result.registeredAgents.length, 1)
  assert.equal(result.version, 'abc123')
  assert.deepEqual(result.reasons, ['x'])
  assert.throws(() => validateBundle({}), /config 또는 seed/)
  assert.throws(() => validateBundle({ config: { menus: ['nope'] } }), /unknown menu key/)
})

test('fetchBundle sends the bearer token and explains 401/404', async () => {
  const calls = []
  const ok = body => ({ ok: true, status: 200, json: async () => body })
  const impl = async (url, init) => { calls.push([url, init.headers.Authorization]); return ok({ version: 1 }) }
  const bundle = await fetchBundle('http://vps:18789/__openclaw__/canvas/dashboard', 'tok', impl)
  assert.deepEqual(Object.keys(bundle), ['manifest', 'config', 'seed'])
  assert.equal(calls[0][0], 'http://vps:18789/__openclaw__/canvas/dashboard/manifest.json')
  assert.equal(calls[0][1], 'Bearer tok')
  await assert.rejects(fetchBundle('http://x/', 't', async () => ({ ok: false, status: 401 })), /토큰을 거부/)
  await assert.rejects(fetchBundle('http://x/', 't', async () => ({ ok: false, status: 404 })), /404/)
})
