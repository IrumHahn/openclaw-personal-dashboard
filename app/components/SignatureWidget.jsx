'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { WIDGET_CSP, widgetDocument } from '../../lib/widget'
import { STATUS_LABELS } from './shared'

// 홈의 "나의 위젯" 칸. 수강생이 자기 비서와 만든 HTML 한 장을 격리해서 띄운다.
// - sandbox="allow-scripts" (allow-same-origin 없음): 위젯은 이 앱의 화면·API·저장소에 접근할 수 없다.
// - CSP(lib/widget.js): 외부 통신·외부 스크립트·외부 이미지를 막는다. 필요한 데이터는 앱이 postMessage 로 넣어 준다.
// 위젯 쪽 약속(references/widget-guide.md):
//   window.addEventListener('message', e => { if (e.data?.type === 'dashboard:data') render(e.data.data) })
//   parent.postMessage({ type: 'dashboard:ready' }, '*')                      // 준비되면 데이터 다시 요청
//   parent.postMessage({ type: 'dashboard:height', height: 320 }, '*')      // 높이 조절 (120~900)
const SNAPSHOT_FIELDS = ['title', 'status', 'agent', 'person', 'date', 'dueAt', 'updatedAt']
const COLOR_TOKENS = ['bg', 'surface', 'raised', 'ink', 'muted', 'border', 'accent', 'pop']

function themeColors() {
  if (typeof window === 'undefined') return {}
  const style = getComputedStyle(document.documentElement)
  return Object.fromEntries(COLOR_TOKENS.map(token => [token, style.getPropertyValue(`--${token}`).trim()]))
}

export function widgetSnapshot({ config, catalog, records }) {
  const menus = config.menus.map(menu => catalog.byKey[menu.key]).filter(Boolean).map(menu => {
    const items = records[menu.key] || []
    return { key: menu.key, label: menu.label, custom: Boolean(menu.custom), kind: menu.kind, count: items.length, open: items.filter(item => !['done', 'rejected'].includes(item.status)).length, statusLabels: { ...STATUS_LABELS, ...(menu.statusLabels || {}) } }
  })
  // 본문(body)은 넣지 않는다: 위젯은 숫자·제목·상태로 충분하고, 긴 원문을 격리 화면에 복사할 이유가 없다.
  const slim = Object.fromEntries(Object.entries(records).map(([key, items]) => [key, (items || []).slice(0, 100).map(item => Object.fromEntries(SNAPSHOT_FIELDS.filter(field => item[field]).map(field => [field, item[field]])))]))
  return {
    name: config.name, week: config.week, tagline: config.theme.tagline, theme: config.theme.preset, colors: themeColors(),
    menus, records: slim, agents: config.agents.map(({ id, name, emoji, role }) => ({ id, name, emoji, role })), sentAt: new Date().toISOString(),
  }
}

export default function SignatureWidget({ config, catalog, records, navigate }) {
  const frame = useRef(null)
  const [height, setHeight] = useState(240)
  const widget = config.widget
  const srcDoc = useMemo(() => widget ? widgetDocument(widget.html) : '', [widget])
  const snapshot = useMemo(() => widgetSnapshot({ config, catalog, records }), [config, catalog, records])
  const post = useCallback(() => frame.current?.contentWindow?.postMessage({ type: 'dashboard:data', data: snapshot }, '*'), [snapshot])

  useEffect(() => { post() }, [post])
  useEffect(() => {
    function onMessage(event) {
      if (!frame.current || event.source !== frame.current.contentWindow) return
      if (event.data?.type === 'dashboard:ready') post()
      if (event.data?.type === 'dashboard:height') {
        const next = Number(event.data.height)
        if (Number.isFinite(next)) setHeight(Math.min(900, Math.max(120, Math.round(next))))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [post])

  if (!widget) return <section className="surface widget-slot widget-empty">
    <Sparkles size={18} />
    <div><strong>나의 위젯 자리</strong><p>이 칸은 나만의 화면 한 장이 들어가는 곳입니다. VPS 비서에게 <b>"내 대시보드 위젯 만들어줘"</b>라고 하거나, <button className="link-button" onClick={() => navigate('settings')}>설정</button>에서 HTML 을 붙여넣으세요.</p></div>
  </section>
  return <section className="surface widget-slot" aria-label={widget.title}>
    <div className="section-heading"><h2>{widget.title}</h2><span>나의 위젯</span></div>
    <iframe ref={frame} className="widget-frame" title={widget.title} sandbox="allow-scripts" csp={WIDGET_CSP} srcDoc={srcDoc} onLoad={post} style={{ height }} />
  </section>
}
