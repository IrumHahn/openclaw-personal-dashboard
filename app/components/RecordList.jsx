'use client'

import { useState } from 'react'
import { ArrowRight, Check, Columns3, List, Plus, Search, Trash2, X } from 'lucide-react'
import { RECORD_FIELDS } from '../../lib/menu-tree'
import KanbanBoard from './KanbanBoard'
import { AgentChip, Badge, Empty, FIELD_LABELS, STATUS_LABELS, STATUS_OPTIONS, formatDate } from './shared'

export default function RecordList({ menu, config, items, loading, search, setSearch, view, setView, onAdd, onEdit, onRemove, onStatus }) {
  const fields = RECORD_FIELDS[menu.key] || ['title', 'body']
  const hasStatus = fields.includes('status')
  const kanbanable = menu.key === 'tasks' || menu.key === 'projects'
  return <>
    <header className="page-header"><div><p className="eyebrow">{menu.group}{menu.owner && <> · 담당 <AgentChip agent={menu.owner} agents={config.agents} /></>}</p><h1>{menu.label}</h1><p className="subtitle">{menu.purpose}</p></div><button className="primary-button" onClick={onAdd}><Plus size={17} />추가</button></header>
    {menu.key === 'email' && <div className="notice">이 화면은 메일함과 자동 동기화되지 않습니다. 메일 연동 전에는 처리 메모만 저장합니다.</div>}
    {menu.key === 'notebooks' && <div className="notice">NotebookLM API 연동을 제공하지 않습니다. 노트북 링크를 보관하고 새 창으로 엽니다.</div>}
    <div className="toolbar">
      <div className="search-box"><Search size={17} /><input aria-label="기록 검색" placeholder={`${menu.label} 검색`} value={search} onChange={event => setSearch(event.target.value)} /></div>
      <div className="toolbar-right">{kanbanable && <div className="view-toggle" role="group" aria-label="보기 방식"><button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')} aria-pressed={view === 'kanban'}><Columns3 size={14} />칸반</button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-pressed={view === 'list'}><List size={14} />목록</button></div>}<span>{items.length}건</span></div>
    </div>
    {loading ? <section className="list-panel"><Empty>기록을 불러오는 중입니다.</Empty></section>
      : items.length === 0 ? <section className="list-panel"><Empty>{search ? '검색 결과가 없습니다.' : `아직 ${menu.label} 기록이 없습니다.`}</Empty></section>
      : kanbanable && view === 'kanban' ? <KanbanBoard items={items} agents={config.agents} onStatus={onStatus} onEdit={onEdit} />
      : <section className="list-panel" aria-label={`${menu.label} 목록`}>
        {items.map(item => <article className="record-row" key={item.id}>
          <div className="record-main"><div className="record-top"><button className="record-title" onClick={() => onEdit(item)}>{item.title}</button>{hasStatus && <Badge status={item.status} />}</div><p>{item.summary || item.body || item.person || '내용 없음'}</p><div className="record-meta"><span>{formatDate(item.date || item.createdAt)}</span><AgentChip agent={item.agent} agents={config.agents} />{item.person && <span>{item.person}</span>}{item.source && <span className="source">{item.source}</span>}{item.dueAt && <span>다음 일정 {formatDate(item.dueAt)}</span>}</div></div>
          <div className="record-actions">{hasStatus && item.status !== 'done' && <button className="small-action" onClick={() => onStatus(item, 'done')} aria-label={`${item.title} 완료 처리`}><Check size={16} /></button>}{item.link && /^https:\/\//.test(item.link) && <a className="small-action" href={item.link} target="_blank" rel="noopener noreferrer" aria-label={`${item.title} 열기`}><ArrowRight size={16} /></a>}<button className="small-action danger" onClick={() => onRemove(item)} aria-label={`${item.title} 삭제`}><Trash2 size={15} /></button></div>
        </article>)}
      </section>}
  </>
}

export function RecordForm({ menu, config, initial, onClose, onSave }) {
  const fields = RECORD_FIELDS[menu.key] || ['title', 'body']
  const [values, setValues] = useState(initial || { title: '', body: '', summary: '', person: '', agent: '', date: '', dueAt: '', link: '', status: 'open' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    setSaving(true); setError('')
    try { await onSave(values) } catch (cause) { setError(cause.message); setSaving(false) }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title"><div className="modal-head"><div><p className="eyebrow">{menu.label}</p><h2 id="form-title">{initial ? '기록 수정' : '추가'}</h2></div><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={19} /></button></div>
    <form onSubmit={submit}>{fields.map(field => <label className="field" key={field}><span>{FIELD_LABELS[field]}</span>
      {field === 'body' || field === 'summary' ? <textarea rows={field === 'body' ? 6 : 3} value={values[field] || ''} onChange={event => setValues({ ...values, [field]: event.target.value })} />
        : field === 'status' ? <select value={values.status || 'open'} onChange={event => setValues({ ...values, status: event.target.value })}>{STATUS_OPTIONS.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select>
        : field === 'agent' ? <select value={values.agent || ''} onChange={event => setValues({ ...values, agent: event.target.value })}><option value="">담당 없음</option>{config.agents.map(agent => <option key={agent.id} value={agent.id}>{agent.emoji} {agent.name} ({agent.role || agent.id})</option>)}</select>
        : <input type={field === 'link' ? 'url' : field === 'date' || field === 'dueAt' ? 'date' : 'text'} required={field === 'title'} value={values[field] || ''} onChange={event => setValues({ ...values, [field]: event.target.value })} />}
    </label>)}{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>취소</button><button className="primary-button" type="submit" disabled={saving}>{saving ? '저장 중…' : '저장'}</button></div></form></div></div>
}
