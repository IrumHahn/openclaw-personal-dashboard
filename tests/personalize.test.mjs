import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { defaultConfig, normalizeConfig, visibleMenus } from '../lib/config.js'
import { mergeSeed } from '../lib/merge.js'
import * as app from '../lib/menu-tree.js'
import { addRecord } from '../lib/store.js'
import { applyRemoteConfig } from '../lib/sync.js'
import { widgetDocument } from '../lib/widget.js'
import * as skill from '../skill/dashboard-builder/scripts/lib/personalize.mjs'

const dir = path.dirname(fileURLToPath(import.meta.url))
const script = path.join(dir, '..', 'skill', 'dashboard-builder', 'scripts', 'build_dashboard.mjs')

const bouquet = {
  key: 'c-bouquet', label: '예약 꽃다발', icon: 'Flower2', purpose: '픽업 날짜별 꽃다발 주문', fields: ['person', 'dueAt', 'body', 'status'],
  fieldLabels: { person: '고객명', dueAt: '픽업일' }, statusLabels: { open: '주문 접수', working: '제작 중', done: '전달 완료' }, kanban: true,
}
const regulars = { key: 'c-regulars', label: '단골 기념일', icon: 'Gift', fields: ['person', 'date', 'body'] }

test('config accepts custom menus as a "내 업무" group and rejects undefined custom keys', () => {
  const config = normalizeConfig({ customMenus: [bouquet, regulars], menus: ['c-bouquet', 'c-regulars', 'tasks'], favorites: ['c-bouquet', 'tasks'] })
  assert.deepEqual(config.customMenus.map(m => m.key), ['c-bouquet', 'c-regulars'])
  assert.deepEqual(config.customMenus[0].fields, ['title', 'person', 'dueAt', 'body', 'status'])
  assert.equal(config.customMenus[0].statusLabels.open, '주문 접수')
  assert.equal(config.customMenus[1].kanban, false)
  assert.deepEqual(config.favorites, ['c-bouquet', 'tasks'])
  const menus = visibleMenus(config)
  assert.equal(menus[0].group, '내 업무')
  assert.equal(menus[0].custom, true)
  assert.deepEqual(app.menuCatalog(config.customMenus).groups[0], '내 업무')
  assert.throws(() => normalizeConfig({ menus: ['c-ghost'] }), /unknown menu key: c-ghost/)
  assert.throws(() => normalizeConfig({ customMenus: [{ key: 'bouquet', label: 'x' }] }), /c-bouquet/)
  assert.throws(() => normalizeConfig({ customMenus: [{ key: 'c-a', label: 'x', fields: ['price'] }] }), /unknown field price/)
  assert.throws(() => normalizeConfig({ customMenus: Array.from({ length: 7 }, (_, i) => ({ key: `c-m${i}`, label: 'x' })) }), /at most 6/)
})

test('theme and widget normalize to safe defaults', () => {
  const config = defaultConfig()
  assert.deepEqual(config.theme, { preset: 'olive', accent: '', emoji: '', tagline: '' })
  assert.equal(config.widget, null)
  const themed = normalizeConfig({ theme: { preset: 'midnight', accent: '#AA33CC', emoji: '💐', tagline: '  꽃이   늦지 않게 ' }, widget: { title: '', html: '<p>hi</p>' } })
  assert.deepEqual(themed.theme, { preset: 'midnight', accent: '#aa33cc', emoji: '💐', tagline: '꽃이 늦지 않게' })
  assert.equal(themed.widget.title, '나의 위젯')
  assert.equal(normalizeConfig({ theme: { preset: 'neon', accent: 'red' } }).theme.preset, 'olive')
  assert.throws(() => normalizeConfig({ widget: { html: 'x'.repeat(app.MAX_WIDGET_HTML + 1) } }), /too large/)
})

