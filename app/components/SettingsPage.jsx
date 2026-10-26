'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Download, RefreshCw, RotateCcw, Star, Upload } from 'lucide-react'
import { DEFAULT_FAVORITES, DEFAULT_MENU_KEYS, MAX_WIDGET_HTML, THEME_PRESETS } from '../../lib/menu-tree'
import { MenuIcon, api, formatDateTime } from './shared'

export default function SettingsPage({ config, catalog, onSave, onSync, syncing, syncConfigured, inbox, refresh }) {
  const [draft, setDraft] = useState(() => structuredClone(config))
  const [importText, setImportText] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const enabledKeys = draft.menus.map(m => m.key)
  const MENU_BY_KEY = catalog.byKey
  const theme = draft.theme
  function updateTheme(patch) { update({ theme: { ...draft.theme, ...patch } }) }
  function updateWidget(patch) { update({ widget: { title: draft.widget?.title || '나의 위젯', html: draft.widget?.html || '', ...patch } }) }

  function update(patch) { setDraft(current => ({ ...current, ...patch })) }
  function moveMenu(index, delta) {
    const menus = [...draft.menus]
    const target = index + delta
    if (target < 0 || target >= menus.length) return
    ;[menus[index], menus[target]] = [menus[target], menus[index]]
    update({ menus })
  }
  function toggleMenu(key) {
    if (key === 'settings' || key === 'agents') return
    update({ menus: enabledKeys.includes(key) ? draft.menus.filter(m => m.key !== key) : [...draft.menus, { key, owner: '', enabledFromWeek: MENU_BY_KEY[key].defaultWeek }] })
  }
  function toggleFavorite(key) {
    const favorites = draft.favorites.includes(key) ? draft.favorites.filter(k => k !== key) : draft.favorites.length < 6 ? [...draft.favorites, key] : draft.favorites
    update({ favorites })
  }
  async function save() {
    setError(''); setMessage('')
    try { await onSave(draft); setMessage('저장했습니다.') } catch (cause) { setError(cause.message) }
  }
  async function importJson() {
    setError(''); setMessage('')
    try {
      const body = JSON.parse(importText)
      const result = await api('/api/import', { method: 'POST', body: JSON.stringify(body) })
      setMessage(`가져오기 완료: 추가 ${result.merge.added} · 갱신 ${result.merge.updated} · 건너뜀 ${result.merge.skipped.length}`)
      setImportText('')
      await refresh()
    } catch (cause) { setError(`가져오기 실패: ${cause.message}`) }
  }
  function onFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    file.text().then(setImportText)
  }
  return <>
    <header className="page-header"><div><p className="eyebrow">기록 / 시스템</p><h1>설정</h1><p className="subtitle">이름·즐겨찾기·메뉴·담당·주차·동기화를 관리합니다. 토큰은 여기 저장하지 않습니다(.env.local).</p></div><button className="primary-button" onClick={save}>저장</button></header>
    {message && <div className="notice">{message}</div>}
    {error && <div className="error-bar" role="alert">{error}</div>}
    <div className="settings-grid">
      <section className="surface"><div className="section-heading"><h2>기본</h2></div>
        <label className="field"><span>대시보드 이름</span><input value={draft.name} onChange={event => update({ name: event.target.value })} maxLength={60} /></label>
        <label className="field"><span>현재 주차</span><select value={draft.week} onChange={event => update({ week: Number(event.target.value) })}>{[1, 2, 3, 4].map(week => <option key={week} value={week}>{week}주차</option>)}</select></label>
        <p className="fine-print">주차를 올리면 그 주차의 메뉴 자물쇠가 풀립니다. 동기화하면 VPS 쪽 주차가 더 높을 때 따라갑니다.</p>
      </section>
      <section className="surface"><div className="section-heading"><h2>동기화</h2></div>
        <div className="system-line"><span>받은 데이터</span><strong>{inbox?.present ? `버전 ${inbox.version}${inbox.isNew ? ' · 새 데이터' : ''}${inbox.format === 'b64' ? ' · Hub 앱 경로' : ''}` : '아직 없음'}</strong></div>
        {inbox?.problems?.length > 0 && <p className="fine-print error-text">받는 중이거나 일부 파일이 깨졌습니다: {inbox.problems.join(' / ')} — 비서에게 "대시보드 다시 보내줘"라고 하세요.</p>}
        <div className="system-line"><span>마지막 성공</span><strong>{formatDateTime(config.sync.lastSuccessAt)}</strong></div>
        <div className="system-line"><span>버전</span><strong>{config.sync.lastVersion || '—'}</strong></div>
        {config.sync.lastError && <p className="fine-print error-text">{config.sync.lastError}</p>}
        <div className="button-row"><button className="secondary-button" onClick={onSync} disabled={syncing}><RefreshCw size={14} />{syncing ? '반영 중…' : '지금 반영'}</button><a className="secondary-button" href="/api/export" download><Download size={14} />내보내기</a></div>
        <p className="fine-print">VPS 의 비서가 이 PC 의 OpenClaw 노드를 통해 아래 폴더에 파일을 넣으면 30초 안에 자동 반영됩니다. 비서에게 이 경로를 알려주세요:</p>
        <p className="inbox-path"><code>{inbox?.dir || '.data/inbox'}</code></p>
      </section>
      <section className="surface card-wide"><div className="section-heading"><h2>테마 — 내 오피스의 분위기</h2><span>저장하면 바로 바뀝니다</span></div>
        <div className="theme-presets" role="radiogroup" aria-label="테마">{Object.entries(THEME_PRESETS).map(([key, preset]) => <button type="button" key={key} role="radio" aria-checked={theme.preset === key} className={`theme-option ${theme.preset === key ? 'on' : ''}`} onClick={() => updateTheme({ preset: key })}>
          <span className="swatches" aria-hidden>{preset.swatch.map(color => <i key={color} style={{ background: color }} />)}</span><strong>{preset.label}</strong><small>{preset.note}</small>
        </button>)}</div>
        <div className="theme-fields">
          <label className="field"><span>강조색 (선택)</span><div className="color-row"><input type="color" value={theme.accent || THEME_PRESETS[theme.preset].swatch[1]} onChange={event => updateTheme({ accent: event.target.value })} aria-label="강조색" /><code>{theme.accent || '테마 기본색'}</code>{theme.accent && <button type="button" className="link-button" onClick={() => updateTheme({ accent: '' })}>기본으로</button>}</div></label>
          <label className="field"><span>로고 이모지</span><input value={theme.emoji} onChange={event => updateTheme({ emoji: event.target.value })} maxLength={8} placeholder="예: 💐 🎬 ☕" /></label>
          <label className="field theme-tagline"><span>홈 한 줄 (나만의 슬로건)</span><input value={theme.tagline} onChange={event => updateTheme({ tagline: event.target.value })} maxLength={80} placeholder="예: 꽃이 늦지 않게, 단골이 잊히지 않게" /></label>
        </div>
      </section>
      <section className="surface card-wide"><div className="section-heading"><h2>나의 위젯 (홈 상단)</h2><span>{(draft.widget?.html || '').length.toLocaleString()} / {MAX_WIDGET_HTML.toLocaleString()}자</span></div>
        <p className="fine-print">HTML 한 장을 붙여넣으면 홈에 격리된 칸으로 뜹니다. 외부 인터넷·외부 스크립트는 막혀 있고, 내 기록 숫자·제목·상태는 앱이 넣어 줍니다. 보통은 VPS 비서에게 "내 대시보드 위젯 만들어줘"라고 하면 동기화로 들어옵니다.</p>
        <label className="field"><span>위젯 제목</span><input value={draft.widget?.title || ''} onChange={event => updateWidget({ title: event.target.value })} maxLength={40} placeholder="예: 이번 주 꽃다발 레이더" /></label>
        <textarea className="import-box" rows={8} value={draft.widget?.html || ''} onChange={event => updateWidget({ html: event.target.value })} placeholder="<!doctype html><html>…</html>" aria-label="위젯 HTML" />
        <div className="button-row"><button type="button" className="secondary-button" onClick={() => update({ widget: null })} disabled={!draft.widget}>위젯 비우기</button></div>
      </section>
      <section className="surface card-wide"><div className="section-heading"><h2>메뉴와 담당</h2><button onClick={() => update({ menus: [...catalog.list.filter(m => m.custom).map(m => m.key), ...DEFAULT_MENU_KEYS].map(key => draft.menus.find(m => m.key === key) || { key, owner: '', enabledFromWeek: MENU_BY_KEY[key].defaultWeek }), favorites: DEFAULT_FAVORITES })}><RotateCcw size={13} /> 메뉴 순서 초기화</button></div>
        <ol className="menu-editor">{draft.menus.map((menu, index) => <li key={menu.key}><MenuIcon name={MENU_BY_KEY[menu.key].icon} /><strong>{MENU_BY_KEY[menu.key].label}</strong><small>{MENU_BY_KEY[menu.key].group}</small>
          <select aria-label={`${MENU_BY_KEY[menu.key].label} 담당`} value={menu.owner || ''} onChange={event => update({ menus: draft.menus.map(m => m.key === menu.key ? { ...m, owner: event.target.value } : m) })} disabled={MENU_BY_KEY[menu.key].kind === 'system'}><option value="">담당 없음</option>{draft.agents.map(agent => <option key={agent.id} value={agent.id}>{agent.emoji} {agent.name}</option>)}</select>
          <select aria-label={`${MENU_BY_KEY[menu.key].label} 열리는 주차`} value={menu.enabledFromWeek} onChange={event => update({ menus: draft.menus.map(m => m.key === menu.key ? { ...m, enabledFromWeek: Number(event.target.value) } : m) })}>{[1, 2, 3, 4].map(week => <option key={week} value={week}>{week}주</option>)}</select>
          <button type="button" className={`star ${draft.favorites.includes(menu.key) ? 'on' : ''}`} onClick={() => toggleFavorite(menu.key)} aria-pressed={draft.favorites.includes(menu.key)} aria-label="즐겨찾기"><Star size={14} /></button>
          <button type="button" onClick={() => moveMenu(index, -1)} aria-label="위로" disabled={index === 0}><ArrowUp size={14} /></button><button type="button" onClick={() => moveMenu(index, 1)} aria-label="아래로" disabled={index === draft.menus.length - 1}><ArrowDown size={14} /></button>
        </li>)}</ol>
        <p className="fine-print">즐겨찾기는 최대 6개(홈 상단 타일). 담당은 팀 온보딩 조직도의 직원 중에서 고릅니다.</p>
      </section>
      <section className="surface card-wide"><div className="section-heading"><h2>메뉴 추가 / 제거</h2><span>전체 {catalog.list.length}개</span></div>
        {catalog.groups.map(group => <div className="menu-picker" key={group}><h3>{group}</h3><div className="chips">{catalog.list.filter(m => m.group === group).map(menu => <button type="button" key={menu.key} className={`chip ${enabledKeys.includes(menu.key) ? 'on' : ''}`} onClick={() => toggleMenu(menu.key)} aria-pressed={enabledKeys.includes(menu.key)} title={`${menu.purpose} (기본 ${menu.defaultWeek}주차)`}><MenuIcon name={menu.icon} size={13} />{menu.label}<small>{menu.defaultWeek}주</small></button>)}</div></div>)}
      </section>
      <section className="surface card-wide"><div className="section-heading"><h2>JSON 가져오기 (동기화 대체 경로)</h2></div>
        <p className="fine-print">VPS 의 <code>~/.openclaw/workspace/canvas/dashboard/seed.json</code>(또는 config.json 을 함께 묶은 JSON)을 붙여넣거나 파일로 올립니다. 토큰이 들어 있는 파일은 거부됩니다.</p>
        <textarea className="import-box" rows={6} value={importText} onChange={event => setImportText(event.target.value)} placeholder='{"records":{"tasks":[...]},"agents":[...]}' />
        <div className="button-row"><label className="secondary-button file-button"><Upload size={14} />파일 선택<input type="file" accept="application/json,.json" onChange={onFile} hidden /></label><button className="primary-button" onClick={importJson} disabled={!importText.trim()}>가져오기</button></div>
      </section>
    </div>
  </>
}
