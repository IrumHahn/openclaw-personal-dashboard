# 나의 위젯 — 홈 상단의 나만의 화면 한 장

대시보드 홈에는 **위젯 칸**이 하나 있다. 사용자가 비서와 함께 만든 HTML 한 장이 들어간다. 메뉴와 테마가 "고르는" 개인화라면, 위젯은 "만드는" 개인화다. 1주차 목요일 발표의 주인공이다.

```
사용자: "내 대시보드 위젯 만들어줘"
  → 에이전트: 무엇을 한눈에 보고 싶은지 묻기 → widget.html 작성 → 미리보기 설명 → 확인
  → build_dashboard.mjs --widget widget.html --widget-title "…" → send_to_pc.mjs
```

## 1. 무엇을 보여줄까 (인터뷰 2문항)

1. **"대시보드를 열었을 때 가장 먼저 알고 싶은 숫자나 사실 하나는?"** — 예: 이번 주 남은 주문 수, 오늘 마감, 이번 달 업로드 수
2. **"그걸 보고 바로 하고 싶은 행동은?"** — 위젯이 그 행동을 부르는 문장/강조로 끝나게 한다(예: "내일 픽업 2건 — 오늘 꽃 들여오기")

한 위젯 = 한 가지 질문에 답하는 화면. 차트 여러 개를 늘어놓지 않는다.

## 2. 규칙 (지키지 않으면 PC 에서 빈 칸이 된다)

| 규칙 | 이유 |
|---|---|
| HTML 파일 하나, **CSS·JS 전부 인라인** | 위젯은 격리 화면(sandbox)에서 열리고 외부 통신이 막혀 있다 |
| 외부 `<script src=http…>`·CDN 라이브러리·웹폰트·외부 이미지 금지 | CSP 가 막는다. 스크립트가 미리 검사해 거부한다. 차트는 인라인 SVG/CSS 로 그린다. 이미지는 `data:` URI 만 |
| `fetch`·API 호출 금지 | 막혀 있다. 데이터는 앱이 넣어 준다(아래) |
| 60,000자 이하, **가능하면 8,000자 안쪽** | config.json 에 실려 PC 로 간다. Windows Hub 앱 경로는 약 6,000자(base64)마다 명령이 하나씩 늘어 PC 허용 창도 늘어난다(꽃집 예시 4.5KB → 허용 창 3번). 보내기 전에 "허용 창 N번"을 미리 알린다 |
| 변수 이름에 `token`·`password`·`secret`·`api_key` 를 쓰지 않는다 | 비밀값 검사가 오탐해 빌드가 멈춘다(종료코드 3) |
| 사용자 기록을 HTML 에 직접 박지 않는다 | 데이터는 매번 앱에서 받아야 최신이다. 박아 두면 오래된 숫자가 남는다 |

## 3. 앱이 넣어 주는 데이터

```js
addEventListener('message', e => {
  if (e.data?.type === 'dashboard:data') render(e.data.data)
})
parent.postMessage({ type: 'dashboard:ready' }, '*')            // 준비됐으니 데이터 달라
// 그린 뒤 높이 맞추기(120~900px)
parent.postMessage({ type: 'dashboard:height', height: document.body.scrollHeight + 8 }, '*')
```

`data` 모양:

```js
{
  name: '꽃집 사장님의 AI 오피스', week: 1, tagline: '…', theme: 'sunset',
  colors: { bg, surface, raised, ink, muted, border, accent, pop },  // 현재 테마 색 — 위젯이 테마를 따라가게 쓴다
  menus: [{ key: 'c-bouquet', label: '예약 꽃다발', custom: true, kind: 'record', count: 5, open: 4, statusLabels: { open: '주문 접수', … } }, …],
  records: { 'c-bouquet': [{ title, status, agent, person, date, dueAt, updatedAt }], tasks: [...], … },  // 메뉴당 최근 100개, 본문(body)은 빠짐
  agents: [{ id, name, emoji, role }],
  sentAt: '2026-10-29T10:00:00.000Z'
}
```

- 기록이 바뀌면(동기화·사용자가 완료 처리) 앱이 다시 보낸다. `render` 는 여러 번 불려도 되게 짠다.
- 사용자 입력이 들어간 문자열을 `innerHTML` 로 넣을 때는 `&<>"` 를 이스케이프한다.
- 다크 테마(`midnight`)에서도 읽히게 글자색은 `colors.ink`·`colors.muted` 를 쓴다.

## 4. 만들고 보내기

```bash
node <skill-dir>/scripts/build_dashboard.mjs --widget ~/.openclaw/workspace/dashboard/widget.html --widget-title "이번 주 꽃다발 레이더"
node <skill-dir>/scripts/send_to_pc.mjs --pc ~/.openclaw/workspace/dashboard/pc.json
# 위젯 빼기: --widget none
```

- 제목은 위젯 위에 뜬다(40자). 기능명보다 **질문/약속**으로: "이번 주 꽃다발 레이더", "오늘 꼭 답할 협찬 문의".
- PC 에서 사용자가 설정 > 나의 위젯 에 HTML 을 붙여넣어 고칠 수도 있다(로컬 Codex 로 다듬기). VPS 쪽 위젯이 **새로 바뀔 때만** PC 것을 덮어쓴다.

## 5. 예시

`references/examples/flower-widget.html` — 꽃집. 예약 꽃다발 칸반의 상태별 막대 + 7일 안의 픽업·단골 기념일 목록, 내일까지는 강조색. 약 75줄.

아이디어(직군별):
- 유튜버: 이번 달 업로드 수 vs 목표, 다음 업로드까지 남은 날
- 컨설턴트: 이번 주 미팅 타임라인, 회신 안 한 제안서 수
- 강사: 다음 수업까지 D-day, 과제 제출률
- 공통: 직원별로 맡은 일 막대(누가 바쁜지), "오늘 내가 승인할 것" 목록
