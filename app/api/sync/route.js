import { NextResponse } from 'next/server'
import { readConfig, writeConfig } from '../../../lib/config-store'
import { describeInbox, inboxIsNew, readInbox } from '../../../lib/inbox'
import { mutateStore } from '../../../lib/store'
import { applyBundle, fetchBundle } from '../../../lib/sync'
import { assertSameOrigin } from '../../../lib/security'
import { saveRegisteredAgents } from '../../../lib/registered-agents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: inbox 상태 (새 데이터가 도착했는지). 홈이 주기적으로 물어본다.
export async function GET() {
  const config = await readConfig()
  const inbox = await readInbox()
  return NextResponse.json({ inbox: describeInbox(inbox, config.sync.lastVersion), lastVersion: config.sync.lastVersion, remoteConfigured: Boolean(process.env.OPENCLAW_SYNC_URL && process.env.OPENCLAW_GATEWAY_TOKEN) })
}

// POST: 반영. 기본은 inbox (VPS 에이전트가 file.write 로 넣은 파일). inbox 가 없고 원격 URL 이 설정돼 있으면 당겨오기.
export async function POST(request) {
  try {
    assertSameOrigin(request)
    const config = await readConfig()
    let bundle
    let source = 'inbox'
    const inbox = await readInbox()
    const force = new URL(request.url).searchParams.get('force') === '1'
    if (inbox.present) {
      if (!force && !inboxIsNew(inbox, config.sync.lastVersion)) return NextResponse.json({ ok: true, unchanged: true, version: inbox.version, source })
      bundle = inbox.bundle
    } else if (process.env.OPENCLAW_SYNC_URL && process.env.OPENCLAW_GATEWAY_TOKEN) {
      source = 'remote'
      try { bundle = await fetchBundle(process.env.OPENCLAW_SYNC_URL, process.env.OPENCLAW_GATEWAY_TOKEN) }
      catch (error) {
        await writeConfig({ ...config, sync: { ...config.sync, lastError: error.message } })
        return NextResponse.json({ error: error.message }, { status: 502 })
      }
    } else {
      return NextResponse.json({ error: `아직 받은 데이터가 없습니다. VPS 에서 비서에게 "대시보드 만들어줘" 라고 하면 ${describeInbox(inbox).dir} 에 파일이 들어옵니다. 또는 설정 > JSON 가져오기.` }, { status: 404 })
    }
    const result = await mutateStore(data => applyBundle({ bundle, config, data }))
    await saveRegisteredAgents(result.registeredAgents)
    const saved = await writeConfig({ ...result.config, sync: { lastSuccessAt: new Date().toISOString(), lastVersion: result.version, lastError: null } })
    return NextResponse.json({ ok: true, source, version: result.version, merge: result.merge, reasons: result.reasons, config: saved })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
