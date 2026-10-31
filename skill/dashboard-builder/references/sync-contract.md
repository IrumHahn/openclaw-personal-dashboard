# 동기화 계약 — VPS → PC inbox

## 전송 방식 두 가지

PC inbox 는 기본 **`문서\openclaw-dashboard\inbox`**(앱 `.env.local` 의 `DASHBOARD_INBOX_DIR`, 비우면 앱 폴더 `.data/inbox`). 앱은 `manifest.json` **또는** `manifest.b64` 의 `version` 이 바뀌면 30초 안에 자동 반영한다(둘 다 있으면 더 최근 것).

### A. `file` — 헤드리스 노드(`openclaw node run`)

VPS 게이트웨이가 OpenClaw 내장 **file-transfer 플러그인**의 `file.write` 노드 명령으로, 페어링된 PC 노드의 `<inbox>/` 폴더에 파일 3개를 쓴다.

| 단계 | 어디서 | 무엇 |
|---|---|---|
| 플러그인 | VPS | `plugins.allow += file-transfer`, `plugins.entries.file-transfer.enabled = true`, `…config.policyVersion = 2` |
| 노드 정책 | VPS | `…config.nodes.<nodeId> = { ask: "off", allowWritePaths: ["<inbox>/**"], allowReadPaths: ["<inbox>/**"] }` |
| 명령 허용 | VPS | `gateway.nodes.commands.allow += file.write, file.stat, file.create` |
| 노드 승인 | VPS(사람) | 페어링 승인(`devices approve`)과 별개로 **기능 승인** `openclaw nodes approve <requestId>` — 노드가 연결될 때 Pending 으로 뜬다 |
| 전송 | VPS | `openclaw nodes invoke --node <id> --command file.write --params '{"path":"<inbox>/seed.json","contentBase64":"…","overwrite":true,"createParents":true,"expectedSha256":"…"}'` |
| 반영 | PC | 앱 `GET /api/sync` 가 inbox 를 30초마다 확인, 새 version 이면 `POST /api/sync` 로 병합 |

모두 `openclaw config patch` 로 적용되며 게이트웨이 재시작이 필요 없다(2026.10.3 확인). 경로 규칙: **절대경로**, 패턴은 glob `**`. macOS 는 `/tmp` 가 심볼릭링크라 `/private/tmp/...` 실제 경로를 쓴다. Windows 는 `C:/Users/.../.data/inbox` 처럼 슬래시로 정규화한다(스크립트가 한다). 최대 16 MB.

보안: 정책이 `<inbox>/**` 만 허용하므로 에이전트가 PC 의 다른 곳에는 쓸 수 없다. inbox 파일은 로컬 전용이며 토큰을 담지 않는다(스크립트가 검사).

### B. `hub` — Windows Hub 앱 노드(OpenClaw Companion, 수강생 기본)

Hub 노드의 commands 는 `system.run`·`screen.snapshot` 등이고 **`file.write` 가 없다.** `system.run` 은 CLI `nodes invoke` 로 못 부르고(`reserved for shell execution; use the exec tool with host=node`) **에이전트의 exec 도구만** 쓸 수 있다. 그래서:

| 단계 | 어디서 | 무엇 |
|---|---|---|
| PC 준비(한 번) | PC(사람) | Hub 앱 Settings > **Sandbox = Recommended, Documents = Read + write**. 기본 Locked Down 은 어떤 파일도 못 쓴다 |
| 승인(한 번) | VPS(사람) | `devices approve` + `nodes approve`. Hub 앱 Permissions 에서 "Windows node" On |
| 설정 | VPS | `setup_transfer.mjs --transport hub --inbox "%USERPROFILE%\Documents\openclaw-dashboard\inbox"` → pc.json 만 저장(게이트웨이 설정 변경 없음) |
| 명령 생성 | VPS | `send_to_pc.mjs` → 파일 3개를 base64 → ≤6000자 청크 → 조각 `echo <청크> >"<inbox>\<name>.b64"`(첫 청크) / `>>`(이후), 맨 앞 `(if not exist … mkdir …)`, 맨 뒤 `type manifest.b64` → 조각들을 `&&` 로 이어 **한 줄 ≤7600자** 로 묶는다(`cmd /c …`). 보통 명령 1~2개 |
| 실행 | VPS 에이전트 | exec(host=node) 로 commands 를 순서대로. 명령마다 PC 에 **허용 창(Allow Once / Deny)** — "항상 허용" 없음. 허용 목록은 원격(`approvals allowlist add --node`)으로 못 바꾼다(`Remote exec approval updates cannot add…`); PC 의 `%APPDATA%\OpenClawTray\exec-approvals.json` 기본은 `security: allowlist, ask: on-miss, askFallback: deny` |
| 반영 | PC | 앱이 `.b64` 의 공백·CRLF 를 걷어내고 디코드 → JSON. 디코드 실패(전송 중) 파일이 하나라도 있으면 `problems` 로 표시하고 기다린다 |

