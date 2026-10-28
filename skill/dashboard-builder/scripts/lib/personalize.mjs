// 개인화 재료 검증: 내 업무(커스텀 메뉴) · 테마 · 위젯.
// 스킬 폴더는 앱 없이 VPS 에 따로 설치되므로 앱의 lib/menu-tree.js 와 같은 규칙을 여기에 한 번 더 둔다.
// 두 쪽 결과가 같은지는 tests/personalize.test.mjs 가 대조한다. 규칙을 바꾸면 둘 다 바꾼다.

export const CUSTOM_KEY = /^c-[a-z0-9-]{1,30}$/
export const MAX_CUSTOM_MENUS = 6
export const FIELD_TYPES = ['title', 'body', 'summary', 'person', 'agent', 'date', 'dueAt', 'link', 'status']
export const STATUS_KEYS = ['open', 'working', 'waiting', 'done', 'rejected']
export const THEME_PRESET_KEYS = ['olive', 'ocean', 'sunset', 'forest', 'mono', 'midnight']
export const ICON_NAMES = [
  'LayoutList', 'Sparkles', 'Users', 'Activity', 'Radio', 'Gauge', 'MessageSquare', 'MessageCircle', 'Inbox', 'Phone', 'Mailbox', 'Presentation', 'Send',
  'ShoppingCart', 'Package', 'Search', 'GraduationCap', 'Ticket', 'FolderKanban', 'Youtube', 'Lightbulb', 'Newspaper', 'Globe', 'BookOpen', 'FileText',
  'Mic', 'Library', 'NotebookTabs', 'Settings',
  'Briefcase', 'Calendar', 'Camera', 'Coffee', 'Heart', 'Star', 'ShoppingBag', 'Truck', 'Wallet', 'Music', 'Dumbbell', 'Utensils', 'Scissors', 'PenTool',
  'Flower2', 'Gift', 'Palette', 'Receipt', 'ClipboardList', 'Target', 'Megaphone', 'Stethoscope', 'Wrench', 'Plane', 'Dog', 'Home', 'Car', 'Leaf', 'Smile',
  'Store', 'Handshake', 'PiggyBank', 'Clapperboard', 'Sprout', 'Hammer',
]
export const MAX_WIDGET_HTML = 60000
const AGENT_ID = /^[a-z][a-z0-9-]{1,39}$/

function cleanText(value, limit) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, limit) : ''
}

// 반환: { customMenus, owners } — owner 는 메뉴 정의가 아니라 config.menus[].owner 로 옮겨 간다.
export function normalizeCustomMenus(input) {
  if (input === undefined || input === null) return { customMenus: [], owners: {} }
  if (!Array.isArray(input)) throw new Error('customMenus must be an array')
  if (input.length > MAX_CUSTOM_MENUS) throw new Error(`customMenus: at most ${MAX_CUSTOM_MENUS} menus`)
  const seen = new Set()
  const owners = {}
  const customMenus = input.map((raw, index) => {
    const at = `customMenus[${index}]`
    if (!raw || typeof raw !== 'object') throw new Error(`${at} must be an object`)
    const key = typeof raw.key === 'string' ? raw.key.trim() : ''
    if (!CUSTOM_KEY.test(key)) throw new Error(`${at}.key must look like c-bouquet (c- + lowercase letters/digits/-)`)
    if (seen.has(key)) throw new Error(`${at}.key duplicated: ${key}`)
    seen.add(key)
    const label = cleanText(raw.label, 20)
    if (!label) throw new Error(`${at}.label is required`)
    if (raw.icon !== undefined && !ICON_NAMES.includes(raw.icon)) throw new Error(`${at}.icon unknown: ${raw.icon} (see references/personalize.md)`)
    const icon = ICON_NAMES.includes(raw.icon) ? raw.icon : 'Sparkles'
    const fields = ['title']
    for (const field of Array.isArray(raw.fields) ? raw.fields : ['body', 'status']) {
      if (!FIELD_TYPES.includes(field)) throw new Error(`${at}.fields: unknown field ${field} (use ${FIELD_TYPES.join(', ')})`)
      if (!fields.includes(field)) fields.push(field)
    }
    const fieldLabels = {}
    for (const [field, value] of Object.entries(raw.fieldLabels && typeof raw.fieldLabels === 'object' ? raw.fieldLabels : {})) {
      const text = cleanText(value, 20)
      if (fields.includes(field) && text) fieldLabels[field] = text
    }
    const statusLabels = {}
    for (const [status, value] of Object.entries(raw.statusLabels && typeof raw.statusLabels === 'object' ? raw.statusLabels : {})) {
      const text = cleanText(value, 12)
      if (STATUS_KEYS.includes(status) && text && fields.includes('status')) statusLabels[status] = text
    }
    if (raw.owner !== undefined && raw.owner !== '') {
      if (!AGENT_ID.test(String(raw.owner))) throw new Error(`${at}.owner invalid agent id: ${raw.owner}`)
      owners[key] = raw.owner
    }
    return { key, label, icon, purpose: cleanText(raw.purpose, 120), fields, fieldLabels, statusLabels, kanban: raw.kanban === true && fields.includes('status') }
  })
  return { customMenus, owners }
}

export function normalizeTheme(input) {
  const raw = input && typeof input === 'object' ? input : {}
  if (raw.preset !== undefined && !THEME_PRESET_KEYS.includes(raw.preset)) throw new Error(`theme.preset must be one of ${THEME_PRESET_KEYS.join(', ')}`)
  if (raw.accent !== undefined && raw.accent !== '' && !/^#[0-9a-fA-F]{6}$/.test(String(raw.accent).trim())) throw new Error('theme.accent must be a #rrggbb color')
  return {
    preset: THEME_PRESET_KEYS.includes(raw.preset) ? raw.preset : 'olive',
    accent: typeof raw.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.accent.trim()) ? raw.accent.trim().toLowerCase() : '',
    emoji: cleanText(raw.emoji, 8),
    tagline: cleanText(raw.tagline, 80),
  }
}

export function normalizeWidget(input) {
  if (!input || typeof input !== 'object') return null
  const html = typeof input.html === 'string' ? input.html.trim() : ''
  if (!html) return null
  if (html.length > MAX_WIDGET_HTML) throw new Error(`widget.html is too large (${html.length} > ${MAX_WIDGET_HTML} chars)`)
  // 위젯은 격리 화면에서 외부 통신이 막힌다. 외부 자원을 쓰면 PC 에서 빈 칸이 되므로 미리 알려 준다.
  // 가상 오피스 키트 CDN(jsDelivr 의 IrumHahn/openclaw-virtual-office)만 예외 — PC 앱의 위젯 CSP 가 같은 주소를 허용한다.
  const stripped = html.replace(/https:\/\/cdn\.jsdelivr\.net\/gh\/IrumHahn\/openclaw-virtual-office@[^"'\s)]+/g, 'cdn:ok').replace(/https:\/\/fonts\.(googleapis|gstatic)\.com\/[^"'\s)]*/g, 'cdn:ok')
  const external = stripped.match(/<(script|link|img|iframe)[^>]+(src|href)\s*=\s*["']?https?:/i)
  if (external) throw new Error(`widget uses an external ${external[1]} (${external[2]}=http…). Inline everything — external loads are blocked on the PC`)
  return { title: cleanText(input.title, 40) || '나의 위젯', html }
}
