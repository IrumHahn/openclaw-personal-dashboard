#!/usr/bin/env node
// 만들어 둔 대시보드 파일 3개를 PC(노드)의 inbox 폴더에 쓴다. file-transfer 플러그인의 `file.write` 노드 명령 사용.
// 사용: node send_to_pc.mjs --pc <pc.json> [--out <빌드 폴더>] [--only seed,config,manifest]
//   pc.json = setup_transfer.mjs --save 로 저장한 { nodeId, inbox }
// 결과: 파일별 sha256 을 PC 쪽 응답과 대조해 "전송 확인" 을 보고한다. 하나라도 어긋나면 ok:false.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cliJson } from './lib/openclaw.mjs'

const FILES = ['manifest.json', 'config.json', 'seed.json']
function fail(message) { const e = new Error(message); e.exitCode = 1; throw e }

function parseArgs(argv) {
  const o = { pc: null, out: path.join(os.homedir(), '.openclaw', 'workspace', 'dashboard'), only: null, timeout: 30000 }
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i]; const v = argv[++i]
    if (v === undefined) fail(`${f} needs a value`)
    if (f === '--pc') o.pc = v
    else if (f === '--out') o.out = v
    else if (f === '--only') o.only = v.split(',').map(s => s.trim()).map(s => s.endsWith('.json') ? s : `${s}.json`)
    else if (f === '--timeout') o.timeout = Number(v)
    else fail(`unknown option ${f}`)
  }
  if (!o.pc) fail('--pc <pc.json> is required (run setup_transfer.mjs --save first)')
  return o
}

export function writeOne({ nodeId, remotePath, content, timeout }) {
  const contentBase64 = Buffer.from(content).toString('base64')
  const expected = createHash('sha256').update(content).digest('hex')
  const params = { path: remotePath, contentBase64, overwrite: true, createParents: true, expectedSha256: expected }
  const res = cliJson(['nodes', 'invoke', '--node', nodeId, '--command', 'file.write', '--params', JSON.stringify(params), '--timeout', String(timeout)])
  const payload = res?.payload || res
  if (!payload?.ok) {
    const err = payload?.error
    const message = typeof err === 'string' ? err : err?.message || payload?.message || JSON.stringify(res).slice(0, 300)
    fail(`file.write failed for ${remotePath}: ${message}`)
  }
  if (payload.sha256 && payload.sha256 !== expected) fail(`sha256 mismatch for ${remotePath}: PC ${payload.sha256} ≠ local ${expected}`)
  return { remotePath, size: content.length, sha256: expected, overwritten: Boolean(payload.overwritten) }
}

function main() {
  const o = parseArgs(process.argv.slice(2))
  const pc = JSON.parse(fs.readFileSync(o.pc, 'utf8'))
  if (!pc.nodeId || !pc.inbox) fail('pc.json needs nodeId and inbox')
  const names = (o.only || FILES).filter(n => FILES.includes(n))
  const missing = names.filter(n => !fs.existsSync(path.join(o.out, n)))
  if (missing.length) fail(`missing in ${o.out}: ${missing.join(', ')} — run build_dashboard.mjs first`)
  const sent = []
  // seed → config → manifest 순서: PC 는 manifest 가 바뀐 것을 보고 가져오므로 manifest 를 마지막에 쓴다.
  for (const name of [...names].sort((a, b) => FILES.indexOf(b) - FILES.indexOf(a))) {
    const content = fs.readFileSync(path.join(o.out, name))
    sent.push(writeOne({ nodeId: pc.nodeId, remotePath: `${pc.inbox}/${name}`, content, timeout: o.timeout }))
  }
  let version = null
  try { version = JSON.parse(fs.readFileSync(path.join(o.out, 'manifest.json'), 'utf8')).version } catch {}
  process.stdout.write(`${JSON.stringify({ ok: true, node: pc.nodeId, inbox: pc.inbox, version, sent, next: 'PC 대시보드 홈에서 새 데이터가 자동 반영됩니다(최대 30초). 안 보이면 [동기화] 버튼.' }, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { main() } catch (error) { process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`); process.exitCode = error.exitCode || 1 }
}