왜 되나: 샌드박스(AppContainer)는 **외부 .exe 실행**(powershell, whoami …→ `0xC0000142`)을 막지만 **cmd 내장 명령**(echo, type, 리다이렉션)과 Documents 쓰기는 허용한다. base64 는 `A-Z a-z 0-9 + / =` 뿐이라 cmd 특수문자 문제가 없다. `>` 앞에 공백을 두는 이유는 청크가 숫자로 끝날 때 `…1>file` 이 핸들 리다이렉션으로 읽히는 것을 피하기 위해서다(공백은 디코드 때 제거). 한 줄은 8191자 제한이라 청크 ≤ 6000.

한계: Hub 는 종료코드를 돌려주지 않는다 → 마지막 `type` 출력으로 확인. 에이전트가 명령을 요약·축약하면 깨진다 → "글자 하나 바꾸지 말고" 지시가 필수. 실측: 7,112B JSON(한글·특수문자) 2청크 → PC 디코드 후 sha256 일치; 대시보드 3파일(4KB) → `.b64` 3개 → 앱이 `format: b64` 로 읽고 병합 성공(2026-10-24, Windows 365 Cloud PC, Hub core 2026.9.8-1).

## 파일 (VPS `~/.openclaw/workspace/dashboard/` → PC `<app>/.data/inbox/`)

### manifest.json
```json
{ "version": "c44c5a714d0084f6", "generatedAt": "2026-10-23T09:43:00.000Z", "generator": "dashboard-builder/0.2",
  "counts": { "menus": 9, "agents": 3, "tasks": 12, "registeredAgents": 2 },
  "reasons": ["team.json agent writer is not registered in openclaw — run agent-team-onboarding status"] }
```
`version` = config+seed 내용 해시(16자). 같은 입력이면 같은 값. PC 는 이 값이 바뀔 때만 반영하고 "동기화 버전"으로 보여준다. 전송 순서는 seed → config → manifest(마지막).

### config.json
```json
{ "version": 1, "name": "사장님의 AI 오피스", "week": 1,
  "menus": [{ "key": "tasks", "owner": "mira" }, { "key": "agents", "owner": "mira" }, { "key": "email", "owner": "" }],
  "favorites": ["tasks", "agents", "email", "ideas", "notes", "settings"],
  "agents": [{ "id": "mira", "name": "미라", "emoji": "🧭", "role": "총괄 비서", "mission": "…", "coordinator": true, "menus": ["tasks", "agents"] }] }
```
`menus[].key` 는 menu-tree 의 키 또는 `customMenus` 에 정의한 `c-*` 키(모르는 키는 PC 가 거부). `owner` 는 에이전트 ID 또는 빈 문자열. `enabledFromWeek` 생략 시 기본 주차.

