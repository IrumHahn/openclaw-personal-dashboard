'use client'

import { Activity, Bot, Clock3 } from 'lucide-react'
import { Empty, formatDate } from './shared'

export default function OperationsPage({ system, loading }) {
  return <><header className="page-header"><div><p className="eyebrow">팀 운영</p><h1>운영현황</h1><p className="subtitle">이 PC 의 OpenClaw 상태와 자동화를 읽기 전용으로 확인합니다. VPS 의 에이전트는 팀관리에서 봅니다.</p></div></header>
    <div className="metric-grid operations-metrics"><div className="metric"><span className="metric-top"><Activity size={17} />Gateway</span><strong className="word-metric">{system?.gatewayReachable ? '정상' : '확인 필요'}</strong><small>{system?.runtimeVersion || '버전 확인 불가'}</small></div><div className="metric"><span className="metric-top"><Bot size={17} />에이전트</span><strong>{system?.registeredAgents?.length ?? system?.agents?.length ?? '—'}</strong><small>{system?.registeredAgents?.length ? 'VPS 동기화 기준' : '이 PC 기준'}</small></div><div className="metric"><span className="metric-top"><Clock3 size={17} />자동화</span><strong>{system?.jobs?.length ?? '—'}</strong><small>활성 {system?.jobs?.filter(job => job.enabled).length ?? '—'}개</small></div></div>
    <section className="surface"><div className="section-heading"><h2>자동화 실행</h2><span>OpenClaw CLI</span></div>{loading ? <Empty>자동화를 확인하는 중입니다.</Empty> : system?.cronError ? <Empty>{system.cronError}</Empty> : !system?.jobs?.length ? <Empty>등록된 자동화가 없습니다.</Empty> : system.jobs.map(job => <div className="activity-row" key={job.id}><span className={`activity-mark ${job.enabled ? 'active' : ''}`} /><div><strong>{job.name}</strong><small>{job.enabled ? '활성' : '비활성'} · 마지막 실행 {job.lastRunStatus || '기록 없음'}</small></div><time>{formatDate(job.lastRunAtMs)}</time></div>)}</section>
    <p className="fine-print">이 화면은 실행·수정 권한을 제공하지 않습니다. 실제 자동화 설정은 OpenClaw 에서 관리하세요.</p></>
}
