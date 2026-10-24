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

test('inbox: new version is detected, same version is not', async () => {
  const { inboxIsNew, readInbox } = await import('../lib/inbox.js')
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-inbox-'))
  try {
    assert.equal((await readInbox(dir)).present, false)
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ version: 'v1', generatedAt: '2026-10-24T00:00:00Z' }))
    fs.writeFileSync(path.join(dir, 'seed.json'), JSON.stringify({ records: { tasks: [] }, agents: [] }))
    const inbox = await readInbox(dir)
    assert.equal(inbox.present, true)
    assert.equal(inbox.version, 'v1')
    assert.equal(inbox.bundle.config, null)
    assert.equal(inboxIsNew(inbox, null), true)
    assert.equal(inboxIsNew(inbox, 'v1'), false)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('inbox: .b64 files (Hub echo chunks with CRLF/spaces) are decoded; newer b64 wins; broken chunk is not "new"', async () => {
  const { inboxIsNew, readInbox, decodeBase64Text } = await import('../lib/inbox.js')
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-inbox-b64-'))
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64')
  try {
    // cmd `echo chunk>> file` 는 청크마다 CRLF 를 붙이고, 끝에 공백이 섞일 수 있다
    const manifest = b64({ version: 'v2', generatedAt: '2026-10-24T01:00:00Z' })
    fs.writeFileSync(path.join(dir, 'manifest.b64'), `${manifest.slice(0, 20)} \r\n${manifest.slice(20)}\r\n`)
    fs.writeFileSync(path.join(dir, 'seed.b64'), `${b64({ records: { tasks: [{ title: '한글 — 특수문자 &|<>^%"\'', status: 'open', source: 's', sourceId: '1' }] }, agents: [] })}\r\n`)
    let inbox = await readInbox(dir)
    assert.equal(inbox.present, true)
    assert.equal(inbox.format, 'b64')
    assert.equal(inbox.version, 'v2')
    assert.equal(inbox.bundle.seed.records.tasks[0].title, '한글 — 특수문자 &|<>^%"\'')
    assert.deepEqual(inbox.problems, [])
    assert.equal(inboxIsNew(inbox, 'v1'), true)
    // 전송 도중(마지막 청크 전) 깨진 파일은 새 데이터로 치지 않는다
    fs.writeFileSync(path.join(dir, 'config.b64'), 'eyJ2ZXJzaW9uIjox')
    inbox = await readInbox(dir)
    assert.equal(inbox.problems.length, 1)
    assert.equal(inboxIsNew(inbox, 'v1'), false)
    // 더 최근에 쓰인 .json 이 있으면 그쪽을 쓴다
    const later = new Date(Date.now() + 5000)
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ version: 'v3' }))
    fs.utimesSync(path.join(dir, 'manifest.json'), later, later)
    fs.rmSync(path.join(dir, 'config.b64'))
    inbox = await readInbox(dir)
    assert.equal(inbox.version, 'v3')
    assert.equal(inbox.format, 'json')
    assert.throws(() => decodeBase64Text('not base64!!'), /not base64/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
