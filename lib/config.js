// dashboard.config.json — 어떤 메뉴를 켰는지, 누가 담당인지, 즐겨찾기, 주차.
// 동기화(VPS seed)와 설정 화면 둘 다 이 파일을 고친다. 항상 normalizeConfig 를 거친다.
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DEFAULT_FAVORITES, DEFAULT_MENU_KEYS, MENU_BY_KEY, isValidMenuKey } from './menu-tree.js'

export const CONFIG_VERSION = 1
const AGENT_ID = /^[a-z][a-z0-9-]{1,39}$/
const MAX_WEEK = 4

export function defaultConfig() {
  return normalizeConfig({ version: CONFIG_VERSION, name: '내 AI 오피스', week: 1, menus: DEFAULT_MENU_KEYS.map(key => ({ key })), favorites: DEFAULT_FAVORITES, agents: [] })
}

function clean(value, limit) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, limit) : ''
}

export function normalizeConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('config must be an object')
  const week = Number.isInteger(input.week) && input.week >= 1 && input.week <= MAX_WEEK ? input.week : 1
  const seen = new Set()
  const menus = []
  for (const raw of Array.isArray(input.menus) ? input.menus : []) {
    const item = typeof raw === 'string' ? { key: raw } : raw
    if (!item || !isValidMenuKey(item.key)) throw new Error(`unknown menu key: ${item?.key}`)
    if (seen.has(item.key)) continue
    seen.add(item.key)
    const owner = clean(item.owner, 40)
    if (owner && !AGENT_ID.test(owner)) throw new Error(`invalid owner id for ${item.key}: ${owner}`)
    const enabledFromWeek = Number.isInteger(item.enabledFromWeek) && item.enabledFromWeek >= 1 && item.enabledFromWeek <= MAX_WEEK ? item.enabledFromWeek : MENU_BY_KEY[item.key].defaultWeek
    menus.push({ key: item.key, owner, enabledFromWeek })
  }
  if (!seen.has('settings')) menus.push({ key: 'settings', owner: '', enabledFromWeek: 1 })
  if (!seen.has('agents')) menus.push({ key: 'agents', owner: '', enabledFromWeek: 1 })
  const favorites = []
  for (const key of Array.isArray(input.favorites) ? input.favorites : DEFAULT_FAVORITES) {
    if (isValidMenuKey(key) && !favorites.includes(key) && favorites.length < 6) favorites.push(key)
  }
  const agents = []
  const agentIds = new Set()
  for (const raw of Array.isArray(input.agents) ? input.agents : []) {
    if (!raw || typeof raw !== 'object') continue
    const id = clean(raw.id, 40)
    if (!AGENT_ID.test(id) || agentIds.has(id)) continue
    agentIds.add(id)
    agents.push({
      id,
      name: clean(raw.name, 80) || id,
      emoji: clean(raw.emoji, 16) || '🤖',
      role: clean(raw.role, 120),
      mission: clean(raw.mission, 500),
      coordinator: raw.coordinator === true,
      menus: (Array.isArray(raw.menus) ? raw.menus : []).filter(isValidMenuKey),
    })
  }
  // 메뉴에 owner 가 없고 에이전트 쪽 menus 에 적혀 있으면 그쪽을 owner 로 반영한다.
  for (const menu of menus) if (!menu.owner) {
    const owner = agents.find(agent => agent.menus.includes(menu.key))
    if (owner) menu.owner = owner.id
  }
  return {
    version: CONFIG_VERSION,
    name: clean(input.name, 60) || '내 AI 오피스',
    week,
    menus,
    favorites,
    agents,
    sync: {
      lastSuccessAt: typeof input.sync?.lastSuccessAt === 'string' ? input.sync.lastSuccessAt : null,
      lastVersion: typeof input.sync?.lastVersion === 'string' ? input.sync.lastVersion : null,
      lastError: typeof input.sync?.lastError === 'string' ? input.sync.lastError : null,
    },
  }
}

export function visibleMenus(config) {
  return config.menus.map(menu => ({ ...MENU_BY_KEY[menu.key], owner: menu.owner, enabledFromWeek: menu.enabledFromWeek, locked: menu.enabledFromWeek > config.week }))
}

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
