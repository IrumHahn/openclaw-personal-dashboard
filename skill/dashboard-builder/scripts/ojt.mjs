#!/usr/bin/env node
// 수습(OJT) 보고·채점 장부. VPS 쪽 <out>/ojt.json 에 업무 카드와 보고를 모아 두면 build_dashboard.mjs 가 seed 의 'ojt' 기록으로 넣는다.
// 대표가 PC 대시보드에서 채점하면 PC inbox 에 grades.json(.b64) 이 생기고, 비서는 다음 동기화 때 읽어 와서(send_to_pc --with-grades)
// lessons.md·설명서를 고친 뒤 `ack` 로 "반영함"을 표시한다 → 다음 전송 때 PC 화면이 "반영됨 ✓" 으로 바뀐다.
//
//   node ojt.mjs job    --id ad-log --title "쿠팡 광고 일지" --agent ana [--level L1] [--lesson "…"] [--summary "…"]
//   node ojt.mjs report --job ad-log --title "11/9 광고 일지" (--body "…" | --body-file <f>) [--date 2026-11-09] [--id 1109]
//   node ojt.mjs grades (--file <grades.json> | --hub-output <exec 출력 텍스트 파일>)      → 대기 중인 채점 목록(JSON)
//   node ojt.mjs ack    (--source-id report:ad-log:1109 --graded-at <시각> | --from <grades.json|hub 출력>)
//   공통: [--store <ojt.json>]  기본 ~/.openclaw/workspace/dashboard/ojt.json
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4']
const JOB_ID = /^[a-z0-9][a-z0-9-]{0,40}$/
const AGENT_ID = /^[a-z][a-z0-9-]{1,39}$/
export const GRADES_BEGIN = '===OJT-GRADES-BEGIN==='
export const GRADES_END = '===OJT-GRADES-END==='
export const MAX_REPORTS = 30
const MAX_BODY = 4000

function fail(message) { const e = new Error(message); e.exitCode = 1; throw e }
function text(value, limit) { return typeof value === 'string' ? value.trim().slice(0, limit) : '' }

