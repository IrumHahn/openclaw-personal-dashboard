'use client'

import {
  Activity, BookOpen, Bot, CircleAlert, FileText, FolderKanban, Gauge, Globe, GraduationCap, Inbox, LayoutList, Library, Lightbulb,
  Mailbox, MessageCircle, MessageSquare, Mic, Newspaper, NotebookTabs, Package, Phone, Presentation, Radio, Search, Send, Settings,
  ShoppingCart, Sparkles, Ticket, Users, Youtube,
} from 'lucide-react'

export const ICONS = {
  Activity, BookOpen, Bot, FileText, FolderKanban, Gauge, Globe, GraduationCap, Inbox, LayoutList, Library, Lightbulb, Mailbox,
  MessageCircle, MessageSquare, Mic, Newspaper, NotebookTabs, Package, Phone, Presentation, Radio, Search, Send, Settings, ShoppingCart,
  Sparkles, Ticket, Users, Youtube,
}

export function MenuIcon({ name, size = 16 }) {
  const Icon = ICONS[name] || Bot
  return <Icon size={size} />
}

export const STATUS_OPTIONS = ['open', 'working', 'waiting', 'done', 'rejected']
export const STATUS_LABELS = { open: '대기', working: '진행 중', waiting: '검토 대기', done: '완료', rejected: '보류 / 거절' }
export const FIELD_LABELS = { title: '제목', body: '내용 / 전사 원문', summary: '요약', person: '담당자 / 상대', agent: '담당 직원', dueAt: '다음 일정', date: '기록 날짜', link: 'URL', status: '상태' }

export function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function countOpen(records = []) {
  return records.filter(item => !['done', 'rejected'].includes(item.status)).length
}

export function Badge({ status }) {
  return <span className={`badge badge-${status || 'open'}`}>{STATUS_LABELS[status] || status || '기록'}</span>
}

export function Empty({ children }) {
  return <div className="empty"><CircleAlert size={20} /><p>{children}</p></div>
}

export function AgentChip({ agent, agents }) {
  if (!agent) return null
  const found = (agents || []).find(a => a.id === agent)
  return <span className="agent-chip" title={agent}>{found ? `${found.emoji} ${found.name}` : agent}</span>
}

export async function api(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `요청 실패 (${response.status})`)
  return payload
}
