#!/usr/bin/env node
// 재료(team.json · HIA STATE.md · openclaw agents list · 개인화 design.json · widget.html)로 대시보드 동기화 파일 3개를 만든다.
//   <out>/manifest.json  버전(내용 해시)·생성 시각·개수·파싱 사유   (기본 <out> = ~/.openclaw/workspace/dashboard, 이후 send_to_pc.mjs 로 PC 에 전송)
//   <out>/config.json    메뉴·담당·즐겨찾기·주차·직원 + 내 업무(customMenus)·테마·위젯
//   <out>/seed.json      칸반 기록 + VPS 에이전트 목록
// 같은 입력이면 같은 version 이 나온다(generatedAt 제외). 기존 파일은 .bak-<시각> 으로 보관한다.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CUSTOM_KEY, normalizeCustomMenus, normalizeTheme, normalizeWidget } from './lib/personalize.mjs'
import { parseState } from './lib/state-parser.mjs'

const MENU_KEYS = ['tasks', 'proposals', 'agents', 'operations', 'sessions', 'console', 'bizkakao', 'kakao', 'email', 'calls', 'contacts', 'post', 'meetingroom', 'dispatch', 'orders', 'coupang', 'sourcing', 'school', 'coupons', 'projects', 'youtube', 'ideas', 'news', 'landing', 'meetings', 'notes', 'plaud', 'books', 'notebooks', 'settings']
const DEFAULT_MENUS = ['tasks', 'agents', 'email', 'ideas', 'notes', 'settings']
const AGENT_ID = /^[a-z][a-z0-9-]{1,39}$/
const SECRET = /(sk-[a-z0-9]{8,}|ghp_[a-z0-9]{10,}|xox[abp]-[a-z0-9-]{10,}|(?:password|passwd|secret|api[_ -]?key|token)\s*[:=]\s*\S{6,})/i

function fail(message, code = 1) { const error = new Error(message); error.exitCode = code; throw error }

function parseArgs(argv) {
  const options = { menus: [], owners: {}, favorites: null, week: null, name: null, team: null, state: null, agents: null, out: null, quiet: false, design: null, widget: null, widgetTitle: null }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    if (flag === '--quiet') { options.quiet = true; continue }
    const value = argv[++i]
    if (value === undefined || value.startsWith('--')) fail(`${flag} needs a value`)
    switch (flag) {
      case '--team': options.team = value; break
      case '--state': options.state = value; break
      case '--agents': options.agents = value; break
      case '--out': options.out = value; break
      case '--name': options.name = value; break
      case '--design': options.design = value; break
      case '--widget': options.widget = value; break
      case '--widget-title': options.widgetTitle = value; break
      case '--week': options.week = Number(value); break
      case '--menus': options.menus.push(...value.split(',').map(s => s.trim()).filter(Boolean)); break
      case '--favorites': options.favorites = value.split(',').map(s => s.trim()).filter(Boolean); break
      case '--owner': { const [key, agent] = value.split('='); if (!key || !agent) fail('--owner needs key=agentId'); options.owners[key] = agent; break }
      default: fail(`unknown option: ${flag}`)
    }
  }
  if (!options.out) options.out = path.join(os.homedir(), '.openclaw', 'workspace', 'dashboard')
  if (options.week !== null && !(Number.isInteger(options.week) && options.week >= 1 && options.week <= 4)) fail('--week must be 1-4')
  for (const agent of Object.values(options.owners)) if (!AGENT_ID.test(agent)) fail(`invalid agent id: ${agent}`)
  return options
}

function readJson(file, label) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (error) { fail(`${label}: cannot read ${file} (${error.message})`) }
}

function loadTeam(file) {
  if (!file) return { team: null, agents: [], reason: 'no team.json given — single-agent dashboard' }
  if (!fs.existsSync(file)) return { team: null, agents: [], reason: `team.json not found at ${file} — run agent-team-onboarding first, or continue as a single-agent dashboard` }
  const raw = readJson(file, 'team.json')
  if (raw.version !== 1 || !Array.isArray(raw.agents)) fail('team.json: expected { version: 1, agents: [...] }')
  const agents = raw.agents.filter(a => a && AGENT_ID.test(String(a.id))).map(a => ({
    id: a.id, name: String(a.name || a.id), emoji: String(a.emoji || '🤖'), role: String(a.role || ''), mission: String(a.mission || ''),
    coordinator: a.coordinator === true, menus: (Array.isArray(a.menus) ? a.menus : []).filter(m => MENU_KEYS.includes(m) || CUSTOM_KEY.test(m)),
    firstTasks: Array.isArray(a.firstTasks) ? a.firstTasks : [],
  }))
  return { team: raw.team || null, agents, reason: null }
}

