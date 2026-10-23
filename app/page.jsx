'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Menu } from 'lucide-react'
import { defaultConfig, normalizeConfig, visibleMenus } from '../lib/config'
import { MENU_BY_KEY, RECORD_KEYS } from '../lib/menu-tree'
import AgentsPage from './components/AgentsPage'
import HomePage from './components/HomePage'
import MenuCardPage from './components/MenuCardPage'
import OperationsPage from './components/OperationsPage'
import RecordList, { RecordForm } from './components/RecordList'
import SettingsPage from './components/SettingsPage'
import Sidebar from './components/Sidebar'
import { api } from './components/shared'

export default function Dashboard() {
  const [active, setActive] = useState('home')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [openGroup, setOpenGroup] = useState('팀 운영')
  const [config, setConfig] = useState(() => defaultConfig())
  const [syncConfigured, setSyncConfigured] = useState(false)
  const [records, setRecords] = useState({})
  const [system, setSystem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState('kanban')

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [configPayload, systemPayload, ...collections] = await Promise.all([
        api('/api/config'), api('/api/openclaw'), ...RECORD_KEYS.map(key => api(`/api/collections/${key}`)),
      ])
      setConfig(normalizeConfig(configPayload.config))
      setSyncConfigured(Boolean(configPayload.syncConfigured))
      setSystem(systemPayload)
      setRecords(Object.fromEntries(RECORD_KEYS.map((key, index) => [key, collections[index].records])))
    } catch (cause) { setError(cause.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const applyHash = () => { const hash = window.location.hash.slice(1); if (hash === 'home' || MENU_BY_KEY[hash]) setActive(hash) }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    try { const saved = localStorage.getItem('dashboard:view'); if (saved === 'list' || saved === 'kanban') setView(saved) } catch {}
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  const menus = useMemo(() => visibleMenus(config), [config])
  const current = MENU_BY_KEY[active] ? { ...MENU_BY_KEY[active], ...(menus.find(m => m.key === active) || { owner: '', enabledFromWeek: MENU_BY_KEY[active].defaultWeek, locked: false }) } : null

  function navigate(key) {
    setActive(key); setSearch(''); setMobileMenu(false); setNotice('')
    window.location.hash = key
    const group = MENU_BY_KEY[key]?.group
    if (group) setOpenGroup(group)
  }
  function chooseView(next) { setView(next); try { localStorage.setItem('dashboard:view', next) } catch {} }

  async function save(input) {
    const method = editing ? 'PATCH' : 'POST'
    await api(`/api/collections/${active}`, { method, body: JSON.stringify(editing ? { ...input, id: editing.id } : input) })
    setFormOpen(false); setEditing(null)
    await refresh()
  }
  async function remove(item) {
    if (!window.confirm(`‘${item.title}’ 기록을 삭제할까요?`)) return
    try { await api(`/api/collections/${active}?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' }); await refresh() } catch (cause) { setError(cause.message) }
  }
  async function setStatus(item, status) {
    try { await api(`/api/collections/${active}`, { method: 'PATCH', body: JSON.stringify({ id: item.id, status }) }); await refresh() } catch (cause) { setError(cause.message) }
  }
  async function saveConfig(next) {
    const payload = await api('/api/config', { method: 'PUT', body: JSON.stringify(next) })
    setConfig(normalizeConfig(payload.config))
  }
  async function sync() {
    setSyncing(true); setError(''); setNotice('')
    try {
      const result = await api('/api/sync', { method: 'POST' })
      setNotice(`동기화 완료 (버전 ${result.version || '—'}): 추가 ${result.merge.added} · 갱신 ${result.merge.updated}${result.reasons.length ? ` · 참고: ${result.reasons.join(' / ')}` : ''}`)
      await refresh()
    } catch (cause) { setError(cause.message) }
    finally { setSyncing(false) }
  }

  const currentItems = useMemo(() => (records[active] || []).filter(item =>
    [item.title, item.body, item.summary, item.person, item.agent].some(value => (value || '').toLowerCase().includes(search.toLowerCase()))
  ), [active, records, search])

  return <div className="shell">
    <button className="mobile-menu-button" type="button" onClick={() => setMobileMenu(true)} aria-label="메뉴 열기"><Menu size={21} /></button>
    {mobileMenu && <button className="scrim" type="button" onClick={() => setMobileMenu(false)} aria-label="메뉴 닫기" />}
    <Sidebar config={config} menus={menus} active={active} navigate={navigate} mobileMenu={mobileMenu} setMobileMenu={setMobileMenu} openGroup={openGroup} setOpenGroup={setOpenGroup} />
    <main className="main"><div className="content">
      {error && <div className="error-bar" role="alert">{error}<button onClick={refresh}>다시 시도</button></div>}
      {notice && <div className="notice">{notice}</div>}
      {active === 'home' || !current ? <HomePage config={config} records={records} system={system} loading={loading} navigate={navigate} onSync={sync} syncing={syncing} syncConfigured={syncConfigured} />
        : active === 'agents' ? <AgentsPage config={config} menus={menus} system={system} loading={loading} navigate={navigate} />
        : active === 'operations' ? <OperationsPage system={system} loading={loading} />
        : active === 'settings' ? <SettingsPage key={config.sync.lastSuccessAt || 'settings'} config={config} onSave={saveConfig} onSync={sync} syncing={syncing} syncConfigured={syncConfigured} refresh={refresh} />
        : current.kind === 'record' && !current.locked ? <RecordList menu={current} config={config} items={currentItems} loading={loading} search={search} setSearch={setSearch} view={view} setView={chooseView} onAdd={() => { setEditing(null); setFormOpen(true) }} onEdit={item => { setEditing(item); setFormOpen(true) }} onRemove={remove} onStatus={setStatus} />
        : <MenuCardPage menu={current} config={config} records={records} navigate={navigate} />}
    </div></main>
    {formOpen && current?.kind === 'record' && <RecordForm menu={current} config={config} initial={editing} onClose={() => { setFormOpen(false); setEditing(null) }} onSave={save} />}
  </div>
}
