import assert from 'node:assert/strict'
import test from 'node:test'
import { parseState } from '../skill/dashboard-builder/scripts/lib/state-parser.mjs'

const sample = `# 프로젝트 — 현재 상태

- 최종 갱신: 2026-10-23
- 진행 중 작업: 1주차 덱 검토 (사용자 검토 전)

## 현재 상태
- 완료(2026-10-21): **1주차 강의 덱** 58장 — 검토 전.
- 제안(2026-10-22): 커리큘럼 v4 — 확정 전.
- 완료(2026-10-21, 운영 배포): **에이전트 광장** 배포.

## 다음 행동
0-0. 1주차 덱 사용자 검토·수정 → 설치 실증
1. 입장 현황 확인, 미입장자 리마인드
2. 첫 토론 주제 결정

## 막힌 점
- 없음
`

test('classifies next actions, working item and completed bullets', () => {
  const { items, reasons } = parseState(sample)
  assert.deepEqual(reasons, [])
  assert.deepEqual(items.filter(i => i.status === 'open').map(i => i.title), ['1주차 덱 사용자 검토·수정 → 설치 실증', '입장 현황 확인, 미입장자 리마인드', '첫 토론 주제 결정'])
  assert.equal(items.filter(i => i.status === 'working').length, 1)
  assert.deepEqual(items.filter(i => i.status === 'done').map(i => i.title), ['1주차 강의 덱 58장', '에이전트 광장 배포.'])
  for (const item of items) assert.match(item.sourceId, /^(next|working|done):[0-9a-f]{12}$/)
})

test('same input gives same sourceIds (deterministic)', () => {
  const a = parseState(sample).items.map(i => i.sourceId)
  const b = parseState(sample).items.map(i => i.sourceId)
  assert.deepEqual(a, b)
})

test('"진행 중 작업: 없음" produces no working item; missing sections are reported, not invented', () => {
  const { items, reasons } = parseState('# x\n- 진행 중 작업: 없음\n\n## 다음 행동\n(비어 있음)\n')
  assert.equal(items.length, 0)
  assert.ok(reasons.some(r => /no list items/.test(r)))
  assert.ok(reasons.some(r => /현재 상태/.test(r)))
  assert.deepEqual(parseState('').items, [])
})
