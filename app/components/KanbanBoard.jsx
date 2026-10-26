'use client'

import { ArrowLeft, ArrowRight } from 'lucide-react'
import { AgentChip, STATUS_LABELS, formatDate } from './shared'

const COLUMNS = ['open', 'working', 'waiting', 'done']

// 드래그 대신 버튼으로 옮긴다: 키보드·터치·초보자 모두에게 분명하다.
export default function KanbanBoard({ items, agents, onStatus, onEdit, statusLabels = {} }) {
  const name = status => statusLabels[status] || STATUS_LABELS[status] || ''
  return <div className="kanban" role="list">
    {COLUMNS.map((status, index) => {
      const cards = items.filter(item => (item.status || 'open') === status)
      return <section className="kanban-column" key={status} aria-label={name(status)}>
        <header><strong>{name(status)}</strong><span>{cards.length}</span></header>
        {cards.length === 0 && <p className="kanban-empty">비어 있음</p>}
        {cards.map(item => <article className="kanban-card" key={item.id} role="listitem">
          <button className="record-title" onClick={() => onEdit(item)}>{item.title}</button>
          {item.body && <p>{item.body}</p>}
          <div className="record-meta"><AgentChip agent={item.agent} agents={agents} />{item.person && <span>{item.person}</span>}{item.dueAt && <span>{formatDate(item.dueAt)}까지</span>}{item.source && <span className="source">{item.source}</span>}</div>
          <div className="kanban-move">
            <button type="button" disabled={index === 0} onClick={() => onStatus(item, COLUMNS[index - 1])} aria-label={`${item.title} 을(를) ${name(COLUMNS[index - 1])} 로`}><ArrowLeft size={14} /></button>
            <button type="button" disabled={index === COLUMNS.length - 1} onClick={() => onStatus(item, COLUMNS[index + 1])} aria-label={`${item.title} 을(를) ${name(COLUMNS[index + 1])} 로`}><ArrowRight size={14} /></button>
          </div>
        </article>)}
      </section>
    })}
  </div>
}