test('skill-side validator matches the app rules (parity)', () => {
  assert.deepEqual([...skill.ICON_NAMES].sort(), [...app.ICON_NAMES].sort())
  assert.deepEqual(skill.THEME_PRESET_KEYS, Object.keys(app.THEME_PRESETS))
  assert.deepEqual(skill.FIELD_TYPES, app.FIELD_TYPES)
  assert.deepEqual(skill.STATUS_KEYS, app.STATUS_KEYS)
  assert.equal(skill.MAX_WIDGET_HTML, app.MAX_WIDGET_HTML)
  const input = [bouquet, regulars, { key: 'c-x', label: '  공백   많은  이름  ', statusLabels: { open: '대기' } }]
  assert.deepEqual(skill.normalizeCustomMenus(input).customMenus, app.normalizeCustomMenus(input))
  const theme = { preset: 'forest', accent: '#123ABC', emoji: '☕', tagline: '한 줄' }
  assert.deepEqual(skill.normalizeTheme(theme), app.normalizeTheme(theme))
  // 스크립트는 더 엄격하다: 틀린 값은 조용히 기본값으로 바꾸지 않고 멈춘다
  assert.throws(() => skill.normalizeTheme({ preset: 'neon' }), /preset/)
  assert.throws(() => skill.normalizeCustomMenus([{ key: 'c-a', label: 'a', icon: 'Unicorn' }]), /icon unknown/)
  assert.throws(() => skill.normalizeWidget({ html: '<script src="https://cdn.example.com/x.js"></script>' }), /external script/)
})

test('custom collections store and merge like built-in record menus', () => {
  const data = { tasks: [] }
  const { record } = addRecord(data, 'c-bouquet', { title: '김OO 장미 30송이', person: '김OO', status: 'open' })
  assert.equal(data['c-bouquet'][0].id, record.id)
  assert.throws(() => addRecord(data, 'bouquet', { title: 'x' }), /Unknown collection/)
  const result = mergeSeed(data, { records: { 'c-bouquet': [{ title: '박OO 꽃바구니', source: 'agent', sourceId: 'b1', status: 'working' }], nope: [{ title: 'x', source: 's', sourceId: '1' }] } })
  assert.equal(result.added, 1)
  assert.equal(data['c-bouquet'].length, 2)
  assert.deepEqual(result.skipped, ['unknown collection nope'])
})

test('remote theme/widget/favorites overwrite PC edits only when the VPS value changed', () => {
  const remote = { name: '꽃집', menus: ['c-bouquet', 'tasks'], customMenus: [bouquet], favorites: ['c-bouquet', 'tasks'], theme: { preset: 'sunset', emoji: '💐' }, widget: { title: '레이더', html: '<p>v1</p>' } }
  // 첫 동기화: PC 가 기본값이면 VPS 값을 받는다
  let local = applyRemoteConfig(defaultConfig(), remote)
  assert.equal(local.theme.preset, 'sunset')
  assert.equal(local.widget.html, '<p>v1</p>')
  assert.deepEqual(local.favorites, ['c-bouquet', 'tasks'])
  assert.equal(local.menus[0].key, 'tasks') // 로컬 순서 유지, 새 메뉴는 뒤로(사이드바는 그룹으로 묶여 '내 업무'가 위)
  // PC 에서 테마를 바꿈 → 같은 VPS 값으로 다시 동기화해도 유지
  local = normalizeConfig({ ...local, theme: { ...local.theme, preset: 'ocean' } })
  local = applyRemoteConfig(local, remote)
  assert.equal(local.theme.preset, 'ocean')
  // VPS 쪽이 바뀌면 그때 덮어쓴다
  local = applyRemoteConfig(local, { ...remote, theme: { preset: 'forest' }, widget: { title: '레이더', html: '<p>v2</p>' } })
  assert.equal(local.theme.preset, 'forest')
  assert.equal(local.widget.html, '<p>v2</p>')
  // 첫 동기화인데 PC 에서 이미 테마를 고쳐 뒀다면 지킨다
  const edited = normalizeConfig({ ...defaultConfig(), theme: { preset: 'mono' } })
  assert.equal(applyRemoteConfig(edited, remote).theme.preset, 'mono')
  // VPS 에서 커스텀 메뉴를 지우면 PC 메뉴·즐겨찾기에서도 빠진다 (unknown key 로 터지지 않음)
  const dropped = applyRemoteConfig(local, { ...remote, customMenus: [], menus: ['tasks'], favorites: ['tasks'] })
  assert.equal(dropped.customMenus.length, 0)
  assert.ok(!dropped.menus.some(m => m.key === 'c-bouquet'))
  assert.ok(!dropped.favorites.includes('c-bouquet'))
})