export function emptyStore() { return { version: 1, jobs: [], reports: [] } }
export function loadStore(file) {
  if (!fs.existsSync(file)) return emptyStore()
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  return { version: 1, jobs: Array.isArray(raw.jobs) ? raw.jobs : [], reports: Array.isArray(raw.reports) ? raw.reports : [] }
}
export function saveStore(file, store) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.tmp`
  fs.writeFileSync(temp, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 })
  fs.renameSync(temp, file)
}

export function upsertJob(store, input) {
  const id = text(input.id, 41)
  if (!JOB_ID.test(id)) fail('--id must be lowercase letters/digits/- (예: ad-log)')
  const existing = store.jobs.find(j => j.id === id)
  const title = text(input.title, 120) || existing?.title
  if (!title) fail('--title is required for a new job')
  const agent = text(input.agent, 40) || existing?.agent || ''
  if (agent && !AGENT_ID.test(agent)) fail(`invalid agent id: ${agent}`)
  const level = text(input.level, 4) || existing?.level || 'L0'
  if (!LEVELS.includes(level)) fail('--level must be L0..L4')
  const job = { id, title, agent, level, lesson: text(input.lesson, 500) || existing?.lesson || '', summary: text(input.summary, 1000) || existing?.summary || '' }
  if (existing) Object.assign(existing, job); else store.jobs.push(job)
  return job
}

export function addReport(store, input, now = new Date()) {
  const job = store.jobs.find(j => j.id === input.job)
  if (!job) fail(`unknown job ${input.job} — run "ojt.mjs job --id ${input.job} --title …" first`)
  const title = text(input.title, 200)
  if (!title) fail('--title is required')
  const date = text(input.date, 10) || now.toISOString().slice(0, 10)
  const id = text(input.id, 60) || `${date.replace(/-/g, '')}-${String(store.reports.filter(r => r.job === job.id && r.date === date).length + 1)}`
  const sourceId = `report:${job.id}:${id}`
  const existing = store.reports.find(r => r.sourceId === sourceId)
  const report = { sourceId, job: job.id, agent: text(input.agent, 40) || job.agent, title, body: text(input.body, MAX_BODY), date, gradeAck: existing?.gradeAck || '' }
  if (existing) Object.assign(existing, report); else store.reports.push(report)
  return report
}

// seed.records.ojt 로 들어갈 모양. 보고는 최근 MAX_REPORTS 건만(Hub 전송은 명령마다 PC 허용 창이 떠서 작게 유지한다).
export function seedRecords(store) {
  const jobs = store.jobs.map(j => ({ kind: 'job', title: j.title, job: j.id, agent: j.agent, level: j.level, lesson: j.lesson, summary: j.summary, source: 'job-handoff', sourceId: `job:${j.id}` }))
  const reports = [...store.reports].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, MAX_REPORTS)
    .map(r => ({ kind: 'report', title: r.title, body: r.body, date: r.date, job: r.job, agent: r.agent, gradeAck: r.gradeAck || undefined, source: 'job-handoff', sourceId: r.sourceId }))
  return [...jobs, ...reports]
}

// grades.json 원문, 또는 Hub exec 출력(앞뒤 표시 줄 사이의 base64) → { pending: [...] }
export function parseGrades(raw) {
  const value = String(raw)
  let json = value.trim()
  const begin = value.indexOf(GRADES_BEGIN)
  if (begin >= 0) {
    const end = value.indexOf(GRADES_END, begin)
    const between = value.slice(begin + GRADES_BEGIN.length, end < 0 ? undefined : end)
    if (/찾을 수 없|cannot find|not find|NO-GRADES/i.test(between)) return { version: 1, kind: 'ojt-grades', pending: [], note: 'PC 에 아직 채점 파일이 없습니다' }
    const compact = between.replace(/\s+/g, '')
    if (!/^[A-Za-z0-9+/]+=*$/.test(compact)) fail('hub output between grade markers is not base64 — 명령을 그대로 실행했는지 확인하세요')
    json = Buffer.from(compact, 'base64').toString('utf8')
  }
  const parsed = JSON.parse(json)
  if (parsed?.kind !== 'ojt-grades' || !Array.isArray(parsed.pending)) fail('not an ojt-grades file')
  return parsed
}

export function ack(store, sourceId, gradedAt) {
  const report = store.reports.find(r => r.sourceId === sourceId)
  if (!report) return false
  report.gradeAck = String(gradedAt)
  return true
}

function parseArgs(argv) {
  const [command, ...rest] = argv
  const o = { command, store: path.join(os.homedir(), '.openclaw', 'workspace', 'dashboard', 'ojt.json') }
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i]; const value = rest[++i]
    if (!flag.startsWith('--') || value === undefined) fail(`${flag} needs a value`)
    o[flag.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value
  }
  return o
}

function main() {
  const o = parseArgs(process.argv.slice(2))
  if (o.command === 'grades') {
    const source = o.file || o.hubOutput
    if (!source) fail('grades needs --file <grades.json> or --hub-output <file>')
    const parsed = parseGrades(fs.readFileSync(source, 'utf8'))
    return { ok: true, pending: parsed.pending, note: parsed.note || null, next: parsed.pending.length ? '각 채점마다: 👍=record.md 에 기록 / ✏️·❌=틀린 이유 가설 → lessons.md 한 줄 + job.md 수정안을 대표에게 승인받기 → 반영 후 ojt.mjs ack --from <같은 파일>' : '처리할 채점이 없습니다' }
  }
  const store = loadStore(o.store)
  let result
  if (o.command === 'job') result = { job: upsertJob(store, o) }
  else if (o.command === 'report') {
    const body = o.bodyFile ? fs.readFileSync(o.bodyFile, 'utf8') : o.body
    result = { report: addReport(store, { ...o, body }) }
  } else if (o.command === 'ack') {
    if (o.from) {
      const parsed = parseGrades(fs.readFileSync(o.from, 'utf8'))
      const done = parsed.pending.filter(g => ack(store, g.sourceId, g.gradedAt)).map(g => g.sourceId)
      result = { acked: done, missing: parsed.pending.map(g => g.sourceId).filter(id => !done.includes(id)) }
    } else {
      if (!o.sourceId || !o.gradedAt) fail('ack needs --source-id and --graded-at, or --from <file>')
      result = { acked: ack(store, o.sourceId, o.gradedAt) ? [o.sourceId] : [], missing: [] }
    }
    result.next = '대시보드 다시 만들고 보내기: build_dashboard.mjs → send_to_pc.mjs (PC 화면이 "반영됨 ✓" 으로 바뀝니다)'
  } else fail('usage: ojt.mjs job|report|grades|ack …')
  saveStore(o.store, store)
  return { ok: true, store: o.store, ...result }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { process.stdout.write(`${JSON.stringify(main(), null, 2)}\n`) } catch (error) { process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`); process.exitCode = error.exitCode || 1 }
}
