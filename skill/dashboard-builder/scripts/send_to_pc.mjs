#!/usr/bin/env node
// 만들어 둔 대시보드 파일 3개를 PC(노드)의 inbox 폴더로 보낸다. 두 경로:
//   transport "file" (헤드리스 노드): file-transfer 플러그인의 `file.write` 노드 명령으로 직접 쓰고 sha256 을 대조한다.
//   transport "hub"  (Windows Hub 앱 노드): Hub 에는 file.write 가 없고 `system.run` 은 CLI 로 못 부른다(exec 도구 전용).
//     그래서 이 스크립트는 파일을 base64 로 바꿔 cmd 내장 `echo … >> <name>.b64` 명령 묶음을 만들어 주고,
//     에이전트가 그 명령을 exec(host=node) 로 순서대로 실행한다. PC 앱이 .b64 를 디코드한다. 샌드박스에서 외부 .exe 는 안 돼도 echo 는 된다.
// 사용: node send_to_pc.mjs --pc <pc.json> [--out <빌드 폴더>] [--only seed,config,manifest] [--chunk 6000] [--with-grades] [--grades-only]
//   --with-grades : 보내면서 PC 의 수습 채점(grades)도 같이 읽어 온다. hub 는 같은 명령 끝에 붙여 허용 창 1번으로, file 은 file.fetch.
//   --grades-only : 보내지 않고 채점만 읽어 온다(아침 브리핑 전에).
//   pc.json = setup_transfer.mjs --save 로 저장한 { transport, nodeId, inbox }
// 결과(file): 파일별 sha256 을 PC 쪽 응답과 대조해 "전송 확인" 을 보고한다. 하나라도 어긋나면 ok:false.
// 결과(hub) : commands[] 와 <out>/hub-commands.txt. 실제 전송은 에이전트의 exec 실행이므로 여기서는 "보냈다" 고 하지 않는다.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cliJson } from './lib/openclaw.mjs'
import { GRADES_BEGIN, GRADES_END } from './ojt.mjs'

const FILES = ['manifest.json', 'config.json', 'seed.json']
function fail(message) { const e = new Error(message); e.exitCode = 1; throw e }

function parseArgs(argv) {
  const o = { pc: null, out: path.join(os.homedir(), '.openclaw', 'workspace', 'dashboard'), only: null, timeout: 30000, chunk: 6000, withGrades: false, gradesOnly: false }
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i]
    if (f === '--with-grades') { o.withGrades = true; continue }
    if (f === '--grades-only') { o.gradesOnly = true; o.withGrades = true; continue }
    const v = argv[++i]
    if (v === undefined) fail(`${f} needs a value`)
    if (f === '--pc') o.pc = v
    else if (f === '--out') o.out = v
    else if (f === '--only') o.only = v.split(',').map(s => s.trim()).map(s => s.endsWith('.json') ? s : `${s}.json`)
    else if (f === '--timeout') o.timeout = Number(v)
    else if (f === '--chunk') o.chunk = Number(v)
    else fail(`unknown option ${f}`)
  }
  if (!o.pc) fail('--pc <pc.json> is required (run setup_transfer.mjs --save first)')
  if (!(o.chunk >= 500 && o.chunk <= 7000)) fail('--chunk must be 500..7000 (cmd line limit is 8191 chars)')
  return o
}

// Hub 앱 노드용 cmd 명령 묶음. base64 문자( A-Z a-z 0-9 + / = )만 들어가므로 cmd 특수문자 걱정이 없다.
// `>` 앞에 공백을 두는 이유: 청크가 숫자로 끝나면 `…1>file` 이 핸들 리다이렉션(1>)으로 읽혀 글자가 사라진다. 공백은 PC 앱이 디코드할 때 걷어낸다.
// PC 에서는 exec 한 번마다 "허용(Allow Once)" 창이 뜬다(항상 허용 없음). 그래서 조각들을 `&&` 로 이어 한 줄(≤ lineMax 자)에 최대한 담는다 —
// 보통 대시보드 3개 파일(4~5KB)은 명령 1개, 큰 칸반도 2~3개로 끝난다.
export function buildHubCommands({ inbox, files, chunkSize = 6000, lineMax = 7600, withGrades = false }) {
  const pieces = [`(if not exist "${inbox}" mkdir "${inbox}")`]
  const plan = []
  for (const { name, content } of files) {
    const base = name.replace(/\.json$/, '')
    const target = `${inbox}\\${base}.b64`
    const b64 = Buffer.from(content).toString('base64')
    let chunks = 0
    for (let i = 0; i < b64.length; i += chunkSize, chunks++) pieces.push(`echo ${b64.slice(i, i + chunkSize)} ${i === 0 ? '>' : '>>'}"${target}"`)
    plan.push({ name, target, size: content.length, sha256: createHash('sha256').update(content).digest('hex'), chunks })
  }
  // 마지막에 manifest 가 다 써졌는지 눈으로 확인할 수 있게 type 한 줄
  const manifest = plan.find(p => p.name === 'manifest.json')
  if (manifest) pieces.push(`type "${manifest.target}"`)
  // 수습 채점 읽기: 표시 줄 사이에 grades.b64(ASCII) 를 찍는다. 파일이 없으면 NO-GRADES. ojt.mjs grades --hub-output 이 푼다.
  if (withGrades) pieces.push(gradesReadPiece(inbox))
  // 순서를 지키며 && 로 묶는다. 한 조각이 lineMax 를 넘는 일은 chunkSize 로 막는다.
  const commands = []
  let line = ''
  for (const piece of pieces) {
    if (piece.length + 8 > lineMax) fail(`hub piece too long (${piece.length}); lower --chunk`)
    if (line && line.length + 4 + piece.length > lineMax) { commands.push(`cmd /c ${line}`); line = '' }
    line = line ? `${line} && ${piece}` : piece
  }
  if (line) commands.push(`cmd /c ${line}`)
  return { commands, plan, pieces: pieces.length }
}

