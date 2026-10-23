#!/usr/bin/env node
// VPS 게이트웨이가 수강생 PC(노드)에 대시보드 파일을 쓸 수 있게 준비한다. 모두 `openclaw config patch` 로, 재시작 불필요.
//   1) file-transfer 플러그인 허용·활성 + policyVersion 2
//   2) 해당 노드의 쓰기 허용 경로 = PC 대시보드 inbox 폴더 (glob **)
//   3) gateway.nodes.commands.allow 에 file.write / file.stat 추가
//   4) 노드 기능 승인 대기(pending) 가 있으면 알려준다 — 승인은 사람이 `openclaw nodes approve <requestId>`
// 사용: node setup_transfer.mjs --node <nodeId|name> --inbox "<PC 절대경로>" [--dry-run] [--save <pc.json>]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cli, configGet, configPatch, listNodes } from './lib/openclaw.mjs'

function fail(message) { const e = new Error(message); e.exitCode = 1; throw e }

function parseArgs(argv) {
  const o = { node: null, inbox: null, dryRun: false, save: null, ask: 'off' }
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i]
    if (f === '--dry-run') { o.dryRun = true; continue }
    const v = argv[++i]
    if (v === undefined) fail(`${f} needs a value`)
    if (f === '--node') o.node = v
    else if (f === '--inbox') o.inbox = v
    else if (f === '--save') o.save = v
    else if (f === '--ask') o.ask = v
    else fail(`unknown option ${f}`)
  }
  if (!o.node) fail('--node <nodeId|displayName> is required (openclaw nodes list)')
  if (!o.inbox) fail('--inbox <absolute path on the PC> is required')
  if (!['off', 'on-miss', 'always'].includes(o.ask)) fail('--ask must be off|on-miss|always')
  return o
}

// PC 경로 정규화: Windows 는 역슬래시→슬래시, 드라이브 문자 유지. 끝 슬래시 제거.
export function normalizeInbox(p) {
  let s = String(p).trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (!/^([A-Za-z]:)?\//.test(s)) fail(`inbox must be an absolute path on the PC (got ${p})`)
  return s
}

export function buildPatch({ nodeId, inbox, ask, existingAllow }) {
  const allow = new Set([...(Array.isArray(existingAllow) ? existingAllow : []), 'file.write', 'file.stat', 'file.create'])
  return {
    plugins: {
      allow: undefined, // 아래에서 채움 (plugins.allow 는 배열 교체라 기존 값을 합쳐야 한다)
      entries: { 'file-transfer': { enabled: true, config: { policyVersion: 2, nodes: { [nodeId]: { ask, allowWritePaths: [`${inbox}/**`], allowReadPaths: [`${inbox}/**`] } } } } },
    },
    gateway: { nodes: { commands: { allow: [...allow] } } },
  }
}

function main() {
  const o = parseArgs(process.argv.slice(2))
  const inbox = normalizeInbox(o.inbox)
  const { nodes, pending } = listNodes()
  const node = nodes.find(n => n.id === o.node) || nodes.find(n => n.name === o.node)
  if (!node) fail(`node not found: ${o.node}. paired nodes: ${nodes.map(n => `${n.name}(${n.id.slice(0, 8)})`).join(', ') || 'none'}`)
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
  const pc = { nodeId: node.id, nodeName: node.name, inbox, savedAt: new Date().toISOString() }
  if (o.save && !o.dryRun) { fs.mkdirSync(path.dirname(o.save), { recursive: true }); fs.writeFileSync(o.save, `${JSON.stringify(pc, null, 2)}\n`, { mode: 0o600 }) }
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
