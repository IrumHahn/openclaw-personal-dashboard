---
name: dashboard-builder
description: 팀 온보딩 결과(team.json)·HIA STATE.md·OpenClaw 에이전트 목록으로 사용자의 "내 AI 오피스" 대시보드 데이터(메뉴·담당 직원·칸반·즐겨찾기·주차)를 만들고, 페어링된 PC 노드로 보내(헤드리스 노드는 file.write, Windows Hub 앱 노드는 exec cmd echo) PC 화면에 반영되게 한다. "대시보드 만들어줘", "대시보드 업데이트해줘", "메뉴 추가해줘", "내 AI 오피스 만들어줘" 또는 "build my dashboard", "update the dashboard" 에 사용. 대시보드 앱 자체(Next.js)를 PC 에 설치·실행하는 스킬은 아니다.
---

# Dashboard Builder — 팀이 보이는 내 AI 오피스

이 스킬은 **데이터를 만들어 PC 로 보낸다.** 화면(앱)은 사용자의 PC 에서 `openclaw-personal-dashboard` 가 띄우고, 이 스킬이 만든 파일 3개를 PC 의 **inbox 폴더**(`문서\openclaw-dashboard\inbox`)에 넣는다. PC 앱은 30초 안에 자동 반영한다. PC 노드 종류에 따라 보내는 방법이 둘이다:

| PC 노드 | 어떻게 아나 | 전송(transport) |
|---|---|---|
| **Windows Hub 앱**(OpenClaw Companion, 수강생 기본) | `nodes list` 의 commands 에 `system.run` 만 있고 `file.write` 없음 | `hub` — 파일을 base64 로 바꿔 `cmd /c echo … >> <name>.b64` 명령 묶음을 만들고, **에이전트가 exec(host=node) 로 그 명령을 실행**한다 |
| **헤드리스 노드**(`openclaw node run`, 고급) | commands 에 `file.write` 있음 | `file` — file-transfer 플러그인 `file.write` 로 직접 쓰고 sha256 대조 |

```
VPS (여기)                                                   PC
team.json ─┐                                                 openclaw-personal-dashboard (앱)
STATE.md  ─┼→ build_dashboard.mjs → workspace/dashboard/*.json ─┬─ file: file.write ──→ 문서\openclaw-dashboard\inbox\*.json ─┐
agents list┘                        send_to_pc.mjs             └─ hub : exec cmd echo → 문서\openclaw-dashboard\inbox\*.b64  ─┴→ 30초 안에 자동 반영
                                                                                                           └ 안 되면 설정 > JSON 가져오기
```

사용자에게는 사용자의 언어로 쉽게 말한다. 만들지 않은 것을 만들었다고, 보내지 않은 것을 보냈다고 말하지 않는다. 토큰·비밀번호는 어떤 파일에도 넣지 않는다(스크립트가 발견하면 거부한다). 전송은 **sha256 이 PC 응답과 일치할 때만** "보냈다"고 보고한다.

## 0. 먼저 알아둘 것 (에이전트용)

- 스크립트는 이 폴더의 `scripts/` 에 있다. `<skill-dir>` = 이 SKILL.md 가 있는 폴더(보통 `<workspace>/skills/dashboard-builder`).
- 만든 파일은 `~/.openclaw/workspace/dashboard/`(기본). 전송 설정은 같은 폴더의 `pc.json`.
- PC 는 **페어링(`devices approve`) + 노드 기능 승인(`nodes approve`)** 두 번 승인된 노드여야 한다. **승인은 사람이 한다.**
- `file` 전송은 file-transfer 플러그인(내장, 2026.10+)을 쓰며 `setup_transfer.mjs` 가 플러그인·정책을 켠다. `hub` 전송은 게이트웨이 설정을 바꾸지 않는다.
- `hub` 전송의 전제(PC 에서 사용자가 한 번 해 둔다): Hub 앱 **Settings > Sandbox = Recommended, Documents = Read + write**(기본 Locked Down 에서는 파일을 못 쓴다). exec 할 때마다 PC 에 **허용 창(Allow Once / Deny)** 이 뜬다 — "항상 허용"이 없고, 허용 목록은 VPS 에서 원격으로 못 바꾼다(`Remote exec approval updates cannot add…`). 그래서 스크립트는 조각들을 `&&` 로 묶어 명령 수를 최소화한다(보통 1~2개). 실행 전에 "PC 에서 허용 창이 N번 뜨니 Allow Once 를 눌러 주세요" 라고 알린다. 샌드박스에서는 외부 .exe(powershell 등)가 안 되고 cmd 내장(echo/type)만 되므로 스크립트가 만든 명령만 쓴다.
- 2026.10 CLI 는 stdout 에 `[plugins] …` 로그를 섞는다. 스크립트가 걸러 내므로 결과는 항상 JSON 으로 읽는다.

