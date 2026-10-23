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