// VPS 의 실제 에이전트 목록. --agents <json> 이 있으면 그 파일, 없으면 openclaw CLI 를 1회 시도한다.
function loadRegisteredAgents(file) {
  if (file) return { list: readJson(file, 'agents list'), reason: null }
  try {
    const bin = process.env.OPENCLAW_BIN || 'openclaw'
    const text = execFileSync(bin, ['agents', 'list', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000 })
    return { list: JSON.parse(text), reason: null }
  } catch (error) {
    return { list: [], reason: `openclaw agents list unavailable (${String(error.message).split('\n')[0].slice(0, 120)}) — registered flags left unknown` }
  }
}

// 개인화 재료. 주지 않으면 이전 config.json 의 값을 그대로 쓴다(업데이트 때 사라지지 않게).
function loadPersonalization(options, existing) {
  let design = null
  if (options.design) {
    design = readJson(options.design, 'design.json')
    if (!design || typeof design !== 'object' || Array.isArray(design)) fail('design.json: expected { customMenus?, theme? }')
  }
  const custom = design && design.customMenus !== undefined ? normalizeCustomMenus(design.customMenus) : { customMenus: normalizeCustomMenus(existing?.customMenus).customMenus, owners: {} }
  const theme = design && design.theme !== undefined ? normalizeTheme(design.theme) : normalizeTheme(existing?.theme)
  let widget = existing?.widget ? normalizeWidget(existing.widget) : null
  if (options.widget === 'none') widget = null
  else if (options.widget) {
    if (!fs.existsSync(options.widget)) fail(`widget: cannot read ${options.widget}`)
    widget = normalizeWidget({ title: options.widgetTitle || widget?.title, html: fs.readFileSync(options.widget, 'utf8') })
    if (!widget) fail('widget: file is empty')
  } else if (options.widgetTitle && widget) widget = { ...widget, title: normalizeWidget({ title: options.widgetTitle, html: widget.html }).title }
  return { customMenus: custom.customMenus, designOwners: custom.owners, theme, widget }
}

function buildConfig(options, teamInfo, existing, personal) {
  const customKeys = personal.customMenus.map(menu => menu.key)
  const allKeys = [...customKeys, ...MENU_KEYS]
  for (const key of [...options.menus, ...Object.keys(options.owners), ...(options.favorites || [])]) if (!allKeys.includes(key)) fail(`unknown menu key: ${key}`)
  const menuKeys = []
  const push = key => { if (allKeys.includes(key) && !menuKeys.includes(key)) menuKeys.push(key) }
  // 내 업무(커스텀 메뉴)를 맨 앞에. 이전에 있던 순서는 그대로 두고 새로 생긴 것만 앞에 붙인다.
  const previous = existing?.menus?.map(m => m.key) || []
  for (const key of customKeys) if (!previous.includes(key)) push(key)
  for (const key of previous.length ? previous : DEFAULT_MENUS) push(key)
  for (const key of DEFAULT_MENUS) push(key)
  for (const key of options.menus) push(key)
  for (const key of customKeys) push(key)
  for (const agent of teamInfo.agents) for (const key of agent.menus) push(key)
  const existingOwners = Object.fromEntries((existing?.menus || []).map(m => [m.key, m.owner || '']))
  const menus = menuKeys.map(key => ({
    key,
    owner: options.owners[key] || personal.designOwners[key] || teamInfo.agents.find(a => a.menus.includes(key))?.id || existingOwners[key] || '',
  }))
  return {
    version: 1,
    name: options.name || existing?.name || (teamInfo.team?.userName ? `${teamInfo.team.userName}의 AI 오피스` : '내 AI 오피스'),
    week: options.week || existing?.week || 1,
    menus,
    favorites: (options.favorites || existing?.favorites || [...customKeys, ...DEFAULT_MENUS]).filter(key => menuKeys.includes(key)).slice(0, 6),
    agents: teamInfo.agents.map(({ firstTasks, ...agent }) => agent),
    customMenus: personal.customMenus,
    theme: personal.theme,
    widget: personal.widget,
  }
}