## 1. 재료와 PC 확인

1. `references/menu-tree.md`, `references/sync-contract.md` 를 읽는다.
2. 재료 위치:
   - **`team.json`** — 팀 온보딩이 `<workspaces>/<team-id>/team.json` 에 저장. 없으면 "팀 온보딩을 먼저 하면 직원이 메뉴에 붙습니다. 지금은 1인 대시보드로 진행할까요?" 라고 묻고 동의하면 진행.
   - **HIA `STATE.md`** — 사용자의 프로젝트 루트. 없으면 칸반은 비워 둔다.
   - 에이전트 목록은 스크립트가 `openclaw agents list --json` 으로 직접 읽는다.
3. **PC 노드**: `openclaw nodes list --json` 으로 사용자의 PC 가 보이는지, `commands` 에 `file.write` 가 있는지(→ `file`) 없고 `system.run` 만 있는지(→ `hub`) 본다. 없으면 "PC 의 OpenClaw Hub 앱(또는 노드)이 켜져 있고 VPS 에 승인돼 있어야 합니다" 라고 안내하고 멈춘다. Pending(승인 대기)이 있으면 `openclaw nodes approve <requestId>` 를 사용자가 실행하도록 안내한다.
4. **inbox 경로**: 설치 도우미(`setup.ps1`)가 잡는 기본은 **`문서\openclaw-dashboard\inbox`** 다. `hub` 면 경로를 묻지 말고 `%USERPROFILE%\Documents\openclaw-dashboard\inbox` 를 쓴다(PC 의 cmd 가 사용자 이름을 채운다). `file` 이면 PC 앱 **설정 → 동기화** 에 표시된 절대경로를 복사해 달라고 한다(정책 glob 에 실제 경로가 필요). 처음 한 번만.
5. 이미 만든 적이 있으면 `dashboard/manifest.json`·`dashboard/pc.json` 을 읽어 업데이트 모드로 간다(2단계 생략).

**완료 기준:** 재료 위치, PC 노드 이름, inbox 경로를 안다.

## 2. 메뉴 인터뷰 (처음 만들 때만)

> 1주차 기본 메뉴는 **업무현황 · 팀관리 · 이메일 · 글감실 · 나의 메모 · 설정** 입니다. 빼거나 더할 메뉴가 있나요? (전체 30개 중 고를 수 있어요. 2주차 이후 메뉴는 지금 넣어도 자물쇠가 걸려 있다가 그 주에 열립니다.)

- 메뉴마다 담당 직원을 붙인다. `team.json` 의 `menus` 가 있으면 그대로, 없으면 역할로 추천하고 확인받는다. 담당이 없는 메뉴는 **"담당 없음"으로 둔다**. 필요한 직원은 팀 온보딩 스킬로 추가하라고 안내한다.
- 즐겨찾기 6개와 대시보드 이름을 정한다. 기본 이름 `"<사용자 호칭>의 AI 오피스"`.

## 3. 미리보기와 승인

표로 보여준다: 메뉴 | 담당 | 열리는 주차, 칸반 항목 수(대기/진행/완료), 직원 표(VPS 등록 여부), 보낼 PC(노드 이름)와 inbox 경로. "이대로 만들어 PC 로 보낼까요?" 한 번 확인받는다.

## 4. 생성 → 전송 설정 → 전송 → 점검

