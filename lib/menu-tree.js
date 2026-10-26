// 대시보드 메뉴 트리 (팀 한이룸 AI Office v2 메뉴 구조 기반, 5그룹 30메뉴).
// kind:
//   record — 제목/내용/담당/상태 기록을 쌓는 메뉴 (CRUD)
//   card   — 외부 연동이 필요한 메뉴. 연동 전에는 담당·목적·다음 할 일 카드만 보여준다
//   system — 앱이 직접 그리는 화면 (팀관리·운영현황·설정)
// defaultWeek: 실행학교 커리큘럼에서 이 메뉴가 열리는 주차 (1~4). 사용자가 설정에서 바꿀 수 있다.

export const GROUPS = ['팀 운영', '응대와 소통', '비즈니스', '콘텐츠', '기록 / 시스템']

export const MENUS = [
  // 팀 운영
  { key: 'tasks', label: '업무현황', group: '팀 운영', kind: 'record', defaultWeek: 1, icon: 'LayoutList', purpose: '할 일과 에이전트에게 맡긴 작업을 칸반으로 봅니다.' },
  { key: 'proposals', label: '업무제안', group: '팀 운영', kind: 'record', defaultWeek: 1, icon: 'Sparkles', purpose: '에이전트가 먼저 제안한 일을 검토하고 결정합니다.' },
  { key: 'agents', label: '팀관리', group: '팀 운영', kind: 'system', defaultWeek: 1, icon: 'Users', purpose: '내 팀(직원)과 담당 메뉴, OpenClaw 등록 상태를 봅니다.' },
  { key: 'operations', label: '운영현황', group: '팀 운영', kind: 'system', defaultWeek: 1, icon: 'Activity', purpose: 'OpenClaw 상태와 자동화를 읽기 전용으로 확인합니다.' },
  { key: 'sessions', label: '세션관제', group: '팀 운영', kind: 'card', defaultWeek: 2, icon: 'Radio', purpose: '에이전트 대화 세션을 모니터링합니다.' },
  { key: 'console', label: 'AI OS 관제실', group: '팀 운영', kind: 'card', defaultWeek: 4, icon: 'Gauge', purpose: '하루 운영 사이클 전체를 한 화면에서 봅니다.' },
  // 응대와 소통
  { key: 'bizkakao', label: '비즈카톡', group: '응대와 소통', kind: 'card', defaultWeek: 2, icon: 'MessageSquare', purpose: '카카오 비즈니스 채널 문의를 받고 답합니다.' },
  { key: 'kakao', label: '카톡관리', group: '응대와 소통', kind: 'card', defaultWeek: 2, icon: 'MessageCircle', purpose: '개인 카톡방 요약·응대 초안을 관리합니다.' },
  { key: 'email', label: '이메일', group: '응대와 소통', kind: 'record', defaultWeek: 1, icon: 'Inbox', purpose: '중요한 메일의 처리 메모를 남깁니다. 메일함 자동 동기화는 별도 연동입니다.' },
  { key: 'calls', label: '전화하기', group: '응대와 소통', kind: 'record', defaultWeek: 2, icon: 'Phone', purpose: '걸어야 할 전화와 통화 기록을 정리합니다.' },
  { key: 'contacts', label: '인맥관리', group: '응대와 소통', kind: 'record', defaultWeek: 1, icon: 'Users', purpose: '사람과의 관계와 다음 연락을 기억합니다.' },
  { key: 'post', label: '우체국', group: '응대와 소통', kind: 'record', defaultWeek: 2, icon: 'Mailbox', purpose: '발송할 우편·택배·선물을 추적합니다.' },
  { key: 'meetingroom', label: '회의실', group: '응대와 소통', kind: 'card', defaultWeek: 2, icon: 'Presentation', purpose: '에이전트들과 회의를 열고 결론을 기록합니다.' },
  { key: 'dispatch', label: '특별 발송반', group: '응대와 소통', kind: 'card', defaultWeek: 3, icon: 'Send', purpose: '승인된 대량 발송을 실행하고 결과를 봅니다. 개인정보 주의.' },
  // 비즈니스
  { key: 'orders', label: '주문관리', group: '비즈니스', kind: 'record', defaultWeek: 4, icon: 'ShoppingCart', purpose: '주문·배송·CS를 한 줄씩 관리합니다.' },
  { key: 'coupang', label: '쿠팡 주문', group: '비즈니스', kind: 'card', defaultWeek: 4, icon: 'Package', purpose: '쿠팡 주문을 가져와 처리합니다.' },
  { key: 'sourcing', label: '쇼핑몰 매물조사', group: '비즈니스', kind: 'record', defaultWeek: 4, icon: 'Search', purpose: '도매 상품 후보와 마진 계산을 정리합니다.' },
  { key: 'school', label: '실행학교', group: '비즈니스', kind: 'card', defaultWeek: 4, icon: 'GraduationCap', purpose: '수강생·기수 운영 현황을 봅니다.' },
  { key: 'coupons', label: '쿠폰관리', group: '비즈니스', kind: 'record', defaultWeek: 4, icon: 'Ticket', purpose: '발행한 쿠폰과 사용 현황을 기록합니다.' },
  { key: 'projects', label: '프로젝트 허브', group: '비즈니스', kind: 'record', defaultWeek: 1, icon: 'FolderKanban', purpose: '여러 작업을 묶는 프로젝트 단위로 진행을 봅니다.' },
  { key: 'youtube', label: '유튜브', group: '비즈니스', kind: 'card', defaultWeek: 3, icon: 'Youtube', purpose: '채널 지표와 영상 아이디어를 관리합니다.' },
  // 콘텐츠
  { key: 'ideas', label: '글감실', group: '콘텐츠', kind: 'record', defaultWeek: 1, icon: 'Lightbulb', purpose: '생각·회고·꼬리 질문의 답을 모아 글감으로 키웁니다.' },
  { key: 'news', label: '최신정보', group: '콘텐츠', kind: 'record', defaultWeek: 3, icon: 'Newspaper', purpose: '에이전트가 모아온 뉴스 브리핑을 읽습니다.' },
  { key: 'landing', label: '랜딩페이지', group: '콘텐츠', kind: 'record', defaultWeek: 3, icon: 'Globe', purpose: '랜딩·블로그 발행물과 링크를 관리합니다.' },
  // 기록 / 시스템
  { key: 'meetings', label: '미팅기록', group: '기록 / 시스템', kind: 'record', defaultWeek: 1, icon: 'BookOpen', purpose: '회의 요약과 전사 원문, 후속 작업을 보관합니다.' },
  { key: 'notes', label: '나의 메모', group: '기록 / 시스템', kind: 'record', defaultWeek: 1, icon: 'FileText', purpose: '생각과 독백을 남기고 다시 찾습니다.' },
  { key: 'plaud', label: 'Plaud 분류 검토', group: '기록 / 시스템', kind: 'card', defaultWeek: 4, icon: 'Mic', purpose: '녹음 전사를 분류하고 검토합니다.' },
  { key: 'books', label: '읽은 책', group: '기록 / 시스템', kind: 'record', defaultWeek: 1, icon: 'Library', purpose: '읽은 책과 한 줄 배움을 기록합니다.' },
  { key: 'notebooks', label: '노트북LM', group: '기록 / 시스템', kind: 'record', defaultWeek: 1, icon: 'NotebookTabs', purpose: '내 NotebookLM 노트북 링크를 정리합니다.' },
  { key: 'settings', label: '설정', group: '기록 / 시스템', kind: 'system', defaultWeek: 1, icon: 'Settings', purpose: '이름·즐겨찾기·메뉴 순서·동기화를 설정합니다.' },
]

