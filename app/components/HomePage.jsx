'use client'

import { ArrowRight, RefreshCw } from 'lucide-react'
import SignatureWidget from './SignatureWidget'
import { Empty, MenuIcon, countOpen, formatDate, formatDateTime } from './shared'

export default function HomePage({ config, catalog, records, system, loading, navigate, onSync, syncing, syncConfigured, inbox }) {
  const favorites = config.favorites.map(key => catalog.byKey[key]).filter(Boolean)
  const recent = Object.values(records).flat().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 6)
  const openTasks = countOpen(records.tasks)
  return <>
    <header className="page-header home-header"><div><p className="eyebrow">{config.week}주차 · PERSONAL WORKSPACE</p><h1>{config.name}</h1><p className="subtitle">{config.theme.tagline || '오늘의 업무와 팀의 움직임을 한눈에 확인하세요.'}</p></div>
      <div className="home-actions">
        <div className="connection"><span className={system?.gatewayReachable || config.sync.lastSuccessAt ? 'dot ok' : 'dot'} />{config.sync.lastSuccessAt ? `동기화 ${formatDateTime(config.sync.lastSuccessAt)}` : system?.gatewayReachable ? 'OpenClaw 연결됨' : '동기화 전'}</div>
        <button className="secondary-button" onClick={onSync} disabled={syncing} title={inbox?.present ? `받은 데이터 버전 ${inbox.version}${inbox.isNew ? ' (새 데이터)' : ''}` : 'VPS 비서가 보낸 데이터를 반영합니다'}><RefreshCw size={14} className={syncing ? 'spin' : ''} />{syncing ? '반영 중…' : inbox?.isNew ? '새 데이터 반영' : '동기화'}</button>
      </div>
    </header>
    <section className="favorites" aria-label="즐겨찾기">
      {favorites.map(menu => <button className="favorite" key={menu.key} onClick={() => navigate(menu.key)}><MenuIcon name={menu.icon} size={18} /><strong>{menu.label}</strong><small>{menu.key === 'tasks' ? `${loading ? '—' : openTasks}건 진행 전` : menu.custom ? `${loading ? '—' : countOpen(records[menu.key])}건 진행 중 · 내 업무` : menu.kind === 'record' ? `${(records[menu.key] || []).length}건` : menu.purpose}</small></button>)}
    </section>
    <SignatureWidget config={config} catalog={catalog} records={records} navigate={navigate} />
    <div className="home-grid">
      <section className="surface"><div className="section-heading"><h2>최근 움직임</h2><span>내 기록</span></div>{recent.length ? recent.map(item => <div className="activity-row" key={item.id}><span className="activity-mark" /><div><strong>{item.title}</strong><small>{item.summary || item.body || '기록됨'}</small></div><time>{formatDate(item.updatedAt)}</time></div>) : <Empty>아직 기록이 없습니다. 동기화하거나 메뉴에서 첫 항목을 추가해 보세요.</Empty>}</section>
      <section className="surface"><div className="section-heading"><h2>팀과 시스템</h2><button onClick={() => navigate('agents')}>팀 보기 <ArrowRight size={14} /></button></div>
        <div className="system-line"><span>직원</span><strong>{config.agents.length}명</strong></div>
        <div className="system-line"><span>VPS 등록 에이전트</span><strong>{system?.registeredAgents?.length ?? '—'}개</strong></div>
        <div className="system-line"><span>이 PC 의 OpenClaw</span><strong>{system?.connected ? '연결됨' : '없음/확인 불가'}</strong></div>
        <div className="system-line"><span>동기화 버전</span><strong>{config.sync.lastVersion || '—'}</strong></div>
        {config.sync.lastError && <p className="fine-print error-text">마지막 동기화 오류: {config.sync.lastError}</p>}
        <p className="fine-print">마지막 확인 {formatDateTime(system?.checkedAt)}</p>
      </section>
    </div>
  </>
}
