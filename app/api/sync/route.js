import { NextResponse } from 'next/server'
import { readConfig, writeConfig } from '../../../lib/config-store'
import { mutateStore } from '../../../lib/store'
import { applyBundle, fetchBundle } from '../../../lib/sync'
import { assertSameOrigin } from '../../../lib/security'
import { saveRegisteredAgents } from '../../../lib/registered-agents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// VPS 캔버스 폴더에서 당겨온다. 토큰은 서버 환경변수에만 있고 브라우저로 가지 않는다.
export async function POST(request) {
  try {
    assertSameOrigin(request)
    const baseUrl = process.env.OPENCLAW_SYNC_URL
    const token = process.env.OPENCLAW_GATEWAY_TOKEN
    if (!baseUrl || !token) return NextResponse.json({ error: '.env.local 에 OPENCLAW_SYNC_URL 과 OPENCLAW_GATEWAY_TOKEN 을 설정하고 서버를 다시 시작하세요.' }, { status: 400 })
    if (!/^https?:\/\//.test(baseUrl)) return NextResponse.json({ error: 'OPENCLAW_SYNC_URL 은 http(s):// 로 시작해야 합니다.' }, { status: 400 })
    const config = await readConfig()
    let bundle
    try { bundle = await fetchBundle(baseUrl, token) }
    catch (error) {
      await writeConfig({ ...config, sync: { ...config.sync, lastError: error.message } })
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    const result = await mutateStore(data => applyBundle({ bundle, config, data }))
    await saveRegisteredAgents(result.registeredAgents)
    const saved = await writeConfig({ ...result.config, sync: { lastSuccessAt: new Date().toISOString(), lastVersion: result.version, lastError: null } })
    return NextResponse.json({ ok: true, version: result.version, merge: result.merge, reasons: result.reasons, config: saved })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
