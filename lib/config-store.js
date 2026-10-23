// dashboard.config.json 파일 읽기/쓰기 (서버 전용). 순수 로직은 config.js 에 있다.
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { defaultConfig, normalizeConfig } from './config.js'

const CONFIG_FILE = path.join(process.cwd(), 'dashboard.config.json')
let writeQueue = Promise.resolve()

export async function readConfig(file = CONFIG_FILE) {
  try { return normalizeConfig(JSON.parse(await readFile(file, 'utf8'))) }
  catch (error) {
    if (error.code === 'ENOENT') return defaultConfig()
    throw error
  }
}

export async function writeConfig(config, file = CONFIG_FILE) {
  const normalized = normalizeConfig(config)
  const operation = writeQueue.then(async () => {
    await mkdir(path.dirname(file), { recursive: true })
    const temp = `${file}.${randomUUID()}.tmp`
    await writeFile(temp, JSON.stringify(normalized, null, 2), { mode: 0o600 })
    await rename(temp, file)
    return normalized
  })
  writeQueue = operation.catch(() => {})
  return operation
}