function buildSeed(options, teamInfo, registered) {
  const reasons = []
  const records = { tasks: [] }
  if (options.state) {
    if (!fs.existsSync(options.state)) reasons.push(`STATE.md not found at ${options.state} — kanban left empty`)
    else {
      const parsed = parseState(fs.readFileSync(options.state, 'utf8'))
      records.tasks.push(...parsed.items)
      reasons.push(...parsed.reasons.map(r => `STATE.md: ${r}`))
    }
  } else reasons.push('no --state given — kanban has only first tasks from team.json')
  // 온보딩에서 제안한 첫 과제는 "대기" 칸에 담당자와 함께 넣는다 (아직 실행 전이라는 뜻).
  for (const agent of teamInfo.agents) for (const [index, task] of agent.firstTasks.entries()) {
    if (!task?.task) continue
    records.tasks.push({ title: String(task.task).slice(0, 120), body: `왜 지금: ${task.why || '-'}\n완료 기준: ${task.doneWhen || '-'}`, status: 'open', agent: agent.id, source: 'team-onboarding', sourceId: `${agent.id}:first:${index}` })
  }
  const registeredIds = new Set((Array.isArray(registered.list) ? registered.list : []).map(a => a?.id).filter(Boolean))
  const agents = (Array.isArray(registered.list) ? registered.list : []).map(a => ({
    id: a.id, name: a.identityName || a.name || a.id, emoji: a.identityEmoji || null, sessionsCount: a.sessionsCount ?? null, lastUpdatedAt: a.lastUpdatedAt || null,
  }))
  for (const agent of teamInfo.agents) if (!registeredIds.has(agent.id) && registered.reason === null) reasons.push(`team.json agent ${agent.id} is not registered in openclaw — run agent-team-onboarding status`)
  if (registered.reason) reasons.push(registered.reason)
  return { records, agents, reasons }
}

function scanSecrets(value, trail = '$') {
  if (typeof value === 'string') { if (SECRET.test(value)) fail(`secret-looking value at ${trail}; refusing to write dashboard files`, 3); return }
  if (Array.isArray(value)) value.forEach((v, i) => scanSecrets(v, `${trail}[${i}]`))
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) scanSecrets(v, `${trail}.${k}`)
}

function stable(value) { return JSON.stringify(value, Object.keys(value).sort()) }
function hashOf(config, seed) { return createHash('sha256').update(JSON.stringify(config)).update(JSON.stringify(seed)).digest('hex').slice(0, 16) }

function backup(file) {
  if (!fs.existsSync(file)) return null
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const target = `${file}.bak-${stamp}`
  fs.renameSync(file, target)
  return target
}

export function build(options) {
  const teamInfo = loadTeam(options.team)
  const registered = loadRegisteredAgents(options.agents)
  const existingConfigPath = path.join(options.out, 'config.json')
  const existing = fs.existsSync(existingConfigPath) ? (() => { try { return JSON.parse(fs.readFileSync(existingConfigPath, 'utf8')) } catch { return null } })() : null
  const personal = loadPersonalization(options, existing)
  const config = buildConfig(options, teamInfo, existing, personal)
  const seed = buildSeed(options, teamInfo, registered)
  const reasons = [...seed.reasons]
  if (teamInfo.reason) reasons.unshift(teamInfo.reason)
  const seedOut = { version: 1, records: seed.records, agents: seed.agents }
  scanSecrets(config, 'config'); scanSecrets(seedOut, 'seed')
  const version = hashOf(config, seedOut)
  const manifest = { version, generatedAt: new Date().toISOString(), generator: 'dashboard-builder/0.3', counts: { menus: config.menus.length, customMenus: config.customMenus.length, widget: config.widget ? 1 : 0, agents: config.agents.length, tasks: seed.records.tasks.length, registeredAgents: seed.agents.length }, reasons }
  fs.mkdirSync(options.out, { recursive: true })
  const backups = []
  for (const [name, content] of [['config.json', config], ['seed.json', seedOut], ['manifest.json', manifest]]) {
    const file = path.join(options.out, name)
    const previous = backup(file)
    if (previous) backups.push(previous)
    fs.writeFileSync(file, `${JSON.stringify(content, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  }
  return { ok: true, out: options.out, version, counts: manifest.counts, reasons, backups, menus: config.menus, name: config.name, week: config.week, customMenus: config.customMenus.map(m => `${m.key} (${m.label})`), theme: config.theme, widget: config.widget ? { title: config.widget.title, chars: config.widget.html.length } : null }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    const options = parseArgs(process.argv.slice(2))
    const result = build(options)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`)
    process.exitCode = error.exitCode || 1
  }
}
