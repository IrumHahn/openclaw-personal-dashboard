'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowRight, BookOpen, Bot, Check, ChevronDown, CircleAlert, Clock3,
  FileText, Home, Inbox, LayoutList, Menu, NotebookTabs, Plus, Search, Sparkles,
  Trash2, Users, X,
} from 'lucide-react'

const GROUPS = [
  { title: '팀 운영', items: [
    ['tasks', '업무현황', LayoutList], ['proposals', '업무제안', Sparkles],
    ['agents', '팀관리', Users], ['operations', '운영현황', Activity],
  ] },
  { title: '응대와 소통', items: [
    ['email', '이메일', Inbox], ['contacts', '인맥관리', Users],
  ] },
  { title: '기록 / 시스템', items: [
    ['meetings', '미팅기록', BookOpen], ['notes', '나의 메모', FileText],
    ['notebooks', '노트북LM', NotebookTabs],
  ] },
]

const SETTINGS = {
  tasks: { title: '업무현황', singular: '업무', subtitle: '할 일과 에이전트에게 맡긴 작업을 정리합니다.', fields: ['title', 'body', 'person', 'dueAt', 'status'] },
  proposals: { title: '업무제안', singular: '제안', subtitle: '실행할 아이디어를 검토하고 결정합니다.', fields: ['title', 'body', 'status'] },
  email: { title: '이메일', singular: '메일 메모', subtitle: '메일 연동 전에는 중요한 메일의 처리 메모를 직접 기록할 수 있습니다.', fields: ['title', 'body', 'person', 'status'] },
  contacts: { title: '인맥관리', singular: '연락처', subtitle: '사람과의 관계와 다음 연락을 기억합니다.', fields: ['title', 'person', 'body', 'dueAt'] },
  meetings: { title: '미팅기록', singular: '미팅', subtitle: '회의 요약과 전사 원문, 후속 작업을 보관합니다.', fields: ['title', 'date', 'summary', 'body', 'person'] },
  notes: { title: '나의 메모', singular: '메모', subtitle: '생각과 독백을 남기고 다시 찾습니다.', fields: ['title', 'body', 'date'] },
  notebooks: { title: '노트북LM', singular: '노트북 링크', subtitle: '내 NotebookLM 노트북의 링크와 용도를 정리합니다.', fields: ['title', 'link', 'body'] },
}

const FIELD_LABELS = { title: '제목', body: '내용 / 전사 원문', summary: '요약', person: '담당자 / 상대', dueAt: '다음 일정', date: '기록 날짜', link: '노트북 URL', status: '상태' }
const STATUS_OPTIONS = ['open', 'working', 'waiting', 'done', 'rejected']
const STATUS_LABELS = { open: '대기', working: '진행 중', waiting: '검토 대기', done: '완료', rejected: '보류 / 거절' }
const COLLECTIONS = Object.keys(SETTINGS)

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function countOpen(records = []) {
  return records.filter(item => !['done', 'rejected'].includes(item.status)).length
}

function Badge({ status }) {
  return <span className={`badge badge-${status || 'open'}`}>{STATUS_LABELS[status] || status || '기록'}</span>
}

function Empty({ children }) {
  return <div className="empty"><CircleAlert size={20} /><p>{children}</p></div>
}

