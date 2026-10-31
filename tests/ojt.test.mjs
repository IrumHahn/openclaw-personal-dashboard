import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { mergeSeed } from '../lib/merge.js'
import { gradeMessage, gradePatch, gradesPayload, isPending, ojtBoard, streakOf } from '../lib/ojt.js'
import { writeGradesOutbox } from '../lib/ojt-outbox.js'
import { decodeBase64Text } from '../lib/inbox.js'
import { updateRecord } from '../lib/store.js'

const seed = () => ({ records: { ojt: [
  { kind: 'job', title: '쿠팡 광고 일지', job: 'ad-log', agent: 'ana', level: 'L1', lesson: '11/8 ROAS 에 VAT 포함', source: 'job-handoff', sourceId: 'job:ad-log' },
  { kind: 'report', title: '11/9 광고 일지', body: 'ROAS 182%', date: '2026-11-09', job: 'ad-log', agent: 'ana', source: 'job-handoff', sourceId: 'report:ad-log:1109' },
  { kind: 'report', title: '11/8 광고 일지', body: 'ROAS 175%', date: '2026-11-08', job: 'ad-log', agent: 'ana', source: 'job-handoff', sourceId: 'report:ad-log:1108' },
] } })

test('gradePatch: 👍 needs no note, ✏️ and ❌ need a one-line reason', () => {
  assert.deepEqual(gradePatch({ grade: 'good' }, 'T1'), { grade: 'good', gradeNote: '', gradedAt: 'T1' })
  assert.equal(gradePatch({ grade: 'fix', note: '  VAT  포함 ' }, 'T1').gradeNote, 'VAT 포함')
  assert.throws(() => gradePatch({ grade: 'fix' }), /한 줄 이유/)
  assert.throws(() => gradePatch({ grade: 'bad', note: '   ' }), /한 줄 이유/)
  assert.throws(() => gradePatch({ grade: 'great' }), /good \| fix \| bad/)
})

test('streak counts consecutive 👍 from the newest graded report; ✏️/❌ stop it; ungraded are skipped', () => {
  const r = (date, grade) => ({ date, grade })
  assert.equal(streakOf([r('2026-11-05', 'good'), r('2026-11-06', 'good'), r('2026-11-07', 'fix'), r('2026-11-08', 'good'), r('2026-11-09', 'good'), r('2026-11-10')]), 2)
  assert.equal(streakOf([r('2026-11-09', 'bad'), r('2026-11-08', 'good')]), 0)
  assert.equal(streakOf([]), 0)
})

test('seed adds jobs and reports; board groups them by job with level, lesson and counts', () => {
  const data = { ojt: [] }
  const result = mergeSeed(data, seed())
  assert.equal(result.added, 3)
  const [job] = ojtBoard(data.ojt)
  assert.equal(job.title, '쿠팡 광고 일지')
  assert.equal(job.level, 'L1')
  assert.equal(job.levelName, '따라하기')
  assert.equal(job.lesson, '11/8 ROAS 에 VAT 포함')
  assert.equal(job.reports.length, 2)
  assert.equal(job.reports[0].sourceId, 'report:ad-log:1109')
  assert.equal(job.ungraded, 2)
})

test('a grade made on the PC survives the next seed; the agent acknowledges with gradeAck and pending clears', () => {
  const data = { ojt: [] }
  mergeSeed(data, seed())
  const report = data.ojt.find(r => r.sourceId === 'report:ad-log:1109')
  updateRecord(data, 'ojt', report.id, gradePatch({ grade: 'fix', note: 'VAT 포함' }, '2026-11-09T10:00:00.000Z'))
  assert.equal(isPending(data.ojt.find(r => r.id === report.id)), true)
  assert.equal(gradesPayload(data.ojt).pending.length, 1)
  // 비서가 같은 보고를 다시 보내도(채점 필드를 넣어도) PC 채점은 그대로다
  const again = seed()
  again.records.ojt[1].grade = 'good'
  again.records.ojt[1].gradeNote = 'overwrite?'
  mergeSeed(data, again)
  const kept = data.ojt.find(r => r.id === report.id)
  assert.equal(kept.grade, 'fix')
  assert.equal(kept.gradeNote, 'VAT 포함')
  // 비서가 반영했다고 알림
  const ack = seed()
  ack.records.ojt[1].gradeAck = '2026-11-09T10:00:00.000Z'
  ack.records.ojt[0].level = 'L1'
  ack.records.ojt[0].lesson = '11/9 ROAS 계산 시 VAT 포함'
  mergeSeed(data, ack)
  assert.equal(isPending(data.ojt.find(r => r.id === report.id)), false)
  assert.equal(gradesPayload(data.ojt).pending.length, 0)
  assert.equal(ojtBoard(data.ojt)[0].lesson, '11/9 ROAS 계산 시 VAT 포함')
})

test('seed records of other menus are not marked changed by the new optional fields', () => {
  const data = { tasks: [] }
  const tasks = { records: { tasks: [{ title: 'a', source: 's', sourceId: '1' }] } }
  mergeSeed(data, tasks)
  assert.equal(mergeSeed(data, tasks).unchanged, 1)
  assert.equal('grade' in data.tasks[0], false)
  assert.equal('job' in data.tasks[0], false)
})

test('outbox writes grades.json and an ASCII grades.b64 with the same content', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-ojt-'))
  try {
    const records = [{ id: 'x', kind: 'report', title: '11/9 광고 일지', job: 'ad-log', agent: 'ana', source: 'job-handoff', sourceId: 'report:ad-log:1109', grade: 'bad', gradeNote: '캠페인 B 누락', gradedAt: 'T1' }]
    const result = await writeGradesOutbox(dir, records, 'NOW')
    assert.equal(result.pending, 1)
    const json = JSON.parse(fs.readFileSync(path.join(dir, 'grades.json'), 'utf8'))
    assert.equal(json.kind, 'ojt-grades')
    assert.deepEqual(json.pending[0], { source: 'job-handoff', sourceId: 'report:ad-log:1109', id: 'x', job: 'ad-log', agent: 'ana', title: '11/9 광고 일지', date: '', grade: 'bad', emoji: '❌', note: '캠페인 B 누락', gradedAt: 'T1' })
    const b64 = fs.readFileSync(path.join(dir, 'grades.b64'), 'utf8')
    assert.match(b64, /^[A-Za-z0-9+/=\n]+$/)
    assert.deepEqual(JSON.parse(decodeBase64Text(b64)), json)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('telegram fallback line carries job, report, grade and id', () => {
  const line = gradeMessage({ title: '11/9 광고 일지', date: '2026-11-09', grade: 'fix', gradeNote: 'VAT 포함', sourceId: 'report:ad-log:1109' }, '쿠팡 광고 일지')
  assert.equal(line, '[채점] 쿠팡 광고 일지 · 2026-11-09 · 11/9 광고 일지 → ✏️ VAT 포함 (id report:ad-log:1109)')
})
