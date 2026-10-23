// PC 쪽 inbox (.data/inbox/): VPS 에이전트가 file.write 로 넣어 둔 manifest/config/seed 를 읽는다.
// 서버 전용. 읽기만 하고 파일은 지우지 않는다(마지막으로 반영한 version 을 기억해 중복 반영을 막는다).
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

export const INBOX_DIR = path.join(process.cwd(), '.data', 'inbox')
const NAMES = ['manifest', 'config', 'seed']

async function readJsonIfExists(file) {
  try { return JSON.parse(await readFile(file, 'utf8')) }
  catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

// { present, version, generatedAt, updatedAt, bundle? }
export async function readInbox(dir = INBOX_DIR) {
  const manifest = await readJsonIfExists(path.join(dir, 'manifest.json'))
  if (!manifest) return { present: false, version: null, generatedAt: null, updatedAt: null }
  const [config, seed] = await Promise.all([readJsonIfExists(path.join(dir, 'config.json')), readJsonIfExists(path.join(dir, 'seed.json'))])
  let updatedAt = null
  try { updatedAt = (await stat(path.join(dir, 'manifest.json'))).mtime.toISOString() } catch {}
  return {
    present: true,
    version: typeof manifest.version === 'string' ? manifest.version : null,
    generatedAt: typeof manifest.generatedAt === 'string' ? manifest.generatedAt : null,
    updatedAt,
    bundle: { manifest, config, seed },
  }
}

// 반영할 게 있는지: inbox 에 파일이 있고, 마지막 반영 version 과 다를 때
export function inboxIsNew(inbox, lastVersion) {
  return Boolean(inbox.present && inbox.version && inbox.version !== lastVersion)
}

export function describeInbox(inbox, lastVersion) {
  return { present: inbox.present, version: inbox.version, generatedAt: inbox.generatedAt, updatedAt: inbox.updatedAt, isNew: inboxIsNew(inbox, lastVersion), dir: INBOX_DIR, names: NAMES }
}
