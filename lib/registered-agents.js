// VPS 에서 동기화해 온 "실제 등록된 에이전트" 목록. PC 의 openclaw CLI 가 원격 게이트웨이를
// 못 볼 수 있어 seed 에 실어 온 값을 따로 보관한다.
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const FILE = path.join(process.cwd(), '.data', 'registered-agents.json')

export async function readRegisteredAgents() {
  try { const parsed = JSON.parse(await readFile(FILE, 'utf8')); return Array.isArray(parsed.agents) ? parsed : { agents: [], syncedAt: null } }
  catch (error) { if (error.code === 'ENOENT') return { agents: [], syncedAt: null }; throw error }
}

export async function saveRegisteredAgents(agents) {
  await mkdir(path.dirname(FILE), { recursive: true, mode: 0o700 })
  const temp = `${FILE}.${randomUUID()}.tmp`
  await writeFile(temp, JSON.stringify({ agents, syncedAt: new Date().toISOString() }, null, 2), { mode: 0o600 })
  await rename(temp, FILE)
}
