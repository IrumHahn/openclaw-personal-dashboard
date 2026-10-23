#!/usr/bin/env node
// 전송 준비 점검: 빌드 파일 3개 존재·JSON 유효·비밀값 없음, pc.json 존재, 노드 연결·기능 승인 대기, file-transfer 플러그인 상태.
// 네트워크 호출 없음(openclaw CLI 조회만). 사용: node check_sync.mjs [--out <dir>] [--pc <pc.json>]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cli, configGet, listNodes } from './lib/openclaw.mjs'

const SECRET = /(sk-[a-z0-9]{8,}|ghp_[a-z0-9]{10,}|(?:password|passwd|secret|api[_ -]?key|token)\s*[:=]\s*\S{6,})/i
const argv = process.argv.slice(2)
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined }
const dir = flag('--out') || path.join(os.homedir(), '.openclaw', 'workspace', 'dashboard')
const pcPath = flag('--pc') || path.join(dir, 'pc.json')
const problems = []
const files = {}
for (const name of ['manifest.json', 'config.json', 'seed.json']) {
  const file = path.join(dir, name)
  if (!fs.existsSync(file)) { problems.push(`${name} missing in ${dir} — run build_dashboard.mjs`); continue }
  const text = fs.readFileSync(file, 'utf8')
  try { files[name] = JSON.parse(text) } catch { problems.push(`${name} is not valid JSON`); continue }
  if (SECRET.test(text)) problems.push(`${name} contains a secret-looking value — rebuild without it`)
}
let pc = null
if (fs.existsSync(pcPath)) { try { pc = JSON.parse(fs.readFileSync(pcPath, 'utf8')) } catch { problems.push('pc.json is not valid JSON') } }
else problems.push(`pc.json missing (${pcPath}) — run setup_transfer.mjs --node <PC> --inbox <path> --save ${pcPath}`)
let node = null; let pending = []
try {
  const list = listNodes(); pending = list.pending
  node = pc ? list.nodes.find(n => n.id === pc.nodeId) || null : null
  if (pc && !node) problems.push(`node ${pc.nodeId.slice(0, 8)}… from pc.json is not paired any more`)
  if (node && !node.connected) problems.push('PC node is not connected right now — start the OpenClaw node on the PC')
  if (pending.length) problems.push(`node capability approval pending: ${pending.map(p => `openclaw nodes approve ${p.requestId}`).join(' ; ')}`)
} catch (error) { problems.push(`openclaw nodes list failed: ${error.message.split('\n')[0]}`) }
let plugin = null
try { plugin = cli(['plugins', 'list']).split('\n').find(l => /file-transfer/.test(l)) || null; if (plugin && !/enabled/.test(plugin)) problems.push('file-transfer plugin is disabled — run setup_transfer.mjs') } catch {}
const allow = configGet('gateway.nodes.commands.allow')
if (!(Array.isArray(allow) && allow.includes('file.write'))) problems.push('gateway.nodes.commands.allow lacks file.write — run setup_transfer.mjs')
const result = { ok: problems.length === 0, dir, version: files['manifest.json']?.version || null, counts: files['manifest.json']?.counts || null, pc: pc ? { nodeId: pc.nodeId, inbox: pc.inbox, connected: node?.connected ?? null } : null, problems,
  hints: ['전송: node send_to_pc.mjs --pc ' + pcPath, 'PC 대시보드 홈에서 30초 안에 자동 반영. 안 되면 [동기화] 또는 설정 > JSON 가져오기(seed.json 붙여넣기).'] }
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
if (problems.length) process.exitCode = 1
