import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const script = path.join(dir, '..', 'skill', 'dashboard-builder', 'scripts', 'build_dashboard.mjs')
const check = path.join(dir, '..', 'skill', 'dashboard-builder', 'scripts', 'check_sync.mjs')

const team = { version: 1, team: { id: 'orchard', name: 'Orchard', userName: '대표님' }, agents: [
  { id: 'mira', name: '미라', emoji: '🧭', role: '총괄', mission: '조율', coordinator: true, menus: ['tasks', 'agents'], firstTasks: [{ task: '업무 지도 정리', why: '정렬', doneWhen: '3개 보임' }] },
  { id: 'codex-hand', name: '코덱스', emoji: '🛠️', role: '코딩', mission: '파일 생성', coordinator: false, menus: [], firstTasks: [] },
] }
const state = '# S\n- 진행 중 작업: 덱 검토\n\n## 현재 상태\n- 완료(2026-10-21): **덱** 완성.\n\n## 다음 행동\n1. 입장 확인\n2. 토론 주제\n'
const agents = [{ id: 'mira', identityName: '미라', sessionsCount: 2 }]

function setup() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-build-'))
  fs.writeFileSync(path.join(temp, 'team.json'), JSON.stringify(team))
  fs.writeFileSync(path.join(temp, 'STATE.md'), state)
  fs.writeFileSync(path.join(temp, 'agents.json'), JSON.stringify(agents))
  const out = path.join(temp, 'canvas', 'dashboard')
  const run = (extra = []) => spawnSync(process.execPath, [script, '--team', path.join(temp, 'team.json'), '--state', path.join(temp, 'STATE.md'), '--agents', path.join(temp, 'agents.json'), '--out', out, ...extra], { encoding: 'utf8' })
  const read = name => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'))
  return { temp, out, run, read, cleanup: () => fs.rmSync(temp, { recursive: true, force: true }) }
}

test('builds config/seed/manifest from team, state and agents', () => {
  const t = setup()
  try {
    const result = t.run()
    assert.equal(result.status, 0, result.stderr)
    const config = t.read('config.json'); const seed = t.read('seed.json'); const manifest = t.read('manifest.json')
    assert.equal(config.name, '대표님의 AI 오피스')
    assert.deepEqual(config.menus.map(m => m.key), ['tasks', 'agents', 'email', 'ideas', 'notes', 'settings'])
    assert.equal(config.menus.find(m => m.key === 'tasks').owner, 'mira')
    assert.equal(config.agents.length, 2)
    assert.ok(!('firstTasks' in config.agents[0]))
    const statuses = seed.records.tasks.map(t => t.status)
    assert.deepEqual([statuses.filter(s => s === 'open').length, statuses.filter(s => s === 'working').length, statuses.filter(s => s === 'done').length], [3, 1, 1])
    assert.equal(seed.records.tasks.find(t => t.source === 'team-onboarding').agent, 'mira')
    assert.equal(seed.agents[0].name, '미라')
    assert.ok(manifest.reasons.some(r => /codex-hand is not registered/.test(r)))
    assert.match(manifest.version, /^[0-9a-f]{16}$/)
  } finally { t.cleanup() }
})

test('same input gives same version; options change menus, owners, week and name', () => {
  const t = setup()
  try {
    const first = JSON.parse(t.run().stdout).version
    const second = JSON.parse(t.run().stdout).version
    assert.equal(first, second)
    assert.ok(fs.readdirSync(t.out).some(n => n.startsWith('config.json.bak-')), 'previous files are backed up')
    const result = t.run(['--menus', 'kakao,news', '--owner', 'email=codex-hand', '--week', '2', '--name', '빵집 오피스', '--favorites', 'tasks,email'])
    assert.equal(result.status, 0, result.stderr)
    const config = t.read('config.json')
    assert.ok(config.menus.some(m => m.key === 'kakao') && config.menus.some(m => m.key === 'news'))
    assert.equal(config.menus.find(m => m.key === 'email').owner, 'codex-hand')
    assert.equal(config.week, 2); assert.equal(config.name, '빵집 오피스'); assert.deepEqual(config.favorites, ['tasks', 'email'])
    assert.notEqual(JSON.parse(result.stdout).version, first)
    const kept = t.run([])
    assert.ok(JSON.parse(kept.stdout).menus.some(m => m.key === 'kakao'), 'rebuild without options keeps previously enabled menus')
  } finally { t.cleanup() }
})

test('secrets abort the build with exit 3 and nothing is written; unknown keys are rejected', () => {
  const t = setup()
  try {
    fs.writeFileSync(path.join(t.temp, 'STATE.md'), '## 다음 행동\n1. token = abcdef123456 넣기\n')
    const result = t.run()
    assert.equal(result.status, 3)
    assert.ok(!fs.existsSync(path.join(t.out, 'seed.json')))
    assert.notEqual(t.run(['--menus', 'nope']).status, 0)
    assert.notEqual(t.run(['--week', '7']).status, 0)
  } finally { t.cleanup() }
})

test('missing team/state degrade gracefully with reasons; check_sync validates output', () => {
  const t = setup()
  try {
    const result = spawnSync(process.execPath, [script, '--out', t.out, '--agents', path.join(t.temp, 'agents.json')], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    const manifest = t.read('manifest.json')
    assert.ok(manifest.reasons.some(r => /single-agent/.test(r)))
    assert.equal(manifest.counts.tasks, 0)
    const fakeBin = path.join(dir, 'fake-openclaw', 'openclaw')
    const env = { ...process.env, OPENCLAW_BIN: fakeBin, FAKE_STATE: path.join(t.temp, 'fake') }
    // pc.json 없음 + 플러그인 미설정 → 문제 보고(exit 1)
    const first = spawnSync(process.execPath, [check, '--out', t.out], { encoding: 'utf8', env })
    assert.equal(first.status, 1)
    assert.ok(JSON.parse(first.stdout).problems.some(p => /pc\.json missing/.test(p)))
    // setup_transfer 후에는 통과
    const setup = path.join(dir, '..', 'skill', 'dashboard-builder', 'scripts', 'setup_transfer.mjs')
    assert.equal(spawnSync(process.execPath, [setup, '--node', 'node-pc-1', '--inbox', '/home/me/inbox', '--save', path.join(t.out, 'pc.json')], { encoding: 'utf8', env }).status, 0)
    const checked = spawnSync(process.execPath, [check, '--out', t.out], { encoding: 'utf8', env })
    assert.equal(checked.status, 0, checked.stdout)
    assert.ok(JSON.parse(checked.stdout).hints.some(h => /send_to_pc/.test(h)))
    fs.rmSync(path.join(t.out, 'seed.json'))
    assert.equal(spawnSync(process.execPath, [check, '--out', t.out], { encoding: 'utf8', env }).status, 1)
  } finally { t.cleanup() }
})
