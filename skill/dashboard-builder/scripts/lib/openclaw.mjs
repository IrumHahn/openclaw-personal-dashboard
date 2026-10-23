// OpenClaw CLI 래퍼 (dashboard-builder 전용). 바이너리는 OPENCLAW_BIN 으로 바꿀 수 있다.
import { execFileSync } from 'node:child_process'

export function cli(args, { timeout = 60000 } = {}) {
  const bin = process.env.OPENCLAW_BIN || 'openclaw'
  try {
    return execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024, timeout }).trim()
  } catch (error) {
    const detail = String(error.stdout || error.stderr || error.message || '').trim()
    const wrapped = new Error(`openclaw ${args.slice(0, 2).join(' ')} failed: ${detail.slice(0, 800)}`)
    wrapped.stdout = String(error.stdout || '')
    wrapped.stderr = String(error.stderr || '')
    throw wrapped
  }
}

// 플러그인 경고 줄([plugins] …)이 stdout 앞에 섞여도 JSON 만 골라낸다.
export function cliJson(args, options) {
  let text
  try { text = cli(args, options) } catch (error) { text = error.stdout?.trim() || '' ; if (!text) throw error }
  // 2026.10 CLI 는 stdout 에 "[plugins] …" / "[openclaw] …" 로그 줄을 섞는다. 먼저 걷어낸다.
  text = text.split('\n').filter(line => !/^\[(plugins|openclaw|gateway|node-host)\]/.test(line.trim())).join('\n').trim()
  const start = text.search(/[[{]/)
  if (start < 0) throw new Error(`openclaw ${args.slice(0, 2).join(' ')} did not return JSON: ${text.slice(0, 200)}`)
  const candidate = text.slice(start)
  try { return JSON.parse(candidate) } catch {
    // 끝에 로그가 붙은 경우 마지막 닫는 괄호까지만 시도
    const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'))
    return JSON.parse(candidate.slice(0, end + 1))
  }
}

// 페어링된 노드 목록: [{ id, name, connected, platform }]
export function listNodes() {
  const raw = cliJson(['nodes', 'list', '--json'])
  const nodes = Array.isArray(raw) ? raw : Array.isArray(raw?.nodes) ? raw.nodes : Array.isArray(raw?.paired) ? raw.paired : []
  const pending = Array.isArray(raw?.pending) ? raw.pending : []
  return {
    nodes: nodes.map(n => ({ id: n.nodeId || n.id, name: n.displayName || n.name || '', connected: Boolean(n.connected), platform: n.platform || n.os || null, commands: Array.isArray(n.commands) ? n.commands : [] })),
    pending: pending.map(p => ({ requestId: p.requestId || p.id, name: p.displayName || p.name || '' })),
  }
}

// JSON5 패치 파일을 만들어 `config patch` 로 적용한다 (dry-run 먼저).
export function configPatch(patchObject, { dryRunOnly = false, writeFile, tmpPath } = {}) {
  const file = tmpPath
  writeFile(file, JSON.stringify(patchObject, null, 2))
  cli(['config', 'patch', '--file', file, '--dry-run'])
  if (dryRunOnly) return { dryRun: true }
  cli(['config', 'patch', '--file', file])
  return { applied: true }
}

export function configGet(path) {
  try { return cliJson(['config', 'get', path, '--json']) } catch { return undefined }
}
