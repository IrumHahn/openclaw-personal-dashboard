import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const COLLECTIONS = ['tasks', 'proposals', 'email', 'contacts', 'meetings', 'notes', 'notebooks']
const DATA_DIR = path.join(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'dashboard.json')
let writeQueue = Promise.resolve()

function emptyData() {
  return Object.fromEntries(COLLECTIONS.map(name => [name, []]))
}

export async function readStore() {
  try {
    const saved = JSON.parse(await readFile(DATA_FILE, 'utf8'))
    return Object.fromEntries(COLLECTIONS.map(name => [name, Array.isArray(saved[name]) ? saved[name] : []]))
  } catch (error) {
    if (error.code === 'ENOENT') return emptyData()
    throw error
  }
}

function clean(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function normalize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid record')
  const title = clean(input.title, 200)
  if (!title) throw new Error('Title is required')
  return {
    title,
    body: clean(input.body, 100000),
    summary: clean(input.summary, 5000),
    person: clean(input.person, 200),
    status: clean(input.status, 40) || 'open',
    date: clean(input.date, 40),
    dueAt: clean(input.dueAt, 40),
    link: clean(input.link, 1000),
    source: clean(input.source, 80),
    sourceId: clean(input.sourceId, 200),
  }
}

async function persist(data) {
  await mkdir(DATA_DIR, { recursive: true, mode: 0o700 })
  const temp = path.join(DATA_DIR, `dashboard.${randomUUID()}.tmp`)
  await writeFile(temp, JSON.stringify(data, null, 2), { mode: 0o600 })
  await rename(temp, DATA_FILE)
}

export function mutateStore(mutator) {
  const operation = writeQueue.then(async () => {
    const data = await readStore()
    const result = mutator(data)
    await persist(data)
    return result
  })
  writeQueue = operation.catch(() => {})
  return operation
}

export function addRecord(data, collection, input) {
  if (!COLLECTIONS.includes(collection)) throw new Error('Unknown collection')
  const values = normalize(input)
  if (values.source && values.sourceId) {
    const existing = data[collection].find(item => item.source === values.source && item.sourceId === values.sourceId)
    if (existing) return { record: existing, created: false }
  }
  const now = new Date().toISOString()
  const record = { id: randomUUID(), ...values, createdAt: now, updatedAt: now }
  data[collection].unshift(record)
  return { record, created: true }
}

export function updateRecord(data, collection, id, input) {
  if (!COLLECTIONS.includes(collection)) throw new Error('Unknown collection')
  const index = data[collection].findIndex(item => item.id === id)
  if (index < 0) throw new Error('Record not found')
  const updated = { ...data[collection][index], ...normalize({ ...data[collection][index], ...input }), updatedAt: new Date().toISOString() }
  data[collection][index] = updated
  return updated
}