export default function Dashboard() {
  const [active, setActive] = useState('home')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [openGroup, setOpenGroup] = useState('팀 운영')
  const [records, setRecords] = useState({})
  const [system, setSystem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const name = process.env.NEXT_PUBLIC_DASHBOARD_NAME || '내 AI 오피스'

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const responses = await Promise.all([
        ...COLLECTIONS.map(name => fetch(`/api/collections/${name}`, { cache: 'no-store' })),
        fetch('/api/openclaw', { cache: 'no-store' }),
      ])
      if (responses.some(response => !response.ok)) throw new Error('데이터를 불러오지 못했습니다.')
      const payloads = await Promise.all(responses.map(response => response.json()))
      setRecords(Object.fromEntries(COLLECTIONS.map((name, index) => [name, payloads[index].records])))
      setSystem(payloads[payloads.length - 1])
    } catch (cause) {
      setError(cause.message)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash === 'home' || SETTINGS[hash] || hash === 'agents' || hash === 'operations') setActive(hash)
  }, [])

  function navigate(key) {
    setActive(key)
    setSearch('')
    setMobileMenu(false)
    window.location.hash = key
  }

  async function save(input) {
    const method = editing ? 'PATCH' : 'POST'
    const response = await fetch(`/api/collections/${active}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? { ...input, id: editing.id } : input),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || '저장하지 못했습니다.')
    setFormOpen(false)
    setEditing(null)
    await refresh()
  }

  async function remove(item) {
    if (!window.confirm(`‘${item.title}’ 기록을 삭제할까요?`)) return
    const response = await fetch(`/api/collections/${active}?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' })
    if (!response.ok) { setError('삭제하지 못했습니다.'); return }
    await refresh()
  }

  async function setStatus(item, status) {
    const response = await fetch(`/api/collections/${active}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, status }),
    })
    if (!response.ok) { setError('상태를 변경하지 못했습니다.'); return }
    await refresh()
  }

  const currentItems = useMemo(() => (records[active] || []).filter(item =>
    [item.title, item.body, item.summary, item.person].some(value => (value || '').toLowerCase().includes(search.toLowerCase()))
  ), [active, records, search])

  return <div className="shell">
    <button className="mobile-menu-button" type="button" onClick={() => setMobileMenu(true)} aria-label="메뉴 열기"><Menu size={21} /></button>
    {mobileMenu && <button className="scrim" type="button" onClick={() => setMobileMenu(false)} aria-label="메뉴 닫기" />}
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-icon"><Bot size={20} /></div><div><strong>{name}</strong><small>OpenClaw workspace</small></div><button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="닫기"><X size={19} /></button></div>
      <button className={`nav-item home-nav ${active === 'home' ? 'selected' : ''}`} onClick={() => navigate('home')}><Home size={17} />홈</button>
      <div className="sidebar-rule" />
      <div className="menu-caption">전체 메뉴</div>
      <nav aria-label="대시보드 메뉴">
        {GROUPS.map(group => <section className="nav-group" key={group.title}>
          <button className="group-trigger" onClick={() => setOpenGroup(openGroup === group.title ? '' : group.title)} aria-expanded={openGroup === group.title}>{group.title}<ChevronDown size={14} className={openGroup === group.title ? 'rotated' : ''} /></button>
          {openGroup === group.title && <div className="group-items">{group.items.map(([key, label, Icon]) => <button key={key} className={`nav-item ${active === key ? 'selected' : ''}`} onClick={() => navigate(key)}><Icon size={16} />{label}</button>)}</div>}
        </section>)}
      </nav>
      <div className="sidebar-footer"><span className="avatar">나</span><div><strong>개인 작업 공간</strong><small>내 데이터만 표시</small></div></div>
    </aside>
    <main className="main"><div className="content">
      {error && <div className="error-bar" role="alert">{error}<button onClick={refresh}>다시 시도</button></div>}
      {active === 'home' ? <HomePage records={records} system={system} loading={loading} navigate={navigate} />
        : active === 'agents' ? <AgentsPage system={system} loading={loading} />
        : active === 'operations' ? <OperationsPage system={system} loading={loading} />
        : <>
          <header className="page-header"><div><p className="eyebrow">{GROUPS.find(group => group.items.some(([key]) => key === active))?.title}</p><h1>{SETTINGS[active].title}</h1><p className="subtitle">{SETTINGS[active].subtitle}</p></div><button className="primary-button" onClick={() => { setEditing(null); setFormOpen(true) }}><Plus size={17} />{SETTINGS[active].singular} 추가</button></header>
          {active === 'email' && <div className="notice">이 화면은 메일함과 자동 동기화되지 않습니다. 메일 연동 전에는 처리 메모만 저장합니다.</div>}
          {active === 'notebooks' && <div className="notice">NotebookLM API 연동을 제공하지 않습니다. 자신의 노트북 링크를 보관하고 새 창으로 열 수 있습니다.</div>}
          <div className="toolbar"><div className="search-box"><Search size={17} /><input aria-label="기록 검색" placeholder={`${SETTINGS[active].title} 검색`} value={search} onChange={event => setSearch(event.target.value)} /></div><span>{currentItems.length}건</span></div>
          <section className="list-panel" aria-label={`${SETTINGS[active].title} 목록`}>
            {loading ? <Empty>기록을 불러오는 중입니다.</Empty> : currentItems.length === 0 ? <Empty>{search ? '검색 결과가 없습니다.' : `아직 ${SETTINGS[active].singular} 기록이 없습니다.`}</Empty> : currentItems.map(item => <article className="record-row" key={item.id}>
              <div className="record-main"><div className="record-top"><button className="record-title" onClick={() => { setEditing(item); setFormOpen(true) }}>{item.title}</button>{['tasks', 'proposals', 'email'].includes(active) && <Badge status={item.status} />}</div><p>{item.summary || item.body || item.person || '내용 없음'}</p><div className="record-meta"><span>{formatDate(item.date || item.createdAt)}</span>{item.person && <span>{item.person}</span>}{item.source && <span>{item.source}</span>}{item.dueAt && <span>다음 일정 {formatDate(item.dueAt)}</span>}</div></div>
              <div className="record-actions">{['tasks', 'proposals', 'email'].includes(active) && item.status !== 'done' && <button className="small-action" onClick={() => setStatus(item, 'done')} aria-label={`${item.title} 완료 처리`}><Check size={16} /></button>}{item.link && /^https:\/\//.test(item.link) && <a className="small-action" href={item.link} target="_blank" rel="noopener noreferrer" aria-label={`${item.title} 열기`}><ArrowRight size={16} /></a>}<button className="small-action danger" onClick={() => remove(item)} aria-label={`${item.title} 삭제`}><Trash2 size={15} /></button></div>
            </article>)}
          </section>
        </>}
    </div></main>
    {formOpen && SETTINGS[active] && <RecordForm setting={SETTINGS[active]} initial={editing} onClose={() => { setFormOpen(false); setEditing(null) }} onSave={save} />}
  </div>
}

function HomePage({ records, system, loading, navigate }) {
  const cards = [
    { title: '먼저 볼 일', count: countOpen(records.tasks), hint: '완료 전 업무', key: 'tasks', Icon: LayoutList },
    { title: '검토할 제안', count: countOpen(records.proposals), hint: '결정 대기', key: 'proposals', Icon: Sparkles },
    { title: '최근 기록', count: (records.meetings || []).length + (records.notes || []).length, hint: '미팅과 메모', key: 'meetings', Icon: BookOpen },
  ]
  const recent = [...(records.tasks || []), ...(records.meetings || []), ...(records.notes || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6)
  return <>
    <header className="page-header home-header"><div><p className="eyebrow">PERSONAL WORKSPACE</p><h1>홈</h1><p className="subtitle">오늘의 업무와 기록을 한눈에 확인하세요.</p></div><div className="connection"><span className={system?.gatewayReachable ? 'dot ok' : 'dot'} />{system?.gatewayReachable ? 'OpenClaw 연결됨' : '연결 확인 필요'}</div></header>
    <div className="metric-grid">{cards.map(({ title, count, hint, key, Icon }) => <button className="metric" key={title} onClick={() => navigate(key)}><span className="metric-top"><Icon size={17} />{title}<ArrowRight size={15} /></span><strong>{loading ? '—' : count}</strong><small>{hint}</small></button>)}</div>
    <div className="home-grid"><section className="surface"><div className="section-heading"><h2>최근 움직임</h2><span>내 기록</span></div>{recent.length ? recent.map(item => <div className="activity-row" key={item.id}><span className="activity-mark" /><div><strong>{item.title}</strong><small>{item.summary || item.body || '기록됨'}</small></div><time>{formatDate(item.updatedAt)}</time></div>) : <Empty>아직 기록이 없습니다. 메뉴에서 첫 항목을 추가해 보세요.</Empty>}</section><section className="surface"><div className="section-heading"><h2>시스템 상태</h2><button onClick={() => navigate('operations')}>자세히 보기 <ArrowRight size={14} /></button></div><div className="system-line"><span>OpenClaw</span><strong>{system?.connected ? '연결됨' : '확인 불가'}</strong></div><div className="system-line"><span>Gateway</span><strong>{system?.gatewayReachable ? '정상' : '확인 필요'}</strong></div><div className="system-line"><span>에이전트</span><strong>{system?.agents?.length ?? '—'}개</strong></div><div className="system-line"><span>자동화</span><strong>{system?.jobs?.length ?? '—'}개</strong></div><p className="fine-print">마지막 확인 {formatDate(system?.checkedAt)}</p></section></div>
  </>
}

function AgentsPage({ system, loading }) {
  return <><header className="page-header"><div><p className="eyebrow">팀 운영</p><h1>팀관리</h1><p className="subtitle">내 OpenClaw에 실제 등록된 에이전트를 표시합니다.</p></div></header><section className="list-panel">{loading ? <Empty>에이전트를 확인하는 중입니다.</Empty> : !system?.connected ? <Empty>이 컴퓨터에서 OpenClaw CLI를 찾거나 연결할 수 없습니다.</Empty> : !system.agents.length ? <Empty>등록된 에이전트가 없습니다.</Empty> : system.agents.map(agent => <div className="record-row" key={agent.id}><div className="agent-icon"><Bot size={19} /></div><div className="record-main"><div className="record-top"><strong>{agent.name}</strong>{agent.bootstrapPending && <Badge status="waiting" />}</div><p>에이전트 ID: {agent.id}</p><div className="record-meta"><span>세션 {agent.sessionsCount}개</span><span>최근 갱신 {formatDate(agent.lastUpdatedAt)}</span></div></div></div>)}</section></>
}

function OperationsPage({ system, loading }) {
  return <><header className="page-header"><div><p className="eyebrow">팀 운영</p><h1>운영현황</h1><p className="subtitle">OpenClaw 상태와 자동화를 읽기 전용으로 확인합니다.</p></div></header><div className="metric-grid operations-metrics"><div className="metric"><span className="metric-top"><Activity size={17} />Gateway</span><strong className="word-metric">{system?.gatewayReachable ? '정상' : '확인 필요'}</strong><small>{system?.runtimeVersion || '버전 확인 불가'}</small></div><div className="metric"><span className="metric-top"><Bot size={17} />에이전트</span><strong>{system?.agents?.length ?? '—'}</strong><small>등록된 에이전트</small></div><div className="metric"><span className="metric-top"><Clock3 size={17} />자동화</span><strong>{system?.jobs?.length ?? '—'}</strong><small>활성 {system?.jobs?.filter(job => job.enabled).length ?? '—'}개</small></div></div><section className="surface"><div className="section-heading"><h2>자동화 실행</h2><span>OpenClaw CLI</span></div>{loading ? <Empty>자동화를 확인하는 중입니다.</Empty> : system?.cronError ? <Empty>{system.cronError}</Empty> : !system?.jobs?.length ? <Empty>등록된 자동화가 없습니다.</Empty> : system.jobs.map(job => <div className="activity-row" key={job.id}><span className={`activity-mark ${job.enabled ? 'active' : ''}`} /><div><strong>{job.name}</strong><small>{job.enabled ? '활성' : '비활성'} · 마지막 실행 {job.lastRunStatus || '기록 없음'}</small></div><time>{formatDate(job.lastRunAtMs)}</time></div>)}</section><p className="fine-print">이 화면은 실행·수정 권한을 제공하지 않습니다. 실제 자동화 설정은 OpenClaw에서 관리하세요.</p></>
}

function RecordForm({ setting, initial, onClose, onSave }) {
  const [values, setValues] = useState(initial || { title: '', body: '', summary: '', person: '', date: '', dueAt: '', link: '', status: 'open' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try { await onSave(values) } catch (cause) { setError(cause.message); setSaving(false) }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title"><div className="modal-head"><div><p className="eyebrow">{setting.title}</p><h2 id="form-title">{initial ? '기록 수정' : `${setting.singular} 추가`}</h2></div><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={19} /></button></div><form onSubmit={submit}>{setting.fields.map(field => <label className="field" key={field}><span>{FIELD_LABELS[field]}</span>{field === 'body' || field === 'summary' ? <textarea rows={field === 'body' ? 6 : 3} value={values[field] || ''} onChange={event => setValues({ ...values, [field]: event.target.value })} /> : field === 'status' ? <select value={values.status || 'open'} onChange={event => setValues({ ...values, status: event.target.value })}>{STATUS_OPTIONS.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select> : <input type={field === 'link' ? 'url' : field === 'date' || field === 'dueAt' ? 'date' : 'text'} required={field === 'title'} value={values[field] || ''} onChange={event => setValues({ ...values, [field]: event.target.value })} />}</label>)}{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>취소</button><button className="primary-button" type="submit" disabled={saving}>{saving ? '저장 중…' : '저장'}</button></div></form></div></div>
}
