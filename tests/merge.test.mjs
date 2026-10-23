import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeSeed } from '../lib/merge.js'

const seed = () => ({ records: { tasks: [
  { title: '업무 지도 정리', body: 'my-work-map.md', status: 'open', source: 'hia-state', sourceId: 'next:1', agent: 'mira' },
  { title: '덱 검토', status: 'working', source: 'hia-state', sourceId: 'working:1' },
] } })

test('new seed records are added with ids and localEdited=false', () => {
  const data = { tasks: [] }
  const result = mergeSeed(data, seed())
  assert.equal(result.added, 2)
  assert.equal(data.tasks.length, 2)
  assert.ok(data.tasks[0].id)
  assert.equal(data.tasks[1].localEdited, false)
  assert.equal(data.tasks.find(t => t.sourceId === 'next:1').agent, 'mira')
})

test('same source/sourceId updates in place; unchanged records are counted', () => {
  const data = { tasks: [] }
  mergeSeed(data, seed())
  const again = seed()
  again.records.tasks[0].body = '업데이트된 본문'
  const result = mergeSeed(data, again)
  assert.equal(result.updated, 1)
  assert.equal(result.unchanged, 1)
  assert.equal(data.tasks.length, 2)
  assert.equal(data.tasks.find(t => t.sourceId === 'next:1').body, '업데이트된 본문')
})

test('locally edited status survives a sync', () => {
  const data = { tasks: [] }
  mergeSeed(data, seed())
  const task = data.tasks.find(t => t.sourceId === 'next:1')
  task.status = 'done'; task.localEdited = true
  mergeSeed(data, seed())
  assert.equal(data.tasks.find(t => t.sourceId === 'next:1').status, 'done')
})

test('deletions are not propagated and bad records are skipped with reasons', () => {
  const data = { tasks: [] }
  mergeSeed(data, seed())
  const result = mergeSeed(data, { records: { tasks: [{ title: '없는 아이디' }], bogus: [] } })
  assert.equal(data.tasks.length, 2)
  assert.equal(result.skipped.length, 2)
})

test('secrets in seed records are refused', () => {
  const data = { tasks: [] }
  const result = mergeSeed(data, { records: { tasks: [{ title: 't', body: 'api_key = abcdef123456', source: 's', sourceId: '1' }] } })
  assert.equal(result.added, 0)
  assert.match(result.skipped[0], /secret/)
})
