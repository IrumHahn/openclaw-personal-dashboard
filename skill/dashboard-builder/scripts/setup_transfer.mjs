#!/usr/bin/env node
// VPS 게이트웨이가 수강생 PC(노드)에 대시보드 파일을 쓸 수 있게 준비한다. 모두 `openclaw config patch` 로, 재시작 불필요.
//   1) file-transfer 플러그인 허용·활성 + policyVersion 2
//   2) 해당 노드의 쓰기 허용 경로 = PC 대시보드 inbox 폴더 (glob **)
//   3) gateway.nodes.commands.allow 에 file.write / file.stat / file.create / file.fetch(수습 채점 읽기) 추가
//   4) 노드 기능 승인 대기(pending) 가 있으면 알려준다 — 승인은 사람이 `openclaw nodes approve <requestId>`
// 사용: node setup_transfer.mjs --node <nodeId|name> --inbox "<PC 절대경로>" [--transport file|hub] [--dry-run] [--save <pc.json>]
//   --transport file (기본): 헤드리스 노드(openclaw node run). 위 1)~4) 를 모두 한다.
//   --transport hub        : Windows Hub 앱 노드. file.write 가 없어 게이트웨이 설정은 건드리지 않고 pc.json 만 저장한다.
//                            inbox 는 "%USERPROFILE%\Documents\openclaw-dashboard\inbox" 처럼 cmd 변수를 써도 된다(PC 의 cmd 가 푼다).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cli, configGet, configPatch, listNodes } from './lib/openclaw.mjs'

function fail(message) { const e = new Error(message); e.exitCode = 1; throw e }

function parseArgs(argv) {
  const o = { node: null, inbox: null, dryRun: false, save: null, ask: 'off', transport: 'file' }
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i]
    if (f === '--dry-run') { o.dryRun = true; continue }
    const v = argv[++i]
    if (v === undefined) fail(`${f} needs a value`)
    if (f === '--node') o.node = v
    else if (f === '--inbox') o.inbox = v
    else if (f === '--save') o.save = v
    else if (f === '--ask') o.ask = v
    else if (f === '--transport') o.transport = v
    else fail(`unknown option ${f}`)
  }
  if (!o.node) fail('--node <nodeId|displayName> is required (openclaw nodes list)')
  if (!o.inbox) fail('--inbox <absolute path on the PC> is required')
  if (!['off', 'on-miss', 'always'].includes(o.ask)) fail('--ask must be off|on-miss|always')
  if (!['file', 'hub'].includes(o.transport)) fail('--transport must be file|hub')
  return o
}