test('widgetDocument puts the CSP meta first', () => {
  assert.match(widgetDocument('<!doctype html><html><head><title>x</title></head><body>hi</body></html>'), /<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'/)
  assert.match(widgetDocument('<!DOCTYPE html><body>hi</body>'), /^<!DOCTYPE html><head><meta http-equiv/)
  assert.match(widgetDocument('<div>hi</div>'), /^<!doctype html><head><meta http-equiv="Content-Security-Policy"/)
})

function setup() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-personal-'))
  fs.writeFileSync(path.join(temp, 'agents.json'), '[]')
  const out = path.join(temp, 'out')
  const run = (extra = []) => spawnSync(process.execPath, [script, '--agents', path.join(temp, 'agents.json'), '--out', out, ...extra], { encoding: 'utf8' })
  const read = name => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'))
  const write = (name, content) => { const file = path.join(temp, name); fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content)); return file }
  return { temp, run, read, write, cleanup: () => fs.rmSync(temp, { recursive: true, force: true }) }
}

test('build --design puts custom menus first, keeps them on update, and the app accepts the result', () => {
  const t = setup()
  try {
    const design = t.write('design.json', { customMenus: [{ ...bouquet, owner: 'flora' }, regulars], theme: { preset: 'sunset', emoji: '💐', tagline: '꽃이 늦지 않게' } })
    const first = t.run(['--design', design, '--name', '꽃집 사장님의 AI 오피스'])
    assert.equal(first.status, 0, first.stderr)
    const config = t.read('config.json')
    assert.deepEqual(config.menus.slice(0, 2).map(m => m.key), ['c-bouquet', 'c-regulars'])
    assert.equal(config.menus[0].owner, 'flora')
    assert.deepEqual(config.favorites, ['c-bouquet', 'c-regulars', 'tasks', 'ojt', 'agents', 'email'])
    assert.equal(config.theme.preset, 'sunset')
    assert.equal(t.read('manifest.json').counts.customMenus, 2)
    assert.equal(t.read('manifest.json').generator, 'dashboard-builder/0.3')
    assert.doesNotThrow(() => normalizeConfig(config))
    // 업데이트: --design 없이 다시 돌려도 내 업무·테마가 남는다. 커스텀 키로 --owner 도 된다
    const second = t.run(['--owner', 'c-regulars=flora'])
    assert.equal(second.status, 0, second.stderr)
    const updated = t.read('config.json')
    assert.equal(updated.customMenus.length, 2)
    assert.equal(updated.theme.emoji, '💐')
    assert.equal(updated.menus.find(m => m.key === 'c-regulars').owner, 'flora')
    // 정의되지 않은 커스텀 키·틀린 아이콘은 멈춘다
    assert.notEqual(t.run(['--menus', 'c-ghost']).status, 0)
    const bad = t.write('bad.json', { customMenus: [{ key: 'c-a', label: 'a', icon: 'Unicorn' }] })
    assert.match(t.run(['--design', bad]).stderr, /icon unknown/)
  } finally { t.cleanup() }
})

test('build --widget embeds a self-contained widget, rejects external loads and secrets, and --widget none removes it', () => {
  const t = setup()
  try {
    const html = t.write('widget.html', '<!doctype html><html><body><div id="n">0</div><script>addEventListener("message",e=>{n.textContent=e.data.data.menus.length})</script></body></html>')
    const ok = t.run(['--widget', html, '--widget-title', '이번 주 꽃다발 레이더'])
    assert.equal(ok.status, 0, ok.stderr)
    const config = t.read('config.json')
    assert.equal(config.widget.title, '이번 주 꽃다발 레이더')
    assert.match(config.widget.html, /addEventListener/)
    assert.doesNotThrow(() => normalizeConfig(config))
    const external = t.write('ext.html', '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>')
    assert.match(t.run(['--widget', external]).stderr, /external script/)
    const secret = t.write('secret.html', '<script>const api_key = "sk-abcdefghijklmnop"</script>')
    assert.equal(t.run(['--widget', secret]).status, 3)
    const removed = t.run(['--widget', 'none'])
    assert.equal(removed.status, 0, removed.stderr)
    assert.equal(t.read('config.json').widget, null)
  } finally { t.cleanup() }
})
