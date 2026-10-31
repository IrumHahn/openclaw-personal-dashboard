'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronDown, Copy, RotateCcw } from 'lucide-react'
import { GRADES, STREAK_GOAL, gradeMessage, isPending, ojtBoard } from '../../lib/ojt'
import { AgentChip, Empty, api, formatDate, formatDateTime } from './shared'

// 수습: 업무별로 AI 직원의 보고를 모아 보고, 보고마다 👍 ✏️ ❌ 로 채점한다.
// 채점은 inbox 의 grades.json 으로 나가고, 비서가 다음 동기화 때 가져가 lessons.md·설명서를 고친 뒤 "반영됨"을 돌려준다.
export default function OjtPage({ menu, config, items, loading, onChanged }) {
  const board = useMemo(() => ojtBoard(items), [items])
  const pending = items.filter(isPending).length
  const ungraded = board.reduce((sum, job) => sum + job.ungraded, 0)
  return <>
    <header className="page-header"><div><p className="eyebrow">{menu.group}</p><h1>{menu.label}</h1><p className="subtitle">{menu.purpose}</p></div>
      <div className="ojt-counters"><span className="chip">채점 안 한 보고 <strong>{ungraded}</strong></span><span className={`chip ${pending ? 'on' : ''}`}>비서에게 전달 대기 <strong>{pending}</strong></span></div></header>
    <div className="notice">보고를 읽고 <b>👍 좋아요 · ✏️ 고칠 점 · ❌ 틀렸어요</b> 중 하나를 누릅니다. ✏️·❌는 한 줄 이유를 꼭 적어 주세요. 비서가 다음 동기화 때 채점을 가져가 설명서를 고치고, 이 화면에 <b>반영됨 ✓</b>을 돌려줍니다. 연속 👍 {STREAK_GOAL}번이면 다음 등급 후보입니다.</div>
    {loading ? <section className="list-panel"><Empty>수습 기록을 불러오는 중입니다.</Empty></section>
      : !board.length ? <section className="list-panel"><Empty>아직 수습 보고가 없습니다. 텔레그램에서 총괄에게 “수습 업무 보고를 대시보드로 보내줘”라고 말해 보세요.</Empty></section>
      : board.map(job => <JobSection key={job.id} job={job} config={config} onChanged={onChanged} />)}
  </>
}

function JobSection({ job, config, onChanged }) {
  return <section className="surface ojt-job" aria-label={`${job.title} 수습`}>
    <div className="ojt-job-head">
      <div><h2>{job.title}</h2><div className="record-meta">{job.agent && <AgentChip agent={job.agent} agents={config.agents} />}{job.level && <span className="ojt-level">{job.level} · {job.levelName}</span>}<span>보고 {job.reports.length}건</span></div></div>
      <div className="ojt-streak" aria-label={`연속 좋아요 ${job.streak}번, 목표 ${STREAK_GOAL}번`}>
        <span className="ojt-dots">{Array.from({ length: STREAK_GOAL }, (_, i) => <i key={i} className={i < job.streak ? 'on' : ''} />)}</span>
        <small>연속 👍 {Math.min(job.streak, STREAK_GOAL)}/{STREAK_GOAL}{job.streak >= STREAK_GOAL ? ' · 승급 후보' : ''}</small>
      </div>
    </div>
    {job.lesson && <p className="ojt-lesson"><strong>최근 배운 것</strong> {job.lesson}</p>}
    {job.summary && <p className="card-muted">{job.summary}</p>}
    {job.reports.length ? job.reports.map(report => <Report key={report.id} report={report} jobTitle={job.title} onChanged={onChanged} />) : <p className="card-muted">이 업무의 보고가 아직 없습니다.</p>}
  </section>
}

function Report({ report, jobTitle, onChanged }) {
  const [open, setOpen] = useState(!report.grade)
  const [regrading, setRegrading] = useState(false)
  const [choice, setChoice] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const graded = Boolean(report.grade) && !regrading
  const pending = isPending(report)

  async function submit(grade, text = '') {
    setSaving(true); setError('')
    try {
      await api('/api/ojt', { method: 'POST', body: JSON.stringify({ id: report.id, grade, note: text }) })
      setRegrading(false); setChoice(''); setNote(''); setOpen(false)
      await onChanged()
    } catch (cause) { setError(cause.message) }
    finally { setSaving(false) }
  }
  function pick(grade) {
    if (GRADES[grade].needsNote) { setChoice(grade); return }
    submit(grade)
  }
  async function copy() {
    try { await navigator.clipboard.writeText(gradeMessage(report, jobTitle)); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { setError('복사하지 못했습니다. 아래 문장을 직접 선택해 복사하세요: ' + gradeMessage(report, jobTitle)) }
  }

  return <article className={`ojt-report ${graded ? `graded grade-${report.grade}` : ''}`}>
    <button className="ojt-report-top" onClick={() => setOpen(!open)} aria-expanded={open}>
      <span className="ojt-report-title">{graded ? GRADES[report.grade].emoji : '🕓'} {report.title}</span>
      <span className="ojt-report-date">{formatDate(report.date || report.createdAt)}<ChevronDown size={14} className={open ? 'rotated' : ''} /></span>
    </button>
    {open && report.body && <div className="ojt-report-body">{report.body}</div>}
    {graded ? <div className="ojt-grade-line">
      <span><b>{GRADES[report.grade].emoji} {GRADES[report.grade].label}</b>{report.gradeNote && ` — ${report.gradeNote}`}</span>
      <span className={pending ? 'ojt-state wait' : 'ojt-state done'}>{pending ? `비서에게 전달 대기 · ${formatDateTime(report.gradedAt)}` : <><Check size={12} /> 반영됨</>}</span>
      <span className="ojt-actions">{pending && <button className="link-button" onClick={copy} title="PC 허용 창을 못 누를 때: 텔레그램으로 총괄에게 붙여 넣기"><Copy size={12} /> {copied ? '복사됨' : '텔레그램용 복사'}</button>}<button className="link-button" onClick={() => { setRegrading(true); setOpen(true) }}><RotateCcw size={12} /> 다시 채점</button></span>
    </div>
    : <div className="ojt-grade-box">
      <div className="ojt-grade-buttons" role="group" aria-label="채점">
        {Object.entries(GRADES).map(([key, g]) => <button key={key} className={`ojt-grade ${choice === key ? 'on' : ''}`} disabled={saving} onClick={() => pick(key)}>{g.emoji} {g.label}</button>)}
        {regrading && <button className="link-button" onClick={() => { setRegrading(false); setChoice('') }}>취소</button>}
      </div>
      {choice && <form className="ojt-note" onSubmit={event => { event.preventDefault(); submit(choice, note) }}>
        <input autoFocus required maxLength={500} placeholder={choice === 'fix' ? '무엇을 고치면 되나요? 한 줄로' : '무엇이 틀렸나요? 한 줄로'} value={note} onChange={event => setNote(event.target.value)} aria-label="채점 이유" />
        <button className="primary-button" type="submit" disabled={saving || !note.trim()}>{saving ? '저장 중…' : '채점 저장'}</button>
      </form>}
    </div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </article>
}
