'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Menu } from 'lucide-react'
import { defaultConfig, normalizeConfig, visibleMenus } from '../lib/config'
import { CUSTOM_GROUP, CUSTOM_KEY, MENU_BY_KEY, RECORD_KEYS, menuCatalog } from '../lib/menu-tree'
import AgentsPage from './components/AgentsPage'
import HomePage from './components/HomePage'
import MenuCardPage from './components/MenuCardPage'
import OjtPage from './components/OjtPage'
import OperationsPage from './components/OperationsPage'
import RecordList, { RecordForm } from './components/RecordList'
import SettingsPage from './components/SettingsPage'
import Sidebar from './components/Sidebar'
import { api } from './components/shared'

export default function Dashboard() {
  const [active, setActive] = useState('home')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [openGroup, setOpenGroup] = useState(null)
  const [config, setConfig] = useState(() => defaultConfig())
  const [syncConfigured, setSyncConfigured] = useState(false)
  const [inbox, setInbox] = useState(null)
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
      const [configPayload, systemPayload] = await Promise.all([api('/api/config'), api('/api/openclaw')])
      const nextConfig = normalizeConfig(configPayload.config)
      // 기본 기록형 메뉴 + 내 업무(커스텀 메뉴) 컬렉션
      const keys = [...nextConfig.customMenus.map(menu => menu.key), ...RECORD_KEYS]
      const collections = await Promise.all(keys.map(key => api(`/api/collections/${key}`)))
      setConfig(nextConfig)
      setSyncConfigured(Boolean(configPayload.syncConfigured))
      setSystem(systemPayload)
      setRecords(Object.fromEntries(keys.map((key, index) => [key, collections[index].records])))
    } catch (cause) { setError(cause.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  // inbox 감시: VPS 에이전트가 새 데이터를 넣으면(버전 변경) 자동 반영한다. 30초마다 확인.
  useEffect(() => {
    let stopped = false
    async function check() {
      try {
        const status = await api('/api/sync')
        if (stopped) return
        setInbox(status.inbox)
        setSyncConfigured(Boolean(status.inbox?.present || status.remoteConfigured))
        if (status.inbox?.isNew) {
          const result = await api('/api/sync', { method: 'POST' })
          if (stopped) return
          if (result.ok && !result.unchanged) { setNotice(`새 대시보드 데이터를 반영했습니다 (버전 ${result.version || '—'}): 추가 ${result.merge.added} · 갱신 ${result.merge.updated}`); await refresh() }
        }
      } catch {}
    }
    check()
    const timer = setInterval(check, 30000)
    return () => { stopped = true; clearInterval(timer) }
  }, [refresh])
  useEffect(() => {
    const applyHash = () => { const hash = window.location.hash.slice(1); if (hash === 'home' || MENU_BY_KEY[hash] || CUSTOM_KEY.test(hash)) setActive(hash) }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    try { const saved = localStorage.getItem('dashboard:view'); if (saved === 'list' || saved === 'kanban') setView(saved) } catch {}
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  const catalog = useMemo(() => menuCatalog(config.customMenus), [config])
  const menus = useMemo(() => visibleMenus(config), [config])
  const currentEntry = catalog.byKey[active]
  const current = currentEntry ? { ...currentEntry, ...(menus.find(m => m.key === active) || { owner: '', enabledFromWeek: currentEntry.defaultWeek, locked: false }) } : null
  const shownGroup = openGroup ?? (config.customMenus.length ? CUSTOM_GROUP : '팀 운영')

  // 테마: <html data-theme> + 강조색 덮어쓰기. 색 토큰은 style.css 에 있다.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = config.theme.preset
    if (config.theme.accent) root.style.setProperty('--accent', config.theme.accent)
    else root.style.removeProperty('--accent')
  }, [config.theme.preset, config.theme.accent])

  function navigate(key) {
    setActive(key); setSearch(''); setMobileMenu(false); setNotice('')
    window.location.hash = key
    const group = catalog.byKey[key]?.group
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
      const result = await api('/api/sync?force=1', { method: 'POST' })
      setNotice(result.unchanged ? `이미 최신입니다 (버전 ${result.version || '—'})` : `동기화 완료 (버전 ${result.version || '—'}): 추가 ${result.merge.added} · 갱신 ${result.merge.updated}${result.reasons?.length ? ` · 참고: ${result.reasons.join(' / ')}` : ''}`)
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
    <Sidebar config={config} groups={catalog.groups} menus={menus} active={active} navigate={navigate} mobileMenu={mobileMenu} setMobileMenu={setMobileMenu} openGroup={shownGroup} setOpenGroup={setOpenGroup} />
    <main className="main"><div className="content">
      {error && <div className="error-bar" role="alert">{error}<button onClick={refresh}>다시 시도</button></div>}
      {notice && <div className="notice">{notice}</div>}
      {active === 'home' || !current ? <HomePage config={config} catalog={catalog} records={records} system={system} loading={loading} navigate={navigate} onSync={sync} syncing={syncing} syncConfigured={syncConfigured} inbox={inbox} />
        : active === 'agents' ? <AgentsPage config={config} menus={menus} system={system} loading={loading} navigate={navigate} />
        : active === 'operations' ? <OperationsPage system={system} loading={loading} />
        : active === 'settings' ? <SettingsPage key={config.sync.lastSuccessAt || 'settings'} config={config} catalog={catalog} onSave={saveConfig} onSync={sync} syncing={syncing} syncConfigured={syncConfigured} inbox={inbox} refresh={refresh} />
        : active === 'ojt' && !current.locked ? <OjtPage menu={current} config={config} items={records.ojt || []} loading={loading} onChanged={refresh} />
        : current.kind === 'record' && !current.locked ? <RecordList menu={current} config={config} items={currentItems} loading={loading} search={search} setSearch={setSearch} view={view} setView={chooseView} onAdd={() => { setEditing(null); setFormOpen(true) }} onEdit={item => { setEditing(item); setFormOpen(true) }} onRemove={remove} onStatus={setStatus} />
        : <MenuCardPage menu={current} config={config} records={records} navigate={navigate} />}
    </div></main>
    {formOpen && current?.kind === 'record' && <RecordForm menu={current} config={config} initial={editing} onClose={() => { setFormOpen(false); setEditing(null) }} onSave={save} />}
  </div>
}