v0.3 개인화 필드(생략 가능, `references/personalize.md`·`widget-guide.md`):
```json
{ "customMenus": [{ "key": "c-bouquet", "label": "예약 꽃다발", "icon": "Flower2", "purpose": "…", "fields": ["title", "person", "dueAt", "body", "status"],
                    "fieldLabels": { "person": "고객명" }, "statusLabels": { "open": "주문 접수" }, "kanban": true }],
  "theme": { "preset": "sunset", "accent": "", "emoji": "💐", "tagline": "꽃이 늦지 않게" },
  "widget": { "title": "이번 주 꽃다발 레이더", "html": "<!doctype html>…" } }
```
- 커스텀 메뉴의 기록은 seed `records["c-bouquet"]` 로 보낸다. PC 는 `c-*` 컬렉션을 처음 받을 때 만든다.
- PC 반영 규칙: `customMenus` 는 VPS 값으로 교체(빠진 메뉴는 PC 메뉴·즐겨찾기에서도 빠짐). `theme`·`widget`·`favorites` 는 PC 설정에서도 고칠 수 있으므로 **VPS 값이 지난번 받은 것과 달라졌을 때만** 덮어쓴다(지문은 PC config `sync.remote`). 첫 동기화에서는 PC 값이 기본값일 때만 받는다.
- 위젯은 PC 에서 `sandbox="allow-scripts"` iframe + CSP(`default-src 'none'`, 인라인 스크립트·스타일과 `data:` 이미지만)로 열린다. 앱 화면·API·저장소·외부 인터넷에 접근할 수 없고, 데이터는 앱이 `postMessage({ type: 'dashboard:data' })` 로 넣는다.

### seed.json
```json
{ "version": 1,
  "records": { "tasks": [ { "title": "입장 현황 확인", "body": "…원문…", "status": "open", "agent": "mira", "source": "hia-state", "sourceId": "next:3f2a…" } ] },
  "agents": [ { "id": "mira", "name": "미라", "emoji": "🧭", "sessionsCount": 3, "lastUpdatedAt": "2026-10-23T09:00:00Z" } ] }
```
기록은 **`source` + `sourceId` 필수**(중복 방지 키). `status` 는 `open | working | waiting | done | rejected`.

### pc.json (VPS 전용, 전송 대상 기억)
```json
{ "transport": "file", "nodeId": "c303…", "nodeName": "홍길동 PC", "inbox": "C:/Users/hong/Documents/openclaw-dashboard/inbox", "savedAt": "…" }
{ "transport": "hub",  "nodeId": "c33d…", "nodeName": "Windows Node (PC-이름)", "inbox": "%USERPROFILE%\\Documents\\openclaw-dashboard\\inbox", "savedAt": "…" }
```
`transport` 가 없으면 `file`. `hub` 의 inbox 는 Windows 경로(역슬래시)이며 `%VAR%` 를 PC 의 cmd 가 푼다.

## 수습(ojt) 기록과 채점 되돌림 (v0.5)

seed `records.ojt` 에 두 종류가 들어간다(`scripts/ojt.mjs` 가 `<out>/ojt.json` 장부에서 만든다. 보고는 최근 30건만).

```json
{ "kind": "job", "title": "쿠팡 광고 일지", "job": "ad-log", "agent": "ana", "level": "L1", "lesson": "11/8 ROAS 에 VAT 포함", "summary": "…", "source": "job-handoff", "sourceId": "job:ad-log" }
{ "kind": "report", "title": "11/9 광고 일지", "body": "…", "date": "2026-11-09", "job": "ad-log", "agent": "ana", "gradeAck": "<비서가 반영한 채점의 gradedAt>", "source": "job-handoff", "sourceId": "report:ad-log:1109" }
```

- 채점(`grade` good|fix|bad · `gradeNote` · `gradedAt`)은 **PC 에서만** 생긴다. seed 에 넣어도 무시된다(병합이 덮어쓰지 않음).
- PC 는 채점할 때마다, 그리고 동기화 반영 뒤마다 inbox 에 **`grades.json` + `grades.b64`**(같은 내용, b64 는 ASCII)를 다시 쓴다. `pending` = `gradeAck ≠ gradedAt` 인 보고.
  ```json
  { "version": 1, "kind": "ojt-grades", "generatedAt": "…", "pending": [ { "sourceId": "report:ad-log:1109", "job": "ad-log", "agent": "ana", "title": "11/9 광고 일지", "date": "2026-11-09", "grade": "fix", "emoji": "✏️", "note": "광고비는 VAT 빼고", "gradedAt": "…" } ] }
  ```
