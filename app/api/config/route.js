import { NextResponse } from 'next/server'
import { normalizeConfig, readConfig, writeConfig } from '../../../lib/config'
import { assertSameOrigin } from '../../../lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ config: await readConfig(), syncConfigured: Boolean(process.env.OPENCLAW_SYNC_URL && process.env.OPENCLAW_GATEWAY_TOKEN) })
}

export async function PUT(request) {
  try {
    assertSameOrigin(request)
    const input = await request.json()
    const current = await readConfig()
    // 동기화 상태(sync)는 화면에서 못 바꾼다. 나머지는 통째로 교체.
    const config = await writeConfig(normalizeConfig({ ...input, sync: current.sync }))
    return NextResponse.json({ config })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
