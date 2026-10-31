import { NextResponse } from 'next/server'
import { INBOX_DIR } from '../../../lib/inbox'
import { gradePatch, gradesPayload } from '../../../lib/ojt'
import { writeGradesOutbox } from '../../../lib/ojt-outbox'
import { assertSameOrigin } from '../../../lib/security'
import { mutateStore, readStore, updateRecord } from '../../../lib/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: 비서에게 아직 전달되지 않은 채점 수와 돌려보내는 파일 위치.
export async function GET() {
  const data = await readStore()
  return NextResponse.json({ pending: gradesPayload(data.ojt || []).pending.length, outbox: INBOX_DIR, files: ['grades.json', 'grades.b64'] })
}

// POST { id, grade: good|fix|bad, note }: 보고 1건 채점 → 저장 → inbox 에 grades.json/.b64 다시 쓰기.
export async function POST(request) {
  try {
    assertSameOrigin(request)
    const { id, ...input } = await request.json()
    if (typeof id !== 'string') throw new Error('Record ID is required')
    const patch = gradePatch(input)
    const { record, records } = await mutateStore(data => {
      const target = (data.ojt || []).find(item => item.id === id)
      if (!target) throw new Error('Record not found')
      if (target.kind === 'job') throw new Error('업무 카드는 채점하지 않습니다. 보고를 채점하세요.')
      return { record: updateRecord(data, 'ojt', id, patch), records: data.ojt }
    })
    const outbox = await writeGradesOutbox(INBOX_DIR, records)
    return NextResponse.json({ record, outbox })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.message === 'Record not found' ? 404 : 400 })
  }
}