- 읽는 길: file 노드 = `file.fetch { path: "<inbox>/grades.json" }`(정책 `allowReadPaths` 는 이미 `<inbox>/**`, 명령 허용에 `file.fetch` 추가) · hub 노드 = 전송 명령 끝의 `echo ===OJT-GRADES-BEGIN=== && (if exist …grades.b64 (type …) else (echo NO-GRADES)) && echo ===OJT-GRADES-END===` (허용 창 추가 없음).
- 반영 알림: 비서가 `ojt.mjs ack` → 다음 seed 의 해당 보고에 `gradeAck = gradedAt` → PC 가 "반영됨 ✓", pending 에서 빠짐.
- ⚠ 실증 전(2026-10-31): `file.fetch` 파라미터 이름(`path`)과 Windows Hub 의 `if exist … type` 출력은 로컬 모의 테스트로만 확인했다. 실제 노드에서 한 번 확인할 것.

## PC 쪽 병합 규칙 (`lib/merge.js`, `lib/sync.js`)

| 상황 | 결과 |
|---|---|
| 새 `source+sourceId` | 추가 (`localEdited: false`) |
| 같은 키, 내용 변경 | 갱신. 단 PC 에서 고친 기록(`localEdited: true`)의 `status` 보존 |
| seed 에서 사라진 기록 | **삭제하지 않음** |
| 모르는 메뉴 키·제목 없음·비밀값 패턴 | 건너뛰고 `skipped[]` |
| 원격 config | 메뉴·담당·직원·이름을 가져오되 **PC 의 메뉴 순서와 즐겨찾기 유지**, 주차는 더 큰 쪽 |
| 같은 version 재전송 | 무시(`unchanged`). 설정 > [지금 반영] 은 강제 반영 |

## 막혔을 때

| 증상 (send_to_pc 오류) | 원인 | 확인 |
|---|---|---|
| `node not found` / `connected: false` | PC 노드가 꺼져 있음 | PC: OpenClaw 노드 실행 중인지(`openclaw node run …`). VPS: `openclaw nodes list` |
| `awaiting operator approval` / Pending | 기능 승인 안 함 | VPS: `openclaw nodes approve <requestId>` (사람) |
| `not in the allowlist for platform` | 명령 허용 누락 | `setup_transfer.mjs` 재실행 → `gateway.nodes.commands.allow` 확인 |
| `does not support "file.write"` | 노드가 기능을 광고하지 않음/재승인 필요 | 노드 재시작 후 Pending 재승인. 노드 버전 2026.10+ |
| `POLICY_MIGRATION_REQUIRED` | policyVersion 누락 | `setup_transfer.mjs` 재실행(policyVersion 2) |
| `POLICY_DENIED: path does not match` | inbox 경로와 정책 패턴 불일치 | 설정 화면의 inbox 경로를 그대로 다시 `--inbox` 로. macOS 는 `/private/tmp` 실제 경로 |
| `PARENT_NOT_FOUND` | inbox 상위 폴더 없음 | 앱을 한 번 실행하면 `.data/` 생성. `createParents` 는 켜져 있음 |
| 전송은 OK 인데 화면 그대로 | version 동일 또는 앱 미실행 | 설정 > [지금 반영], 앱이 켜져 있는지 |
| (hub) `exec-approvals-v2: UserDenied` | PC 허용 창 거부/시간초과(사용자가 자리에 없음) | PC 화면에서 Allow Once 후 같은 명령부터 재실행 |
| (hub) `-1073741502` / `0xC0000142` | 외부 .exe 가 샌드박스에서 막힘 | 스크립트가 만든 cmd 명령만 사용(powershell 금지) |
| (hub) 파일이 안 생김, 오류도 없음 | Sandbox Locked Down 또는 Documents 쓰기 꺼짐 | Hub Settings > Sandbox Recommended + Documents Read+write |
| (hub) 앱 "일부 파일이 깨졌습니다" | 청크 누락/축약, 전송 중 | 해당 파일 명령을 첫 줄(`>`)부터 다시 실행 |
| (hub) `system.run is reserved…` | CLI 로 직접 부름 | 스크립트가 아니라 에이전트 exec 도구로 실행 |
| 동기화는 되는데 칸반이 빔 | STATE.md 섹션 | `manifest.reasons` 확인 |

**대체 경로:** VPS 의 `dashboard/seed.json`(필요하면 `config.json`)을 PC 대시보드 **설정 > JSON 가져오기** 에 붙여넣는다. 같은 병합 규칙이 적용된다.