export const MENU_BY_KEY = Object.fromEntries(MENUS.map(menu => [menu.key, menu]))
export const RECORD_KEYS = MENUS.filter(menu => menu.kind === 'record').map(menu => menu.key)
export const DEFAULT_MENU_KEYS = ['tasks', 'agents', 'email', 'ideas', 'notes', 'settings']
export const DEFAULT_FAVORITES = ['tasks', 'agents', 'email', 'ideas', 'notes', 'settings']

// 메뉴별 기록 폼 필드 (record 메뉴만)
export const RECORD_FIELDS = {
  tasks: ['title', 'body', 'agent', 'dueAt', 'status'],
  proposals: ['title', 'body', 'agent', 'status'],
  email: ['title', 'body', 'person', 'status'],
  calls: ['title', 'person', 'body', 'dueAt', 'status'],
  contacts: ['title', 'person', 'body', 'dueAt'],
  post: ['title', 'person', 'body', 'dueAt', 'status'],
  orders: ['title', 'person', 'body', 'date', 'status'],
  sourcing: ['title', 'body', 'link', 'status'],
  coupons: ['title', 'body', 'date', 'status'],
  projects: ['title', 'body', 'agent', 'dueAt', 'status'],
  ideas: ['title', 'body', 'date'],
  news: ['title', 'summary', 'link', 'date'],
  landing: ['title', 'link', 'body', 'status'],
  meetings: ['title', 'date', 'summary', 'body', 'person'],
  notes: ['title', 'body', 'date'],
  books: ['title', 'person', 'body', 'date'],
  notebooks: ['title', 'link', 'body'],
}

export const STATUS_MENUS = Object.entries(RECORD_FIELDS).filter(([, fields]) => fields.includes('status')).map(([key]) => key)

export function isValidMenuKey(key) {
  return typeof key === 'string' && Object.hasOwn(MENU_BY_KEY, key)
}

