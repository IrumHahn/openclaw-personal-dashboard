'use client'

import { Bot, ChevronDown, Home, Lock, X } from 'lucide-react'
import { MenuIcon } from './shared'

export default function Sidebar({ config, groups, menus, active, navigate, mobileMenu, setMobileMenu, openGroup, setOpenGroup }) {
  const grouped = groups.map(title => ({ title, items: menus.filter(menu => menu.group === title) })).filter(group => group.items.length)
  return <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
    <div className="brand"><div className="brand-icon">{config.theme.emoji ? <span className="brand-emoji" aria-hidden>{config.theme.emoji}</span> : <Bot size={20} />}</div><div><strong>{config.name}</strong><small>{config.week}주차 · OpenClaw workspace</small></div><button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="닫기"><X size={19} /></button></div>
    <button className={`nav-item home-nav ${active === 'home' ? 'selected' : ''}`} onClick={() => navigate('home')}><Home size={17} />홈</button>
    <div className="sidebar-rule" />
    <div className="menu-caption">내 메뉴</div>
    <nav aria-label="대시보드 메뉴">
      {grouped.map(group => <section className="nav-group" key={group.title}>
        <button className="group-trigger" onClick={() => setOpenGroup(openGroup === group.title ? '' : group.title)} aria-expanded={openGroup === group.title}>{group.title}<ChevronDown size={14} className={openGroup === group.title ? 'rotated' : ''} /></button>
        {openGroup === group.title && <div className="group-items">{group.items.map(menu => <button key={menu.key} className={`nav-item ${active === menu.key ? 'selected' : ''} ${menu.locked ? 'locked' : ''}`} onClick={() => navigate(menu.key)} title={menu.locked ? `${menu.enabledFromWeek}주차에 열립니다` : menu.purpose}><MenuIcon name={menu.icon} />{menu.label}{menu.custom && <span className="custom-dot" aria-label="내 업무 메뉴" />}{menu.locked && <Lock size={12} className="lock" aria-label={`${menu.enabledFromWeek}주차에 열림`} />}</button>)}</div>}
      </section>)}
    </nav>
    <div className="sidebar-footer"><span className="avatar">나</span><div><strong>개인 작업 공간</strong><small>{config.agents.length ? `직원 ${config.agents.length}명` : '내 데이터만 표시'}</small></div></div>
  </aside>
}