```bash
# (1) 데이터 생성
node <skill-dir>/scripts/build_dashboard.mjs --team <workspaces>/<team-id>/team.json --state <project-root>/STATE.md \
  [--menus kakao,news] [--owner email=<agent-id>] [--favorites tasks,agents,email,ideas,notes,settings] [--name "사장님의 AI 오피스"] [--week 1]
# (2) 전송 설정 (처음 한 번, 이후엔 생략 가능) — pc.json 저장. file 이면 플러그인·정책·명령 허용도 config patch 로 넣는다
#   Hub 앱 노드(수강생 기본):
node <skill-dir>/scripts/setup_transfer.mjs --transport hub --node "<PC 노드 이름 또는 ID>" --inbox "%USERPROFILE%\Documents\openclaw-dashboard\inbox" --save ~/.openclaw/workspace/dashboard/pc.json
#   헤드리스 노드:
node <skill-dir>/scripts/setup_transfer.mjs --node "<PC 노드 이름 또는 ID>" --inbox "<PC inbox 절대경로>" --save ~/.openclaw/workspace/dashboard/pc.json
# (3) 전송 — seed → config → manifest 순서
node <skill-dir>/scripts/send_to_pc.mjs --pc ~/.openclaw/workspace/dashboard/pc.json
#   file: 스크립트가 file.write 로 직접 쓰고 sha256 대조 → ok:true 면 전송 끝
#   hub : 스크립트는 commands[] (cmd echo 를 && 로 묶은 것, 보통 1~2줄) 만 만든다 → 에이전트가 exec 도구(host=node, node=<PC 노드>)로
#         **위에서부터 한 줄씩, 글자 하나 바꾸지 말고** 실행한다. 실행 전에 사용자에게 "허용 창 N번" 을 예고한다. 마지막 `type` 출력이 끊기지 않고 나오면 끝.
# (4) 점검 (문제가 있을 때)
node <skill-dir>/scripts/check_sync.mjs
```

- (1) 결과의 `version`·`counts`·`reasons` 를 사용자에게 요약한다. `reasons` 는 그대로 전달(예: "STATE.md 에 다음 행동 섹션이 없어 칸반이 비었습니다"). 종료코드 3 = 비밀값 발견 → 어느 재료에 있는지 알려주고 멈춘다.
- (2) 결과의 `nextSteps` 에 `openclaw nodes approve …` 가 있으면 **사용자가** 실행하게 한 뒤 (3) 으로. `--dry-run` 으로 먼저 보여줄 수 있다.
- (3) 성공하면 "PC 대시보드 홈에서 30초 안에 반영됩니다. 홈 오른쪽 '동기화 버전'이 `<version>` 이 되면 끝입니다" 라고 말한다. 실패하면 `references/sync-contract.md` 의 "막혔을 때" 표로 원인을 좁힌다.
- (3)-hub 주의: exec 결과가 `UserDenied` 면 PC 에서 허용 창이 거부·시간초과된 것이다 — "PC 화면의 OpenClaw 허용 창에서 **Allow Once** 를 눌러 주세요" 라고 말하고 **같은 명령부터** 다시 실행한다. `0xC0000142`/`-1073741502` 는 외부 .exe 가 샌드박스에서 막힌 것이니 스크립트가 만든 cmd 명령만 쓴다. 명령을 요약·축약하면 base64 가 깨져 PC 앱이 "일부 파일이 깨졌습니다" 라고 표시한다 → 해당 파일의 명령을 처음(`>`)부터 다시 실행한다. Hub 는 종료코드를 돌려주지 않으므로 마지막 `type` 출력으로 확인한다.

**완료 기준:** `send_to_pc` 가 `ok: true` 이고 사용자가 PC 화면에서 팀과 칸반을 봤다고 확인했거나, 대체 경로(설정 > JSON 가져오기에 `seed.json` 붙여넣기)를 안내받았다.

## 5. 업데이트 ("대시보드 업데이트해줘")

(1) → (3) 만 다시 실행한다(인터뷰·전송 설정 생략). 이전 `config.json` 의 메뉴·담당·즐겨찾기·이름은 자동 유지되고 `STATE.md` 변화만 칸반에 반영된다. "2주차로 올려줘" → `--week 2`, "카톡관리 추가해줘" → `--menus kakao`. PC 에서 사용자가 바꾼 상태(완료 처리 등)는 덮어쓰지 않는다.

## 경계

- PC 에 앱을 설치하지 않는다. inbox 폴더 밖에는 아무것도 쓰지 않는다 — `file` 은 정책이 막고, `hub` 는 스크립트가 만든 `echo … >> <inbox>\*.b64` 명령 외에는 exec 로 아무것도 실행하지 않는다.
- 외부 서비스(카톡·메일·쿠팡 등)와 연동하지 않는다. 카드형 메뉴는 "연동 전"으로 표시된다.
- 게이트웨이 설정 변경은 `setup_transfer.mjs` 가 하는 것(file-transfer 활성·노드 정책·`file.*` 명령 허용)만. 토큰·바인드·다른 플러그인은 건드리지 않는다.
- 노드 기능 승인(`nodes approve`)은 사람이 한다. 스킬이 대신 승인하지 않는다.
