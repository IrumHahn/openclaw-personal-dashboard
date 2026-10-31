// VPS seed → 로컬 저장소 병합 규칙.
// - source+sourceId 가 같은 기록은 갱신, 없으면 추가
// - 사용자가 화면에서 바꾼 기록(localEdited=true)은 status 를 보존한다 (대시보드에서 "완료" 누른 걸 되돌리지 않음)
// - 삭제는 전파하지 않는다 (seed 에서 사라져도 로컬 기록은 남는다)
import { randomUUID } from 'node:crypto'
import { isCollectionKey } from './menu-tree.js'

const SECRET = /(sk-[a-z0-9]{8,}|ghp_[a-z0-9]{10,}|(?:password|passwd|secret|api[_ -]?key|token)\s*[:=]\s*\S{6,})/i

function clean(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

// 수습(ojt) 기록 필드. 값이 있을 때만 넣는다(다른 기록이 빈 값 때문에 '바뀜'으로 세지지 않게).
// 채점 필드(grade·gradeNote·gradedAt)는 일부러 없다 — seed 가 PC 의 채점을 덮어쓰지 못한다. 비서는 gradeAck 로 "반영함"만 알린다.
const SEED_OPTIONAL = { kind: 20, job: 60, level: 4, lesson: 500, gradeAck: 40 }

export function normalizeSeedRecord(input) {
  if (!input || typeof input !== 'object') throw new Error('invalid seed record')
  const title = clean(input.title, 200)
  if (!title) throw new Error('seed record needs a title')
  const source = clean(input.source, 80)
  const sourceId = clean(input.sourceId, 200)
  if (!source || !sourceId) throw new Error(`seed record "${title}" needs source and sourceId`)
  const record = {
    title,
    body: clean(input.body, 100000),
    summary: clean(input.summary, 5000),
    person: clean(input.person, 200),
    agent: clean(input.agent, 40),
    status: clean(input.status, 40) || 'open',
    date: clean(input.date, 40),
    dueAt: clean(input.dueAt, 40),
    link: clean(input.link, 1000),
    source,
    sourceId,
  }
  for (const [key, limit] of Object.entries(SEED_OPTIONAL)) { const value = clean(input[key], limit); if (value) record[key] = value }
  for (const [key, value] of Object.entries(record)) if (SECRET.test(value)) throw new Error(`seed record "${title}" field ${key} looks like it contains a secret`)
  return record
}

export function mergeSeed(data, seed) {
  const result = { added: 0, updated: 0, unchanged: 0, skipped: [] }
  const records = seed?.records && typeof seed.records === 'object' ? seed.records : {}
  const now = new Date().toISOString()
  for (const [collection, items] of Object.entries(records)) {
    if (!isCollectionKey(collection)) { result.skipped.push(`unknown collection ${collection}`); continue }
    if (!Array.isArray(data[collection])) data[collection] = []
    for (const raw of Array.isArray(items) ? items : []) {
      let incoming
      try { incoming = normalizeSeedRecord(raw) } catch (error) { result.skipped.push(error.message); continue }
      const existing = data[collection].find(item => item.source === incoming.source && item.sourceId === incoming.sourceId)
      if (!existing) {
        data[collection].unshift({ id: randomUUID(), ...incoming, localEdited: false, createdAt: now, updatedAt: now })
        result.added += 1
        continue
      }
      const next = { ...existing, ...incoming }
      if (existing.localEdited) next.status = existing.status
      const changed = Object.keys(incoming).some(key => next[key] !== existing[key])
      if (!changed) { result.unchanged += 1; continue }
      Object.assign(existing, next, { updatedAt: now })
      result.updated += 1
    }
  }
  return result
}