export function gradesReadPiece(inbox) {
  const file = `${inbox}\\grades.b64`
  return `echo ${GRADES_BEGIN} && (if exist "${file}" (type "${file}") else (echo NO-GRADES)) && echo ${GRADES_END}`
}

// 헤드리스 노드: file-transfer 의 file.fetch 로 grades.json 을 읽는다(노드 정책 allowReadPaths 가 <inbox>/** 를 이미 허용).
export function fetchGrades({ nodeId, inbox, out, timeout }) {
  const res = cliJson(['nodes', 'invoke', '--node', nodeId, '--command', 'file.fetch', '--params', JSON.stringify({ path: `${inbox}/grades.json` }), '--timeout', String(timeout)])
  const payload = res?.payload || res
  if (!payload?.ok && typeof payload?.base64 !== 'string') {
    const err = payload?.error
    const message = typeof err === 'string' ? err : err?.message || JSON.stringify(res).slice(0, 300)
    return { ok: false, error: `file.fetch grades.json: ${message}` }
  }
  const text = Buffer.from(payload.base64, 'base64').toString('utf8')
  const file = path.join(out, 'grades-latest.json')
  fs.writeFileSync(file, text, { mode: 0o600 })
  return { ok: true, file, next: `node ojt.mjs grades --file ${file}` }
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
  const transport = pc.transport || 'file'
  if (!['file', 'hub'].includes(transport)) fail(`pc.json transport must be file|hub (got ${pc.transport})`)
  if (o.gradesOnly) {
    if (transport === 'hub') {
      const command = `cmd /c ${gradesReadPiece(pc.inbox)}`
      process.stdout.write(`${JSON.stringify({ ok: true, transport: 'hub', sent: false, commands: [command], howTo: `exec 도구(host=node)로 이 명령 1개를 글자 그대로 실행하고, 출력 전체를 파일로 저장한 뒤 node ojt.mjs grades --hub-output <그 파일> 로 푸세요. PC 허용 창 1번.` }, null, 2)}\n`)
      return
    }
    process.stdout.write(`${JSON.stringify({ transport: 'file', ...fetchGrades({ nodeId: pc.nodeId, inbox: pc.inbox, out: o.out, timeout: o.timeout }) }, null, 2)}\n`)
    return
  }
  const names = (o.only || FILES).filter(n => FILES.includes(n))
  const missing = names.filter(n => !fs.existsSync(path.join(o.out, n)))
  if (missing.length) fail(`missing in ${o.out}: ${missing.join(', ')} — run build_dashboard.mjs first`)
  // seed → config → manifest 순서: PC 는 manifest 가 바뀐 것을 보고 가져오므로 manifest 를 마지막에 쓴다.
  const ordered = [...names].sort((a, b) => FILES.indexOf(b) - FILES.indexOf(a))
  let version = null
  try { version = JSON.parse(fs.readFileSync(path.join(o.out, 'manifest.json'), 'utf8')).version } catch {}
  if (transport === 'hub') {
    const files = ordered.map(name => ({ name, content: fs.readFileSync(path.join(o.out, name)) }))
    const { commands, plan, pieces } = buildHubCommands({ inbox: pc.inbox, files, chunkSize: o.chunk, withGrades: o.withGrades })
    const commandsFile = path.join(o.out, 'hub-commands.txt')
    fs.writeFileSync(commandsFile, `${commands.join('\n')}\n`)
    process.stdout.write(`${JSON.stringify({
      ok: true, transport: 'hub', sent: false, node: pc.nodeId, nodeName: pc.nodeName || null, inbox: pc.inbox, version, files: plan, commandsFile, commandCount: commands.length, pieces, commands,
      howTo: `exec 도구(host=node, node="${pc.nodeName || pc.nodeId}")로 commands 를 위에서부터 한 줄씩, 글자 하나 바꾸지 말고 그대로 실행하세요(${commands.length}개). 마지막 type 출력이 끊기지 않고 나오면 PC 대시보드가 30초 안에 반영합니다(홈 '동기화 버전' = ${version}). PC 에서 허용(Allow Once) 창이 명령마다 ${commands.length}번 뜨니 사용자에게 미리 알려 주세요.${o.withGrades ? ` 마지막 명령 출력(${GRADES_BEGIN} … ${GRADES_END})을 파일로 저장해 node ojt.mjs grades --hub-output <파일> 로 채점을 읽으세요.` : ''}`,
    }, null, 2)}\n`)
    return
  }
  const sent = []
  for (const name of ordered) {
    const content = fs.readFileSync(path.join(o.out, name))
    sent.push(writeOne({ nodeId: pc.nodeId, remotePath: `${pc.inbox}/${name}`, content, timeout: o.timeout }))
  }
  const grades = o.withGrades ? fetchGrades({ nodeId: pc.nodeId, inbox: pc.inbox, out: o.out, timeout: o.timeout }) : undefined
  process.stdout.write(`${JSON.stringify({ ok: true, transport: 'file', node: pc.nodeId, inbox: pc.inbox, version, sent, grades, next: 'PC 대시보드 홈에서 새 데이터가 자동 반영됩니다(최대 30초). 안 보이면 [동기화] 버튼.' }, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { main() } catch (error) { process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`); process.exitCode = error.exitCode || 1 }
}
