import { NextResponse } from 'next/server'
import { readConfig } from '../../../lib/config'
import { readStore } from '../../../lib/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 백업용 내보내기. 토큰·비밀값은 포함되지 않는다(설정 파일과 기록만).
export async function GET() {
  const [config, data] = await Promise.all([readConfig(), readStore()])
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), config, records: data }, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="dashboard-export-${new Date().toISOString().slice(0, 10)}.json"` },
  })
}
