import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultConfig, normalizeConfig, visibleMenus } from '../lib/config.js'
import { MENUS, RECORD_KEYS, GROUPS } from '../lib/menu-tree.js'

test('menu tree has 30 menus in 5 groups with unique keys', () => {
  assert.equal(MENUS.length, 30)
  assert.equal(new Set(MENUS.map(m => m.key)).size, 30)
  for (const menu of MENUS) assert.ok(GROUPS.includes(menu.group), menu.key)
  assert.ok(RECORD_KEYS.includes('tasks') && RECORD_KEYS.includes('ideas'))
})

test('default config enables the week-1 basic six and settings/agents', () => {
  const config = defaultConfig()
  assert.deepEqual(config.menus.map(m => m.key), ['tasks', 'agents', 'email', 'ideas', 'notes', 'settings'])
  assert.equal(config.favorites.length, 6)
  assert.equal(config.week, 1)
})

test('normalize rejects unknown menu keys and bad owner ids, clamps week', () => {
  assert.throws(() => normalizeConfig({ menus: [{ key: 'nope' }] }), /unknown menu key/)
  assert.throws(() => normalizeConfig({ menus: [{ key: 'tasks', owner: 'Bad Id' }] }), /invalid owner/)
  assert.equal(normalizeConfig({ week: 9 }).week, 1)
  assert.equal(normalizeConfig({ week: 3 }).week, 3)
})

test('normalize always keeps settings and agents, dedupes menus and favorites, caps favorites at 6', () => {
  const config = normalizeConfig({ menus: ['tasks', 'tasks', 'notes'], favorites: ['tasks', 'tasks', 'notes', 'email', 'ideas', 'agents', 'settings', 'meetings'] })
  assert.deepEqual(config.menus.map(m => m.key), ['tasks', 'notes', 'settings', 'agents'])
  assert.equal(config.favorites.length, 6)
  assert.ok(!config.favorites.includes('meetings'))
})

test('owners fall back to agent.menus and locked menus are computed from week', () => {
  const config = normalizeConfig({ week: 1, menus: [{ key: 'tasks' }, { key: 'kakao' }], agents: [{ id: 'mira', name: '미라', menus: ['tasks'] }] })
  assert.equal(config.menus.find(m => m.key === 'tasks').owner, 'mira')
  const visible = visibleMenus(config)
  assert.equal(visible.find(m => m.key === 'kakao').locked, true)
  assert.equal(visible.find(m => m.key === 'kakao').enabledFromWeek, 2)
  assert.equal(visible.find(m => m.key === 'tasks').locked, false)
})
