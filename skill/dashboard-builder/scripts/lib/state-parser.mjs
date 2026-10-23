// HIA STATE.md → 칸반 항목.
//   "## 다음 행동" 아래 번호/불릿 항목            → open   (대기)
//   "- 진행 중 작업: ..." 줄 (없음/없다 제외)       → working (진행 중)
//   "## 현재 상태" 아래 "- 완료(...)" 로 시작하는 불릿 → done   (최근 10개)
// 파싱에 실패하면 항목을 만들지 않고 reasons 에 이유를 남긴다. 추측으로 채우지 않는다.
import { createHash } from 'node:crypto'

function sectionLines(markdown, heading) {
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex(line => line.trim().replace(/\s+/g, ' ').startsWith(`## ${heading}`))
  if (start < 0) return null
  const body = []
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break
    body.push(line)
  }
  return body
}

function bulletText(line) {
  const match = line.match(/^\s*(?:[-*]|\d+(?:-\d+)?\.)\s+(.*)$/)
  return match ? match[1].trim() : null
}

function stripMarkdown(text) {
  return text.replace(/\*\*/g, '').replace(/`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
}

function shortId(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 12)
}

function splitTitle(text) {
  // "완료(날짜): 본문" 같은 상태 접두어는 제목에서 뺀다. 본문(body)에는 원문을 그대로 남긴다.
  const clean = stripMarkdown(text)
  const stripped = clean.replace(/^(완료|검증 완료|사용자 확정|제안)\s*[(（][^)）]*[)）]\s*[:：]?\s*/, '')
  const cut = stripped.search(/\s[—–-]\s|[:：]\s|\.\s/)
  const title = (cut > 8 ? stripped.slice(0, cut) : stripped).slice(0, 120).trim()
  return { title: title || clean.slice(0, 120), body: clean }
}

export function parseState(markdown, options = {}) {
  const source = options.source || 'hia-state'
  const items = []
  const reasons = []
  if (typeof markdown !== 'string' || !markdown.trim()) return { items, reasons: ['STATE.md is empty'] }

  const next = sectionLines(markdown, '다음 행동')
  if (!next) reasons.push('no "## 다음 행동" section')
  else {
    let count = 0
    for (const line of next) {
      const text = bulletText(line)
      if (!text) continue
      const { title, body } = splitTitle(text)
      items.push({ title, body, status: 'open', source, sourceId: `next:${shortId(text)}` })
      count += 1
    }
    if (!count) reasons.push('"## 다음 행동" has no list items')
  }

  const working = markdown.split(/\r?\n/).map(line => line.match(/^\s*-\s*진행 중 작업\s*[:：]\s*(.+)$/)).find(Boolean)
  if (working) {
    const text = working[1].trim()
    if (!/^(없음|없다|없습니다|none)/i.test(text)) {
      const { title, body } = splitTitle(text)
      items.push({ title, body, status: 'working', source, sourceId: `working:${shortId(text)}` })
    }
  }

  const current = sectionLines(markdown, '현재 상태')
  if (current) {
    const done = []
    for (const line of current) {
      const text = bulletText(line)
      if (text && /^(완료|검증 완료|사용자 확정)[\s(（]/.test(stripMarkdown(text))) done.push(text)
    }
    for (const text of done.slice(0, 10)) {
      const { title, body } = splitTitle(text)
      items.push({ title, body, status: 'done', source, sourceId: `done:${shortId(text)}` })
    }
  } else reasons.push('no "## 현재 상태" section')

  return { items, reasons }
}