// PC 경로 정규화: Windows 는 역슬래시→슬래시, 드라이브 문자 유지. 끝 슬래시 제거.
export function normalizeInbox(p) {
  let s = String(p).trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (!/^([A-Za-z]:)?\//.test(s)) fail(`inbox must be an absolute path on the PC (got ${p})`)
  return s
}

export function buildPatch({ nodeId, inbox, ask, existingAllow }) {
  const allow = new Set([...(Array.isArray(existingAllow) ? existingAllow : []), 'file.write', 'file.stat', 'file.create', 'file.fetch'])
  return {
    plugins: {
      allow: undefined, // 아래에서 채움 (plugins.allow 는 배열 교체라 기존 값을 합쳐야 한다)
      entries: { 'file-transfer': { enabled: true, config: { policyVersion: 2, nodes: { [nodeId]: { ask, allowWritePaths: [`${inbox}/**`], allowReadPaths: [`${inbox}/**`] } } } } },
    },
    gateway: { nodes: { commands: { allow: [...allow] } } },
  }
}

// Hub 앱용 inbox: Windows 경로. %VAR% 는 그대로 두고(PC 의 cmd 가 푼다) 역슬래시로 통일, 끝 구분자 제거.
export function normalizeHubInbox(p) {
  const s = String(p).trim().replace(/\//g, '\\').replace(/[\\]+$/, '')
  if (!/^(%[A-Za-z_][A-Za-z0-9_]*%|[A-Za-z]:)\\/.test(s)) fail(`hub inbox must be a Windows path starting with a drive or %VAR% (got ${p})`)
  if (/[&|<>^"]/.test(s)) fail(`hub inbox must not contain & | < > ^ " (got ${p})`)
  return s
}

function savePc(pc, save) {
  fs.mkdirSync(path.dirname(save), { recursive: true })
  fs.writeFileSync(save, `${JSON.stringify(pc, null, 2)}\n`, { mode: 0o600 })
}

function main() {
  const o = parseArgs(process.argv.slice(2))
  const { nodes, pending } = listNodes()
  const node = nodes.find(n => n.id === o.node) || nodes.find(n => n.name === o.node)
  if (!node) fail(`node not found: ${o.node}. paired nodes: ${nodes.map(n => `${n.name}(${n.id.slice(0, 8)})`).join(', ') || 'none'}`)
  if (o.transport === 'hub') {
    const inbox = normalizeHubInbox(o.inbox)
    const pc = { transport: 'hub', nodeId: node.id, nodeName: node.name, inbox, savedAt: new Date().toISOString() }
    if (o.save && !o.dryRun) savePc(pc, o.save)
    const out = {
      ok: true, dryRun: o.dryRun, transport: 'hub', node: { id: node.id, name: node.name, connected: node.connected, hasSystemRun: node.commands.includes('system.run') }, inbox,
      pendingApprovals: pending, patch: { skipped: 'hub transport does not change gateway config' },
      nextSteps: [
        ...(pending.length ? [`노드 기능 승인이 필요합니다: ${pending.map(p => `openclaw nodes approve ${p.requestId}`).join(' ; ')}`] : []),
        ...(!node.connected ? ['노드가 지금 연결돼 있지 않습니다. PC 에서 OpenClaw Hub 앱이 켜져 있고 Permissions > Windows node 가 On 인지 확인하세요.'] : []),
        ...(node.commands.length && !node.commands.includes('system.run') ? ['이 노드는 system.run 을 광고하지 않습니다. Hub 앱 Permissions 에서 노드 모드를 켜고 다시 승인하세요.'] : []),
        'PC 의 Hub 앱 Settings > Sandbox 가 Recommended 이고 Documents 가 Read+write 인지 확인하세요(기본 Locked Down 에서는 파일을 쓸 수 없습니다).',
        `전송 명령 만들기: node send_to_pc.mjs --pc ${o.save || '<pc.json>'}  → 나온 명령을 exec(host=node) 로 순서대로 실행`,
      ],
    }
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
    return
  }
  const inbox = normalizeInbox(o.inbox)
  const pluginsAllow = configGet('plugins.allow')
  const existingCmdAllow = configGet('gateway.nodes.commands.allow')
  const patch = buildPatch({ nodeId: node.id, inbox, ask: o.ask, existingAllow: existingCmdAllow })
  const allowList = new Set([...(Array.isArray(pluginsAllow) ? pluginsAllow : []), 'file-transfer'])
  patch.plugins.allow = [...allowList]
  const tmpPath = path.join(os.tmpdir(), `dashboard-transfer-${process.pid}.json`)
  const result = configPatch(patch, { dryRunOnly: o.dryRun, writeFile: fs.writeFileSync, tmpPath })
  try { fs.unlinkSync(tmpPath) } catch {}
  let pluginState = null
  try { pluginState = cli(['plugins', 'list']).split('\n').find(l => /file-transfer/.test(l)) || null } catch {}
  const pc = { transport: 'file', nodeId: node.id, nodeName: node.name, inbox, savedAt: new Date().toISOString() }
  if (o.save && !o.dryRun) savePc(pc, o.save)
  const out = {
    ok: true, dryRun: o.dryRun, node: { id: node.id, name: node.name, connected: node.connected }, inbox,
    pendingApprovals: pending, pluginState, patch: result,
    nextSteps: [
      ...(pending.length ? [`노드 기능 승인이 필요합니다: ${pending.map(p => `openclaw nodes approve ${p.requestId}`).join(' ; ')}`] : []),
      ...(!node.connected ? ['노드가 지금 연결돼 있지 않습니다. PC 에서 OpenClaw 노드가 실행 중인지 확인하세요.'] : []),
      `전송: node send_to_pc.mjs --pc ${o.save || '<pc.json>'}`,
    ],
  }
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { main() } catch (error) { process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`); process.exitCode = error.exitCode || 1 }
}
