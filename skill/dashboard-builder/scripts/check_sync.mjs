#!/usr/bin/env node
// 동기화 준비 점검: 캔버스 폴더의 3개 파일이 있고 JSON 이 유효하며 비밀값이 없는지,
// 그리고 PC 대시보드에 넣을 동기화 주소를 안내한다. 네트워크 호출은 하지 않는다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const SECRET = /(sk-[a-z0-9]{8,}|ghp_[a-z0-9]{10,}|(?:password|passwd|secret|api[_ -]?key|token)\s*[:=]\s*\S{6,})/i
const dir = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : path.join(os.homedir(), '.openclaw', 'workspace', 'canvas', 'dashboard')
const problems = []
const files = {}
for (const name of ['manifest.json', 'config.json', 'seed.json']) {
  const file = path.join(dir, name)
  if (!fs.existsSync(file)) { problems.push(`${name} missing in ${dir}`); continue }
  const text = fs.readFileSync(file, 'utf8')
  try { files[name] = JSON.parse(text) } catch { problems.push(`${name} is not valid JSON`); continue }
  if (SECRET.test(text)) problems.push(`${name} contains a secret-looking value — rebuild without it`)
}
let port = 18789
let bind = null
try {
  const bin = process.env.OPENCLAW_BIN || 'openclaw'
  const value = execFileSync(bin, ['config', 'get', 'gateway.port'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 }).trim()
  if (/^\d+$/.test(value)) port = Number(value)
  bind = execFileSync(bin, ['config', 'get', 'gateway.bind'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 }).trim() || null
} catch {}
const hints = [
  `PC 대시보드 .env.local 에 넣을 값 (토큰은 hPanel/설정에서 복사, 여기엔 출력하지 않음):`,
  `  OPENCLAW_SYNC_URL=http://<이 VPS 의 Tailscale IP>:${port}/__openclaw__/canvas/dashboard/`,
  `  OPENCLAW_GATEWAY_TOKEN=<게이트웨이 토큰>`,
  bind && bind !== 'loopback' ? `게이트웨이 bind=${bind} (PC 에서 접근 가능)` : `게이트웨이 bind 가 loopback 이면 PC 에서 접근할 수 없습니다. Tailscale 바인드(openclaw gateway --bind tailnet)인지 확인하세요.`,
  `canvasHost 가 꺼져 있으면(OPENCLAW_SKIP_CANVAS_HOST) 동기화가 404 입니다 — 그 경우 대시보드 설정의 "JSON 가져오기"로 seed.json 을 직접 넣습니다.`,
]
const result = { ok: problems.length === 0, dir, version: files['manifest.json']?.version || null, counts: files['manifest.json']?.counts || null, problems, hints }
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
if (problems.length) process.exitCode = 1
