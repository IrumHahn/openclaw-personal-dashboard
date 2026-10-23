# 동기화 계약 — VPS 캔버스 폴더 ↔ PC 대시보드

## 파일 (VPS `~/.openclaw/workspace/canvas/dashboard/`)

### manifest.json
```json
{ "version": "c44c5a714d0084f6", "generatedAt": "2026-10-23T09:43:00.000Z", "generator": "dashboard-builder/0.2",
  "counts": { "menus": 9, "agents": 3, "tasks": 12, "registeredAgents": 2 },
  "reasons": ["team.json agent writer is not registered in openclaw — run agent-team-onboarding status"] }
```
`version` 은 config+seed 내용의 해시(16자). 같은 입력이면 같은 값. PC 는 이 값을 "동기화 버전"으로 보여준다.

### config.json
```json
{ "version": 1, "name": "사장님의 AI 오피스", "week": 1,
  "menus": [{ "key": "tasks", "owner": "mira" }, { "key": "agents", "owner": "mira" }, { "key": "email", "owner": "" }],
  "favorites": ["tasks", "agents", "email", "ideas", "notes", "settings"],
  "agents": [{ "id": "mira", "name": "미라", "emoji": "🧭", "role": "총괄 비서", "mission": "…", "coordinator": true, "menus": ["tasks", "agents"] }] }
```
- `menus[].key` 는 menu-tree 의 키. 모르는 키는 PC 가 거부한다.
- `owner` 는 에이전트 ID(소문자·숫자·하이픈) 또는 빈 문자열.
- `enabledFromWeek` 는 생략하면 menu-tree 기본 주차.

### seed.json
```json
{ "version": 1,
  "records": { "tasks": [ { "title": "입장 현황 확인", "body": "…원문…", "status": "open", "agent": "mira", "source": "hia-state", "sourceId": "next:3f2a…" } ] },
  "agents": [ { "id": "mira", "name": "미라", "emoji": "🧭", "sessionsCount": 3, "lastUpdatedAt": "2026-10-23T09:00:00Z" } ] }
```
- `records` 의 키는 기록형 메뉴 키. 각 기록은 **`source` + `sourceId` 가 필수**(중복 방지 키).
- `status` 는 `open | working | waiting | done | rejected`.
- `agents` 는 VPS `openclaw agents list --json` 요약(등록 여부 표시용).

## PC 쪽 병합 규칙 (`lib/merge.js`, `lib/sync.js`)

| 상황 | 결과 |
|---|---|
| 새 `source+sourceId` | 추가 (`localEdited: false`) |
| 같은 `source+sourceId`, 내용 변경 | 갱신. 단 사용자가 PC 에서 고친 기록(`localEdited: true`)의 `status` 는 보존 |
| seed 에서 사라진 기록 | **삭제하지 않음** |
| 모르는 메뉴 키·제목 없음·비밀값 패턴 | 건너뛰고 `skipped[]` 에 이유 |
| 원격 config | 메뉴·담당·직원·이름을 가져오되 **PC 의 메뉴 순서와 즐겨찾기는 유지**, 주차는 더 큰 쪽 |

## 전송 방식

PC 의 `/api/sync` 가 `OPENCLAW_SYNC_URL + {manifest,config,seed}.json` 을 `Authorization: Bearer <OPENCLAW_GATEWAY_TOKEN>` 으로 GET 한다. 게이트웨이의 캔버스 경로(`/__openclaw__/canvas/`)는 비루프백 바인드에서 Bearer 토큰 인증을 허용한다. 토큰은 PC 의 `.env.local` 에만 있고 브라우저로 가지 않는다.

## 막혔을 때

| 증상 | 원인 후보 | 확인 |
|---|---|---|
| 401/403 "토큰을 거부" | 토큰 오타, 다른 게이트웨이 토큰 | VPS: `openclaw config get gateway.auth.token` 과 `.env.local` 비교 (값을 채팅에 붙이지 말 것) |
| 404 | 파일이 없거나 canvasHost 꺼짐 | VPS: `ls ~/.openclaw/workspace/canvas/dashboard/`, `openclaw config get canvasHost` ; `OPENCLAW_SKIP_CANVAS_HOST` 환경변수 |
| 연결 실패/시간 초과 | 게이트웨이가 loopback 에만 바인드, Tailscale 끊김, 포트 다름 | PC: `tailscale status` 에 VPS 보이는지, `curl -I http://<ip>:18789/` ; VPS: `openclaw config get gateway.bind` |
| 동기화는 되는데 칸반이 빔 | STATE.md 경로/섹션 | `manifest.reasons` 확인 (`## 다음 행동` 섹션 유무) |
| 직원이 "미등록" | 온보딩이 중간에 멈춤 | `team_setup.mjs status --plan …` |

**대체 경로:** VPS 의 `seed.json`(필요하면 `config.json` 도)을 PC 대시보드 **설정 > JSON 가져오기** 에 붙여넣는다. 동일한 병합 규칙이 적용된다.
