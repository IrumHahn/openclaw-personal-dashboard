import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const scripts = path.join(dir, '..', 'skill', 'dashboard-builder', 'scripts')
const fakeBin = path.join(dir, 'fake-openclaw', 'openclaw')

function setup(extraEnv = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-transfer-'))
  const out = path.join(temp, 'dashboard')
  fs.mkdirSync(out)
  for (const [name, body] of Object.entries({ 'manifest.json': { version: 'abc', counts: {} }, 'config.json': { version: 1, menus: [] }, 'seed.json': { version: 1, records: { tasks: [] }, agents: [] } })) fs.writeFileSync(path.join(out, name), JSON.stringify(body))
  const env = { ...process.env, OPENCLAW_BIN: fakeBin, FAKE_STATE: path.join(temp, 'fake'), ...extraEnv }
  const run = (script, args) => spawnSync(process.execPath, [path.join(scripts, script), ...args], { encoding: 'utf8', env })
  const state = () => JSON.parse(fs.readFileSync(path.join(temp, 'fake', 'state.json'), 'utf8'))
  return { temp, out, env, run, state, cleanup: () => fs.rmSync(temp, { recursive: true, force: true }) }
}

test('setup_transfer enables plugin, writes node policy with glob, merges command allowlist, saves pc.json', () => {
  const t = setup()
  try {
    const pc = path.join(t.temp, 'pc.json')
    const r = t.run('setup_transfer.mjs', ['--node', 'My PC', '--inbox', 'C:\\Users\\irum\\Documents\\openclaw-personal-dashboard\\.data\\inbox\\', '--save', pc])
    assert.equal(r.status, 0, r.stderr)
    const out = JSON.parse(r.stdout)
    assert.equal(out.node.id, 'node-pc-1')
    assert.equal(out.inbox, 'C:/Users/irum/Documents/openclaw-personal-dashboard/.data/inbox')
    const cfg = t.state().config
    assert.deepEqual(cfg.plugins.allow, ['codex', 'file-transfer'])
    assert.equal(cfg.plugins.entries['file-transfer'].enabled, true)
    assert.equal(cfg.plugins.entries['file-transfer'].config.policyVersion, 2)
    assert.deepEqual(cfg.plugins.entries['file-transfer'].config.nodes['node-pc-1'].allowWritePaths, ['C:/Users/irum/Documents/openclaw-personal-dashboard/.data/inbox/**'])
    assert.ok(cfg.gateway.nodes.commands.allow.includes('file.write'))
    assert.equal(JSON.parse(fs.readFileSync(pc, 'utf8')).nodeId, 'node-pc-1')
    assert.equal(out.pendingApprovals.length, 0)
  } finally { t.cleanup() }
})

test('setup_transfer reports pending capability approvals and offline nodes; dry-run writes nothing', () => {
  const t = setup({ FAKE_PENDING: '1', FAKE_NODE_OFFLINE: '1' })
  try {
    const r = t.run('setup_transfer.mjs', ['--node', 'node-pc-1', '--inbox', '/home/me/inbox', '--dry-run'])
    assert.equal(r.status, 0, r.stderr)
    const out = JSON.parse(r.stdout)
    assert.ok(out.nextSteps.some(s => /nodes approve req-1/.test(s)))
    assert.ok(out.nextSteps.some(s => /연결돼 있지 않습니다/.test(s)))
    assert.equal(t.state().patches.length, 0)
    assert.notEqual(t.run('setup_transfer.mjs', ['--node', 'nope', '--inbox', '/x']).status, 0)
    assert.notEqual(t.run('setup_transfer.mjs', ['--node', 'node-pc-1', '--inbox', 'relative/path']).status, 0)
  } finally { t.cleanup() }
})

test('send_to_pc writes seed→config→manifest with sha256 check and respects policy denial', () => {
  const t = setup({ FAKE_PLUGIN_NOISE: '1' })
  try {
    const pc = path.join(t.temp, 'pc.json')
    assert.equal(t.run('setup_transfer.mjs', ['--node', 'node-pc-1', '--inbox', 'C:/Users/irum/dash/.data/inbox', '--save', pc]).status, 0)
    const r = t.run('send_to_pc.mjs', ['--pc', pc, '--out', t.out])
    assert.equal(r.status, 0, r.stderr)
    const out = JSON.parse(r.stdout)
    assert.equal(out.version, 'abc')
    assert.deepEqual(out.sent.map(s => path.basename(s.remotePath)), ['seed.json', 'config.json', 'manifest.json'])
    const landed = path.join(t.temp, 'fake', 'pc', 'C', 'Users', 'irum', 'dash', '.data', 'inbox', 'seed.json')
    assert.ok(fs.existsSync(landed))
    assert.equal(JSON.parse(fs.readFileSync(landed, 'utf8')).version, 1)
    // 정책 밖 경로는 거부된다
    fs.writeFileSync(pc, JSON.stringify({ nodeId: 'node-pc-1', inbox: 'C:/Users/irum/elsewhere' }))
    const denied = t.run('send_to_pc.mjs', ['--pc', pc, '--out', t.out])
    assert.notEqual(denied.status, 0)
    assert.match(denied.stderr, /POLICY_DENIED/)
    fs.rmSync(path.join(t.out, 'seed.json'))
    assert.match(t.run('send_to_pc.mjs', ['--pc', pc, '--out', t.out]).stderr, /missing in/)
  } finally { t.cleanup() }
})
