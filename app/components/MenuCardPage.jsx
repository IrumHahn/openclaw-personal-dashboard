'use client'

import { Lock } from 'lucide-react'
import { AgentChip, Empty, MenuIcon } from './shared'

// 카드형 메뉴: 외부 연동이 붙기 전까지는 "담당 · 목적 · 최근 산출물 · 다음 할 일 · 연동 상태"만 보여준다.
// 연동된 척하지 않는다. 관련 기록은 업무현황/글감실 등 기록형 메뉴에 쌓인다.
export default function MenuCardPage({ menu, config, records, navigate }) {
  const related = (records.tasks || []).filter(item => item.body?.includes(menu.label) || item.title?.includes(menu.label)).slice(0, 5)
  if (menu.locked) return <>
    <header className="page-header"><div><p className="eyebrow">{menu.group}</p><h1>{menu.label}</h1><p className="subtitle">{menu.purpose}</p></div></header>
    <section className="list-panel"><Empty><Lock size={18} /> 이 메뉴는 {menu.enabledFromWeek}주차에 열립니다. 지금은 {config.week}주차입니다. 설정에서 주차를 바꾸면 미리 열 수 있습니다.</Empty></section>
  </>
  return <>
    <header className="page-header"><div><p className="eyebrow">{menu.group}</p><h1>{menu.label}</h1><p className="subtitle">{menu.purpose}</p></div></header>
    <div className="card-grid">
      <section className="surface"><div className="section-heading"><h2>담당 직원</h2></div>{menu.owner ? <p className="card-big"><AgentChip agent={menu.owner} agents={config.agents} /></p> : <p className="card-muted">담당 없음 — <button className="link-button" onClick={() => navigate('settings')}>설정에서 지정</button></p>}</section>
      <section className="surface"><div className="section-heading"><h2>연동 상태</h2></div><p className="card-muted"><MenuIcon name={menu.icon} /> 아직 외부 서비스와 연결되지 않았습니다. 이 메뉴의 실제 기능은 해당 주차 스킬로 붙입니다.</p></section>
      <section className="surface card-wide"><div className="section-heading"><h2>관련 업무</h2><button onClick={() => navigate('tasks')}>업무현황으로</button></div>{related.length ? related.map(item => <div className="activity-row" key={item.id}><span className="activity-mark" /><div><strong>{item.title}</strong><small>{item.body || '기록됨'}</small></div></div>) : <p className="card-muted">업무현황에 "{menu.label}"이 들어간 업무가 없습니다.</p>}</section>
      <section className="surface card-wide"><div className="section-heading"><h2>다음 할 일</h2></div><ol className="next-steps"><li>담당 직원에게 이 메뉴의 목적을 설명하고 첫 과제를 맡긴다.</li><li>결과물은 업무현황 또는 글감실에 기록한다.</li><li>연동 스킬이 배포되면 이 카드가 실제 데이터로 바뀐다.</li></ol></section>
    </div>
  </>
}
