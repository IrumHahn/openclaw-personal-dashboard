import { NextResponse } from 'next/server'
import { readConfig, writeConfig } from '../../../lib/config'
import { mutateStore } from '../../../lib/store'
import { applyBundle } from '../../../lib/sync'
import { assertSameOrigin } from '../../../lib/security'
import { saveRegisteredAgents } from '../../../lib/registered-agents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 동기화가 막혔을 때의 대체 경로: 사용자가 seed/config JSON 을 직접 붙여넣거나 파일로 올린다.
// 본문은 { manifest?, config?, seed? } 묶음이거나, seed.json 하나( { records, agents } )여도 된다.
export async function POST(request) {
  try {
    assertSameOrigin(request)
    const body = await request.json()
    const bundle = body && (body.config || body.seed || body.manifest) ? body : { seed: body }
    const config = await readConfig()
    const result = await mutateStore(data => applyBundle({ bundle, config, data }))
    await saveRegisteredAgents(result.registeredAgents)
    const saved = await writeConfig({ ...result.config, sync: { ...config.sync, lastSuccessAt: new Date().toISOString(), lastVersion: result.version || 'import', lastError: null } })
    return NextResponse.json({ ok: true, version: result.version, merge: result.merge, reasons: result.reasons, config: saved })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
