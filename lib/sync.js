// VPS 캔버스 폴더(manifest/config/seed) → 로컬 설정·저장소 반영.
// applySeed 는 순수 함수에 가깝다(파일 I/O 는 호출자가 넘긴 store/config 함수로). import 와 sync 가 공유한다.
import { normalizeConfig } from './config.js'
import { mergeSeed } from './merge.js'

const AGENT_ID = /^[a-z][a-z0-9-]{1,39}$/

export function validateBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') throw new Error('동기화 데이터가 비어 있습니다.')
  const manifest = bundle.manifest && typeof bundle.manifest === 'object' ? bundle.manifest : { version: null }
  const version = typeof manifest.version === 'string' ? manifest.version.slice(0, 64) : null
  const config = bundle.config && typeof bundle.config === 'object' ? bundle.config : null
  const seed = bundle.seed && typeof bundle.seed === 'object' ? bundle.seed : null
  if (!config && !seed) throw new Error('config 또는 seed 가 필요합니다.')
  if (config) normalizeConfig(config) // throws on bad keys
  return { version, config, seed, reasons: Array.isArray(manifest.reasons) ? manifest.reasons.map(String).slice(0, 20) : [] }
}

// 원격 config 는 메뉴·담당·직원·주차·이름을 가져오되, 로컬에서 정한 즐겨찾기와 메뉴 순서는 지킨다.
export function applyRemoteConfig(local, remote) {
  const remoteNormalized = normalizeConfig(remote)
  const localOrder = local.menus.map(m => m.key)
  const merged = [...local.menus.map(m => ({ ...m }))]
  for (const menu of remoteNormalized.menus) {
    const existing = merged.find(m => m.key === menu.key)
    if (existing) { if (menu.owner) existing.owner = menu.owner; existing.enabledFromWeek = menu.enabledFromWeek }
    else merged.push({ ...menu })
  }
  merged.sort((a, b) => {
    const ia = localOrder.indexOf(a.key); const ib = localOrder.indexOf(b.key)
    if (ia < 0 && ib < 0) return 0
    if (ia < 0) return 1
    if (ib < 0) return -1
    return ia - ib
  })
  return normalizeConfig({
    ...local,
    name: remoteNormalized.name || local.name,
    week: Math.max(local.week, remoteNormalized.week),
    menus: merged,
    favorites: local.favorites.length ? local.favorites : remoteNormalized.favorites,
    agents: remoteNormalized.agents.length ? remoteNormalized.agents : local.agents,
  })
}

export function registeredAgentsFromSeed(seed) {
  return (Array.isArray(seed?.agents) ? seed.agents : []).filter(a => a && AGENT_ID.test(String(a.id))).map(a => ({
    id: a.id, name: String(a.name || a.id).slice(0, 80), emoji: a.emoji ? String(a.emoji).slice(0, 16) : null,
    sessionsCount: Number.isInteger(a.sessionsCount) ? a.sessionsCount : null, lastUpdatedAt: typeof a.lastUpdatedAt === 'string' ? a.lastUpdatedAt : null,
  }))
}

export async function fetchBundle(baseUrl, token, fetchImpl = fetch) {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  const bundle = {}
  for (const name of ['manifest', 'config', 'seed']) {
    const response = await fetchImpl(`${base}${name}.json`, { headers, cache: 'no-store' })
    if (response.status === 401 || response.status === 403) throw new Error('게이트웨이가 토큰을 거부했습니다 (401/403). OPENCLAW_GATEWAY_TOKEN 을 확인하세요.')
    if (response.status === 404) throw new Error(`${name}.json 이 없습니다 (404). VPS 에서 dashboard-builder 로 먼저 생성했는지, canvasHost 가 켜져 있는지 확인하세요.`)
    if (!response.ok) throw new Error(`${name}.json 요청 실패 (${response.status})`)
    bundle[name] = await response.json()
  }
  return bundle
}

export function applyBundle({ bundle, config, data }) {
  const validated = validateBundle(bundle)
  let nextConfig = config
  if (validated.config) nextConfig = applyRemoteConfig(config, validated.config)
  const merge = validated.seed ? mergeSeed(data, validated.seed) : { added: 0, updated: 0, unchanged: 0, skipped: [] }
  const registeredAgents = registeredAgentsFromSeed(validated.seed)
  return { config: nextConfig, merge, registeredAgents, version: validated.version, reasons: validated.reasons }
}
