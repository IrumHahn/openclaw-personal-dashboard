import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { GRADES_BEGIN, GRADES_END, MAX_REPORTS, addReport, emptyStore, parseGrades, seedRecords, upsertJob } from '../skill/dashboard-builder/scripts/ojt.mjs'
import { buildHubCommands, gradesReadPiece } from '../skill/dashboard-builder/scripts/send_to_pc.mjs'
import { applyBundle } from '../lib/sync.js'
import { defaultConfig } from '../lib/config.js'
import { gradePatch, gradesPayload, isPending } from '../lib/ojt.js'
import { updateRecord } from '../lib/store.js'

const dir = path.dirname(fileURLToPath(import.meta.url))
const scripts = path.join(dir, '..', 'skill', 'dashboard-builder', 'scripts')
const run = (script, args) => spawnSync(process.execPath, [path.join(scripts, script), ...args], { encoding: 'utf8' })

test('ledger: job + report become seed records; reports keep only the newest MAX_REPORTS', () => {
  const store = emptyStore()
  upsertJob(store, { id: 'ad-log', title: '쿠팡 광고 일지', agent: 'ana' })
  for (let d = 1; d <= MAX_REPORTS + 3; d++) addReport(store, { job: 'ad-log', title: `${d}일 일지`, body: 'x', date: `2026-11-${String(d).padStart(2, '0')}` })
  const records = seedRecords(store)
  assert.equal(records[0].kind, 'job')
  assert.equal(records[0].level, 'L0')
  assert.equal(records.filter(r => r.kind === 'report').length, MAX_REPORTS)
  assert.equal(records[1].date, '2026-11-33'.replace('33', String(MAX_REPORTS + 3)))
  assert.throws(() => addReport(store, { job: 'nope', title: 'a' }), /unknown job/)
  assert.throws(() => upsertJob(store, { id: 'Bad Id', title: 'a' }), /lowercase/)
  assert.throws(() => upsertJob(store, { id: 'ad-log', level: 'L9' }), /L0\.\.L4/)
})

test('hub: grades read is appended to the same command (one Allow) and parses back, including NO-GRADES', () => {
  const inbox = '%USERPROFILE%\\Documents\\openclaw-dashboard\\inbox'
  const { commands } = buildHubCommands({ inbox, files: [{ name: 'manifest.json', content: Buffer.from('{"version":"v"}') }], withGrades: true })
  assert.equal(commands.length, 1)
  assert.ok(commands[0].endsWith(gradesReadPiece(inbox)))
  assert.ok(commands[0].includes(`type "${inbox}\\grades.b64"`))
  const payload = { version: 1, kind: 'ojt-grades', pending: [{ sourceId: 'report:ad-log:1', grade: 'fix', note: '한글 이유', gradedAt: 'T' }] }
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64')
  const output = `eyJ2ZXJzaW9uIjoidiJ9\r\n${GRADES_BEGIN} \r\n${b64.slice(0, 20)}\r\n${b64.slice(20)}\r\n${GRADES_END} \r\n`
  assert.equal(parseGrades(output).pending[0].note, '한글 이유')
  assert.deepEqual(parseGrades(`${GRADES_BEGIN}\r\nNO-GRADES \r\n${GRADES_END}`).pending, [])
  assert.throws(() => parseGrades(`${GRADES_BEGIN}\n다른 출력!\n${GRADES_END}`), /not base64/)
})

test('round trip: agent report → build → PC merge → PC grade → grades file → ack → rebuild → PC shows 반영됨', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-ojt-skill-'))
  try {
    const out = path.join(temp, 'dashboard')
    const store = ['--store', path.join(out, 'ojt.json')]
    assert.equal(run('ojt.mjs', ['job', '--id', 'ad-log', '--title', '쿠팡 광고 일지', '--agent', 'ana', '--level', 'L1', ...store]).status, 0)
    const added = run('ojt.mjs', ['report', '--job', 'ad-log', '--title', '11/9 광고 일지', '--body', 'ROAS 182%', '--date', '2026-11-09', '--id', '1109', ...store])
    assert.equal(added.status, 0, added.stderr)
    const agents = path.join(temp, 'agents.json'); fs.writeFileSync(agents, '[]')
    const build = () => { const r = run('build_dashboard.mjs', ['--out', out, '--agents', agents]); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout) }
    assert.equal(build().counts.ojt, 2)
    const bundle = () => ({ manifest: JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'))), config: JSON.parse(fs.readFileSync(path.join(out, 'config.json'))), seed: JSON.parse(fs.readFileSync(path.join(out, 'seed.json'))) })

    // PC: 반영 → 채점
    const data = {}
    applyBundle({ bundle: bundle(), config: defaultConfig(), data })
    const report = data.ojt.find(r => r.sourceId === 'report:ad-log:1109')
    updateRecord(data, 'ojt', report.id, gradePatch({ grade: 'fix', note: 'VAT 포함' }, '2026-11-09T10:00:00.000Z'))
    const gradesFile = path.join(temp, 'grades.json')
    fs.writeFileSync(gradesFile, JSON.stringify(gradesPayload(data.ojt)))

    // VPS: 채점 읽기 → ack → 다시 빌드
    const read = run('ojt.mjs', ['grades', '--file', gradesFile])
    assert.equal(JSON.parse(read.stdout).pending[0].note, 'VAT 포함')
    const acked = JSON.parse(run('ojt.mjs', ['ack', '--from', gradesFile, ...store]).stdout)
    assert.deepEqual(acked.acked, ['report:ad-log:1109'])
    build()
    applyBundle({ bundle: bundle(), config: defaultConfig(), data })
    const after = data.ojt.find(r => r.id === report.id)
    assert.equal(after.grade, 'fix')
    assert.equal(isPending(after), false)
  } finally { fs.rmSync(temp, { recursive: true, force: true }) }
})
