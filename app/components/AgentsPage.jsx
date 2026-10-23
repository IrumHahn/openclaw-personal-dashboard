'use client'

import { Bot } from 'lucide-react'
import { MENU_BY_KEY } from '../../lib/menu-tree'
import { Empty, formatDate, formatDateTime } from './shared'

// 세 출처를 합친다: config.agents(팀 온보딩 조직도) ⨝ system.registeredAgents(VPS 동기화) ⨝ system.agents(이 PC 의 CLI).
export default function AgentsPage({ config, menus, system, loading, navigate }) {
  const registered = new Map((system?.registeredAgents || []).map(a => [a.id, a]))
  const local = new Map((system?.agents || []).map(a => [a.id, a]))
  const rows = config.agents.map(agent => ({ ...agent, registered: registered.get(agent.id) || null, local: local.get(agent.id) || null }))
  const extras = [...registered.values()].filter(a => !config.agents.some(c => c.id === a.id))
  const unowned = menus.filter(menu => !menu.owner && menu.kind !== 'system' && !menu.locked)
  const ownerOf = agentId => menus.filter(menu => menu.owner === agentId)
  return <>
    <header className="page-header"><div><p className="eyebrow">팀 운영</p><h1>팀관리</h1><p className="subtitle">내 팀(직원)과 담당 메뉴, VPS 등록 상태를 봅니다. 직원 추가·변경은 OpenClaw 의 팀 온보딩 스킬로 합니다.</p></div></header>
    {loading ? <section className="list-panel"><Empty>팀을 확인하는 중입니다.</Empty></section>
      : !rows.length && !extras.length ? <section className="list-panel"><Empty>아직 조직도가 없습니다. OpenClaw 에서 "에이전트 팀 만들어줘" → 그 다음 "대시보드 만들어줘" → 홈에서 동기화를 누르세요.</Empty></section>
      : <section className="list-panel" aria-label="직원 목록">
        {rows.map(agent => <div className="record-row" key={agent.id}>
          <div className="agent-icon agent-emoji" aria-hidden>{agent.emoji || <Bot size={19} />}</div>
          <div className="record-main">
            <div className="record-top"><strong>{agent.name}</strong>{agent.coordinator && <span className="badge badge-done">총괄</span>}<span className={`badge ${agent.registered ? 'badge-done' : 'badge-waiting'}`}>{agent.registered ? 'VPS 등록됨' : system?.registeredSyncedAt ? '미등록' : '동기화 전'}</span></div>
            <p>{agent.role}{agent.mission ? ` · ${agent.mission}` : ''}</p>
            <div className="record-meta">
              <span>ID {agent.id}</span>
              <span>담당 메뉴: {ownerOf(agent.id).length ? ownerOf(agent.id).map(m => m.label).join(', ') : '없음'}</span>
              {agent.registered?.sessionsCount != null && <span>세션 {agent.registered.sessionsCount}개</span>}
              {agent.registered?.lastUpdatedAt && <span>최근 {formatDate(agent.registered.lastUpdatedAt)}</span>}
            </div>
          </div>
        </div>)}
        {extras.map(agent => <div className="record-row" key={agent.id}>
          <div className="agent-icon agent-emoji" aria-hidden>{agent.emoji || <Bot size={19} />}</div>
          <div className="record-main"><div className="record-top"><strong>{agent.name}</strong><span className="badge">조직도 밖</span></div><p>VPS 에 등록돼 있지만 team.json 에 없는 에이전트입니다.</p><div className="record-meta"><span>ID {agent.id}</span></div></div>
        </div>)}
      </section>}
    {unowned.length > 0 && <div className="notice">담당 직원이 없는 메뉴: {unowned.map(m => m.label).join(', ')}. 설정에서 담당을 지정하거나, 팀 온보딩 스킬로 새 직원을 추가하세요. <button className="link-button" onClick={() => navigate('settings')}>설정으로</button></div>}
    <p className="fine-print">조직도 출처: 팀 온보딩 `team.json` · 등록 상태 출처: VPS 동기화{system?.registeredSyncedAt ? ` (${formatDateTime(system.registeredSyncedAt)})` : ''} · 이 PC 의 OpenClaw CLI: {system?.connected ? `에이전트 ${system.agents.length}개 보임` : '없음'}</p>
  </>
}