// ---- v0.3 개인화: 내 업무(커스텀 메뉴) · 테마 · 위젯 ----
// 커스텀 메뉴는 업무 지도(my-work-map.md)에서 나온 "그 사람만의" 기록형 메뉴다. 화면은 기록형/칸반을 재사용하고,
// 필드는 아래 FIELD_TYPES 안에서 고르되 이름(fieldLabels)은 마음대로 바꾼다 (예: person → "고객명").
export const CUSTOM_GROUP = '내 업무'
export const CUSTOM_KEY = /^c-[a-z0-9-]{1,30}$/
export const MAX_CUSTOM_MENUS = 6
export const STATUS_KEYS = ['open', 'working', 'waiting', 'done', 'rejected']
export const FIELD_TYPES = ['title', 'body', 'summary', 'person', 'agent', 'date', 'dueAt', 'link', 'status']
export const BUILTIN_ICONS = [...new Set(MENUS.map(menu => menu.icon))]
export const EXTRA_ICONS = ['Briefcase', 'Calendar', 'Camera', 'Coffee', 'Heart', 'Star', 'ShoppingBag', 'Truck', 'Wallet', 'Music', 'Dumbbell', 'Utensils', 'Scissors', 'PenTool', 'Flower2', 'Gift', 'Palette', 'Receipt', 'ClipboardList', 'Target', 'Megaphone', 'Stethoscope', 'Wrench', 'Plane', 'Dog', 'Home', 'Car', 'Leaf', 'Smile', 'Store', 'Handshake', 'PiggyBank', 'Clapperboard', 'Sprout', 'Hammer']
export const ICON_NAMES = [...BUILTIN_ICONS, ...EXTRA_ICONS]

export const THEME_PRESETS = {
  olive: { label: '올리브', note: '차분한 종이 느낌 (기본)', swatch: ['#f7f5ef', '#63704d', '#c76d5a'] },
  ocean: { label: '바다', note: '맑고 시원한 파랑', swatch: ['#f3f6f8', '#2f6f9f', '#e07a5f'] },
  sunset: { label: '노을', note: '따뜻한 주황과 보라', swatch: ['#fbf4ee', '#c4562f', '#6a4c93'] },
  forest: { label: '숲', note: '짙은 초록과 호박색', swatch: ['#f1f4ef', '#2f6b45', '#d08c2f'] },
  mono: { label: '모노', note: '흑백, 군더더기 없이', swatch: ['#f6f6f6', '#222222', '#e5484d'] },
  midnight: { label: '미드나잇', note: '어두운 화면', swatch: ['#15171c', '#6f84f0', '#f0a35e'] },
}
export const MAX_WIDGET_HTML = 60000

function cleanText(value, limit) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, limit) : ''
}

// 잘못된 커스텀 메뉴는 조용히 버리지 않고 이유와 함께 거부한다 (VPS 쪽 스크립트가 먼저 같은 검사를 한다).
export function normalizeCustomMenus(input) {
  if (input === undefined || input === null) return []
  if (!Array.isArray(input)) throw new Error('customMenus must be an array')
  if (input.length > MAX_CUSTOM_MENUS) throw new Error(`customMenus: at most ${MAX_CUSTOM_MENUS} menus`)
  const seen = new Set()
  return input.map((raw, index) => {
    const at = `customMenus[${index}]`
    if (!raw || typeof raw !== 'object') throw new Error(`${at} must be an object`)
    const key = typeof raw.key === 'string' ? raw.key.trim() : ''
    if (!CUSTOM_KEY.test(key)) throw new Error(`${at}.key must look like c-bouquet (c- + lowercase letters/digits/-)`)
    if (seen.has(key)) throw new Error(`${at}.key duplicated: ${key}`)
    seen.add(key)
    const label = cleanText(raw.label, 20)
    if (!label) throw new Error(`${at}.label is required`)
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
    return { key, label, icon, purpose: cleanText(raw.purpose, 120), fields, fieldLabels, statusLabels, kanban: raw.kanban === true && fields.includes('status') }
  })
}

export function customMenuEntry(menu) {
  return { ...menu, group: CUSTOM_GROUP, kind: 'record', defaultWeek: 1, custom: true }
}

// 기본 30개 + 커스텀 메뉴를 합친 카탈로그. 화면은 MENU_BY_KEY 대신 이것을 쓴다.
export function menuCatalog(customMenus = []) {
  const custom = customMenus.map(customMenuEntry)
  const list = [...custom, ...MENUS.map(menu => menu.kind === 'record' ? { ...menu, fields: RECORD_FIELDS[menu.key] } : menu)]
  return { list, byKey: Object.fromEntries(list.map(menu => [menu.key, menu])), groups: custom.length ? [CUSTOM_GROUP, ...GROUPS] : GROUPS }
}

// 저장소 컬렉션 이름으로 쓸 수 있는가: 기본 기록형 메뉴 또는 c-* 커스텀 키.
export function isCollectionKey(key) {
  return typeof key === 'string' && (RECORD_KEYS.includes(key) || CUSTOM_KEY.test(key))
}

export function normalizeTheme(input) {
  const raw = input && typeof input === 'object' ? input : {}
  return {
    preset: Object.hasOwn(THEME_PRESETS, raw.preset) ? raw.preset : 'olive',
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
  return { title: cleanText(input.title, 40) || '나의 위젯', html }
}

// 짧은 내용 지문(FNV-1a). 브라우저에서도 돌아야 해서 node:crypto 를 쓰지 않는다.
export function fingerprint(value) {
  const text = JSON.stringify(value ?? null)
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0 }
  return hash.toString(16).padStart(8, '0')
}
