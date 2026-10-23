# 동기화 계약 — VPS → PC inbox (file.write)

## 전송 방식

VPS 게이트웨이가 OpenClaw 내장 **file-transfer 플러그인**의 `file.write` 노드 명령으로, 페어링된 PC 노드의 `<inbox>/` 폴더에 파일 3개를 쓴다. PC 대시보드 앱은 `.data/inbox/manifest.json` 의 `version` 이 바뀌면 30초 안에 자동 반영한다.

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
`menus[].key` 는 menu-tree 의 키(모르는 키는 PC 가 거부). `owner` 는 에이전트 ID 또는 빈 문자열. `enabledFromWeek` 생략 시 기본 주차.

### seed.json
```json
{ "version": 1,
  "records": { "tasks": [ { "title": "입장 현황 확인", "body": "…원문…", "status": "open", "agent": "mira", "source": "hia-state", "sourceId": "next:3f2a…" } ] },
  "agents": [ { "id": "mira", "name": "미라", "emoji": "🧭", "sessionsCount": 3, "lastUpdatedAt": "2026-10-23T09:00:00Z" } ] }
```
기록은 **`source` + `sourceId` 필수**(중복 방지 키). `status` 는 `open | working | waiting | done | rejected`.

### pc.json (VPS 전용, 전송 대상 기억)
```json
{ "nodeId": "c303…", "nodeName": "홍길동 PC", "inbox": "C:/Users/hong/Documents/openclaw-personal-dashboard/.data/inbox", "savedAt": "…" }
```

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
| 동기화는 되는데 칸반이 빔 | STATE.md 섹션 | `manifest.reasons` 확인 |

**대체 경로:** VPS 의 `dashboard/seed.json`(필요하면 `config.json`)을 PC 대시보드 **설정 > JSON 가져오기** 에 붙여넣는다. 같은 병합 규칙이 적용된다.
