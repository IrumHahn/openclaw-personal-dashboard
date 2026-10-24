// PC 쪽 inbox: VPS 에이전트가 넣어 둔 manifest/config/seed 를 읽는다.
// 서버 전용. 읽기만 하고 파일은 지우지 않는다(마지막으로 반영한 version 을 기억해 중복 반영을 막는다).
// 두 가지 모양을 받는다:
//   - <name>.json  : 헤드리스 노드 + file-transfer(file.write) 가 그대로 쓴 파일
//   - <name>.b64   : Windows Hub 앱 노드(샌드박스)에서 `cmd echo` 로 이어붙인 base64 텍스트 (줄바꿈·공백 섞여 있어도 됨)
// 둘 다 있으면 더 최근에 바뀐 쪽을 쓴다.
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

// 기본은 앱 폴더 안 .data/inbox. 수강생 PC 는 setup 스크립트가 Documents\openclaw-dashboard\inbox 로 잡아 .env.local 에 넣는다.
export const INBOX_DIR = process.env.DASHBOARD_INBOX_DIR ? path.resolve(process.env.DASHBOARD_INBOX_DIR) : path.join(process.cwd(), '.data', 'inbox')
const NAMES = ['manifest', 'config', 'seed']

async function mtimeOrNull(file) {
  try { return (await stat(file)).mtimeMs } catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

export function decodeBase64Text(text) {
  const compact = String(text).replace(/\s+/g, '')
  if (!compact) throw new Error('empty base64')
  if (!/^[A-Za-z0-9+/]+=*$/.test(compact)) throw new Error('not base64')
  return Buffer.from(compact, 'base64').toString('utf8')
}

// { value, format, file } 또는 null. 손상된 파일은 에러 대신 null + reason 으로 돌려준다(전송 도중일 수 있다).
async function readOne(dir, name) {
  const json = path.join(dir, `${name}.json`)
  const b64 = path.join(dir, `${name}.b64`)
  const [jsonAt, b64At] = await Promise.all([mtimeOrNull(json), mtimeOrNull(b64)])
  if (jsonAt === null && b64At === null) return null
  const useB64 = jsonAt === null || (b64At !== null && b64At >= jsonAt)
  const file = useB64 ? b64 : json
  try {
    const raw = await readFile(file, 'utf8')
    return { value: JSON.parse(useB64 ? decodeBase64Text(raw) : raw), format: useB64 ? 'b64' : 'json', file }
  } catch (error) {
    return { value: null, format: useB64 ? 'b64' : 'json', file, reason: error.message }
  }
}

// { present, version, generatedAt, updatedAt, format, bundle?, problems[] }
export async function readInbox(dir = INBOX_DIR) {
  const manifestEntry = await readOne(dir, 'manifest')
  if (!manifestEntry || !manifestEntry.value) {
    return { present: false, version: null, generatedAt: null, updatedAt: null, format: null, problems: manifestEntry?.reason ? [`manifest: ${manifestEntry.reason}`] : [] }
  }
  const manifest = manifestEntry.value
  const [configEntry, seedEntry] = await Promise.all([readOne(dir, 'config'), readOne(dir, 'seed')])
  const problems = [configEntry, seedEntry].filter(e => e?.reason).map(e => `${path.basename(e.file)}: ${e.reason}`)
  let updatedAt = null
  try { updatedAt = (await stat(manifestEntry.file)).mtime.toISOString() } catch {}
  return {
    present: true,
    version: typeof manifest.version === 'string' ? manifest.version : null,
    generatedAt: typeof manifest.generatedAt === 'string' ? manifest.generatedAt : null,
    updatedAt,
    format: manifestEntry.format,
    bundle: { manifest, config: configEntry?.value ?? null, seed: seedEntry?.value ?? null },
    problems,
  }
}

// 반영할 게 있는지: inbox 에 파일이 있고, 마지막 반영 version 과 다를 때. 일부 파일이 깨져 있으면(전송 중) 기다린다.
export function inboxIsNew(inbox, lastVersion) {
  return Boolean(inbox.present && inbox.version && inbox.version !== lastVersion && !(inbox.problems && inbox.problems.length))
}

export function describeInbox(inbox, lastVersion) {
  return { present: inbox.present, version: inbox.version, generatedAt: inbox.generatedAt, updatedAt: inbox.updatedAt, format: inbox.format || null, problems: inbox.problems || [], isNew: inboxIsNew(inbox, lastVersion), dir: INBOX_DIR, names: NAMES }
}
