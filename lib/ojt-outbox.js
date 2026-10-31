// 서버 전용: 채점 결과를 inbox 폴더에 grades.json + grades.b64 로 쓴다. VPS 의 비서가 다음 동기화 때 읽어 간다.
//   헤드리스 노드: file-transfer 의 file.fetch 로 grades.json 을 읽는다(노드 정책 allowReadPaths 가 이미 <inbox>/** ).
//   Hub 앱 노드  : 대시보드 전송 명령 끝에 `type "<inbox>\grades.b64"` 를 붙여 같은 허용 1번으로 읽는다(cmd 출력은 ASCII 라 한글이 안 깨진다).
import { randomUUID } from 'node:crypto'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { gradesPayload } from './ojt.js'

async function atomicWrite(file, content) {
  const temp = `${file}.${randomUUID()}.tmp`
  await writeFile(temp, content, { mode: 0o600 })
  await rename(temp, file)
}

export async function writeGradesOutbox(dir, records, now) {
  const payload = gradesPayload(records, now)
  const json = `${JSON.stringify(payload, null, 2)}\n`
  await mkdir(dir, { recursive: true })
  await atomicWrite(path.join(dir, 'grades.json'), json)
  await atomicWrite(path.join(dir, 'grades.b64'), `${Buffer.from(json).toString('base64')}\n`)
  return { pending: payload.pending.length, generatedAt: payload.generatedAt }
}
