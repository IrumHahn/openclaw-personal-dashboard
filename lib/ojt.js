// 수습(OJT) — AI 직원에게 업무 1개를 인수인계하고, 대표가 보고마다 채점한다.
// 이 파일은 계산만 한다(화면·서버 공용). 파일 쓰기는 lib/ojt-outbox.js.
//
// 기록은 'ojt' 컬렉션 하나에 두 종류가 섞여 들어온다(VPS 의 job-handoff / dashboard-builder 가 seed 로 보낸다).
//   kind 'job'    : 업무 카드. title=업무명, job=업무 id, agent=담당 직원, level=L0~L4, lesson=최근 배운 것
//   kind 'report' : 보고 1건. title·body·date, job=업무 id, agent, gradeAck=비서가 반영한 채점 시각
// 채점(grade·gradeNote·gradedAt)은 PC 에서만 쓴다. seed 는 이 값을 덮어쓰지 못한다(lib/merge.js).

export const GRADES = {
  good: { emoji: '👍', label: '좋아요', needsNote: false },
  fix: { emoji: '✏️', label: '고칠 점', needsNote: true },
  bad: { emoji: '❌', label: '틀렸어요', needsNote: true },
}
export const LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4']
export const LEVEL_NAMES = { L0: '견습', L1: '따라하기', L2: '같이 하기', L3: '혼자 하기', L4: '가르치기' }
export const STREAK_GOAL = 5
const NO_JOB = '_'

// 채점 입력 검사 → 기록에 덮어쓸 값. ✏️·❌는 한 줄 이유가 꼭 있어야 비서가 고칠 수 있다.
export function gradePatch(input, now = new Date().toISOString()) {
  const grade = typeof input?.grade === 'string' ? input.grade : ''
  if (!GRADES[grade]) throw new Error('grade must be good | fix | bad')
  const note = typeof input?.note === 'string' ? input.note.trim().replace(/\s+/g, ' ').slice(0, 500) : ''
  if (GRADES[grade].needsNote && !note) throw new Error(`${GRADES[grade].emoji} 는 한 줄 이유가 필요합니다`)
  return { grade, gradeNote: note, gradedAt: now }
}

function byNewest(a, b) {
  const da = a.date || a.createdAt || ''
  const db = b.date || b.createdAt || ''
  if (da !== db) return da < db ? 1 : -1
  return (a.createdAt || '') < (b.createdAt || '') ? 1 : -1
}

// 최근 채점부터 거꾸로 세어 연속 👍 개수. ✏️ 나 ❌ 를 만나면 멈춘다. 아직 채점 안 한 보고는 건너뛴다.
export function streakOf(reports) {
  let count = 0
  for (const report of [...reports].sort(byNewest)) {
    if (!report.grade) continue
    if (report.grade !== 'good') break
    count += 1
  }
  return count
}

// 비서에게 아직 전달되지 않은 채점: 채점했는데 비서가 반영했다고 알려 온 시각(gradeAck)과 다르다.
export function isPending(report) {
  return Boolean(report.grade && report.gradedAt && report.gradeAck !== report.gradedAt)
}

// 화면용: 업무별로 묶는다. 업무 카드가 없는 보고는 job 값(또는 '기타')으로 묶는다.
export function ojtBoard(records = []) {
  const jobs = new Map()
  const ensure = id => {
    if (!jobs.has(id)) jobs.set(id, { id, card: null, reports: [] })
    return jobs.get(id)
  }
  for (const record of records) {
    const id = record.job || NO_JOB
    if (record.kind === 'job') ensure(id).card = record
    else ensure(id).reports.push(record)
  }
  return [...jobs.values()].map(entry => {
    const reports = entry.reports.sort(byNewest)
    const level = LEVELS.includes(entry.card?.level) ? entry.card.level : null
    return {
      id: entry.id,
      title: entry.card?.title || (entry.id === NO_JOB ? '업무 미지정 보고' : entry.id),
      agent: entry.card?.agent || reports.find(r => r.agent)?.agent || '',
      level,
      levelName: level ? LEVEL_NAMES[level] : '',
      lesson: entry.card?.lesson || '',
      summary: entry.card?.summary || entry.card?.body || '',
      reports,
      streak: streakOf(reports),
      ungraded: reports.filter(r => !r.grade).length,
      pending: reports.filter(isPending).length,
    }
  // 순서는 업무 이름으로 고정한다(채점하는 도중에 카드가 자리를 바꾸면 헷갈린다). 업무 미지정 보고는 맨 아래.
  }).sort((a, b) => (a.id === NO_JOB) - (b.id === NO_JOB) || a.title.localeCompare(b.title, 'ko'))
}

// PC → VPS 로 돌려보내는 파일(grades.json). 비서는 pending 만 처리하고, 처리한 보고의 gradeAck 를 gradedAt 으로 맞춰 다시 보낸다.
export function gradesPayload(records = [], now = new Date().toISOString()) {
  const pending = records.filter(r => r.kind !== 'job' && isPending(r)).sort(byNewest).map(r => ({
    source: r.source || '', sourceId: r.sourceId || '', id: r.id, job: r.job || '', agent: r.agent || '',
    title: r.title, date: r.date || '', grade: r.grade, emoji: GRADES[r.grade]?.emoji || '', note: r.gradeNote || '', gradedAt: r.gradedAt,
  }))
  return { version: 1, kind: 'ojt-grades', generatedAt: now, pending }
}

// 텔레그램으로 총괄에게 붙여 넣는 한 줄(PC 허용 창을 못 누를 때의 대체 경로).
export function gradeMessage(report, jobTitle = '') {
  const g = GRADES[report.grade]
  if (!g) return ''
  const where = [jobTitle || report.job, report.date, report.title].filter(Boolean).join(' · ')
  return `[채점] ${where} → ${g.emoji}${report.gradeNote ? ` ${report.gradeNote}` : ''} (id ${report.sourceId || report.id})`
}
