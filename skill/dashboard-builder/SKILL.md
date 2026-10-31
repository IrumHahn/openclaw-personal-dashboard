---
name: dashboard-builder
description: 업무 지도(my-work-map.md)·팀 온보딩 결과(team.json)·HIA STATE.md·OpenClaw 에이전트 목록으로 사용자의 "내 AI 오피스" 대시보드 데이터(내 업무 커스텀 메뉴·테마·나의 위젯·메뉴·담당 직원·칸반·즐겨찾기·주차)를 만들고, 페어링된 PC 노드로 보내(헤드리스 노드는 file.write, Windows Hub 앱 노드는 exec cmd echo) PC 화면에 반영되게 한다. "대시보드 만들어줘", "대시보드 업데이트해줘", "메뉴 추가해줘", "테마 바꿔줘", "내 대시보드 위젯 만들어줘", "내 AI 오피스 만들어줘", "수습 보고를 대시보드로 보내줘", "대시보드 채점 가져와" 또는 "build my dashboard", "update the dashboard" 에 사용. 대시보드 앱 자체(Next.js)를 PC 에 설치·실행하는 스킬은 아니다.
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

1. `references/menu-tree.md`, `references/sync-contract.md`, `references/personalize.md` 를 읽는다. 위젯 요청이면 `references/widget-guide.md` 도.
2. 재료 위치:
   - **`my-work-map.md`(업무 지도)** — 기본 에이전트(main) 워크스페이스 루트. **개인화의 출발점**이다. 없으면 "업무 지도가 있으면 내 업무에 맞는 메뉴를 만들 수 있어요. 지금 업무 3가지만 알려주실래요?" 라고 묻고 답으로 대신한다.
   - **`team.json`** — 팀 온보딩이 `<workspaces>/<team-id>/team.json` 에 저장. 없으면 "팀 온보딩을 먼저 하면 직원이 메뉴에 붙습니다. 지금은 1인 대시보드로 진행할까요?" 라고 묻고 동의하면 진행.
   - **HIA `STATE.md`** — 사용자의 프로젝트 루트. 없으면 칸반은 비워 둔다.
   - 에이전트 목록은 스크립트가 `openclaw agents list --json` 으로 직접 읽는다.
3. **PC 노드**: `openclaw nodes list --json` 으로 사용자의 PC 가 보이는지, `commands` 에 `file.write` 가 있는지(→ `file`) 없고 `system.run` 만 있는지(→ `hub`) 본다. 없으면 "PC 의 OpenClaw Hub 앱(또는 노드)이 켜져 있고 VPS 에 승인돼 있어야 합니다" 라고 안내하고 멈춘다. Pending(승인 대기)이 있으면 `openclaw nodes approve <requestId>` 를 사용자가 실행하도록 안내한다.
4. **inbox 경로**: 설치 도우미(`setup.ps1`)가 잡는 기본은 **`문서\openclaw-dashboard\inbox`** 다. `hub` 면 경로를 묻지 말고 `%USERPROFILE%\Documents\openclaw-dashboard\inbox` 를 쓴다(PC 의 cmd 가 사용자 이름을 채운다). `file` 이면 PC 앱 **설정 → 동기화** 에 표시된 절대경로를 복사해 달라고 한다(정책 glob 에 실제 경로가 필요). 처음 한 번만.
5. 이미 만든 적이 있으면 `dashboard/manifest.json`·`dashboard/pc.json` 을 읽어 업데이트 모드로 간다(2단계 생략).

**완료 기준:** 재료 위치, PC 노드 이름, inbox 경로를 안다.

## 2. 개인화 인터뷰 (처음 만들 때만) — **내 업무 먼저, 기본 메뉴는 나중**

모두가 같은 기본 메뉴로 시작하면 모두 같은 화면이 된다. 그래서 순서를 지킨다: ① 내 업무 → ② 분위기 → ③ 기본 메뉴. 자세한 규칙은 `references/personalize.md`.

**① 내 업무 메뉴** — 업무 지도의 상위 3개 업무를 보고 먼저 제안한다:

> 업무 지도를 보니 「<상위 업무 1>」「<상위 업무 2>」가 가장 맡기고 싶은 일이네요. 대시보드 맨 위에 **내 업무** 메뉴로 만들어 둘게요:
> - 💐 예약 꽃다발 — 고객명 · 픽업일 · 꽃 구성, 칸반(주문 접수 → 제작 중 → 픽업 대기 → 전달 완료)
> - 🎁 단골 기념일 — 단골 이름 · 기념일 · 지난번 주문
> 이름이나 칸을 바꾸고 싶은 게 있나요?

- 기본 메뉴로 충분한 업무(메일 → `email` 등)는 커스텀으로 만들지 않는다. 2~4개 권장, 최대 6개.
- 메뉴·칸·상태 이름은 **사용자가 평소 쓰는 말**로. 예시를 그대로 베끼지 말고 그 사람 업무에서 뽑는다.

**② 분위기 3문항** — 한 번에 묻는다:

> 마지막으로 내 오피스 분위기를 정해요. ① 색: 올리브(차분)·바다(시원)·노을(따뜻)·숲(초록)·모노(흑백)·미드나잇(어두운 화면) 중에? ② 로고 자리에 넣을 이모지 하나는? ③ 홈 맨 위에 걸 나만의 한 줄은? (예: "꽃이 늦지 않게, 단골이 잊히지 않게")

고르기 어려워하면 업무에 맞춰 추천한다(`personalize.md` 3절 표). 답을 `design.json`(`customMenus` + `theme`)으로 `~/.openclaw/workspace/dashboard/design.json` 에 저장한다.

**③ 기본 메뉴·담당·이름**

> 기본 메뉴는 **업무현황 · 팀관리 · 이메일 · 글감실 · 나의 메모 · 설정** 이 함께 들어갑니다. 빼거나 더할 메뉴가 있나요? (전체 30개. 2주차 이후 메뉴는 자물쇠가 걸려 있다가 그 주에 열립니다.)

- 메뉴마다(내 업무 포함) 담당 직원을 붙인다. `team.json` 의 `menus` 가 있으면 그대로, 없으면 역할로 추천하고 확인받는다. 내 업무 메뉴 담당은 design.json 의 `owner` 로. 담당이 없는 메뉴는 **"담당 없음"으로 둔다**. 필요한 직원은 팀 온보딩 스킬로 추가하라고 안내한다.
- 즐겨찾기 6개(기본: 내 업무 메뉴가 앞) 와 대시보드 이름을 정한다. 기본 이름 `"<사용자 호칭>의 AI 오피스"`.
- **나의 위젯**은 이번 인터뷰에서 만들지 않는다. 끝에 "홈의 위젯 칸은 비어 있어요. '내 대시보드 위젯 만들어줘'라고 하면 나만의 화면을 같이 만들어요" 라고 알려 준다(`references/widget-guide.md`).

## 3. 미리보기와 승인

표로 보여준다: **내 업무 메뉴(이름 · 칸 · 상태 이름)**, 테마(색 · 이모지 · 한 줄), 메뉴 | 담당 | 열리는 주차, 칸반 항목 수(대기/진행/완료), 직원 표(VPS 등록 여부), 보낼 PC(노드 이름)와 inbox 경로. "이대로 만들어 PC 로 보낼까요?" 한 번 확인받는다.

## 4. 생성 → 전송 설정 → 전송 → 점검

```bash
# (1) 데이터 생성
node <skill-dir>/scripts/build_dashboard.mjs --team <workspaces>/<team-id>/team.json --state <project-root>/STATE.md \
  --design ~/.openclaw/workspace/dashboard/design.json \
  [--menus kakao,news] [--owner email=<agent-id>] [--favorites c-bouquet,tasks,agents,email,ideas,notes] [--name "사장님의 AI 오피스"] [--week 1] \
  [--widget ~/.openclaw/workspace/dashboard/widget.html --widget-title "이번 주 꽃다발 레이더"]
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

- (1) 결과의 `version`·`counts`(내 업무 메뉴 수·위젯 포함)·`reasons` 를 사용자에게 요약한다. design.json 오류(잘못된 키·아이콘·필드)·위젯 오류(외부 스크립트·60,000자 초과)는 메시지를 그대로 보고 고친 뒤 다시 빌드한다. `reasons` 는 그대로 전달(예: "STATE.md 에 다음 행동 섹션이 없어 칸반이 비었습니다"). 종료코드 3 = 비밀값 발견 → 어느 재료에 있는지 알려주고 멈춘다.
- (2) 결과의 `nextSteps` 에 `openclaw nodes approve …` 가 있으면 **사용자가** 실행하게 한 뒤 (3) 으로. `--dry-run` 으로 먼저 보여줄 수 있다.
- (3) 성공하면 "PC 대시보드 홈에서 30초 안에 반영됩니다. 홈 오른쪽 '동기화 버전'이 `<version>` 이 되면 끝입니다" 라고 말한다. 실패하면 `references/sync-contract.md` 의 "막혔을 때" 표로 원인을 좁힌다.
- (3)-hub 주의: exec 결과가 `UserDenied` 면 PC 에서 허용 창이 거부·시간초과된 것이다 — "PC 화면의 OpenClaw 허용 창에서 **Allow Once** 를 눌러 주세요" 라고 말하고 **같은 명령부터** 다시 실행한다. `0xC0000142`/`-1073741502` 는 외부 .exe 가 샌드박스에서 막힌 것이니 스크립트가 만든 cmd 명령만 쓴다. 명령을 요약·축약하면 base64 가 깨져 PC 앱이 "일부 파일이 깨졌습니다" 라고 표시한다 → 해당 파일의 명령을 처음(`>`)부터 다시 실행한다. Hub 는 종료코드를 돌려주지 않으므로 마지막 `type` 출력으로 확인한다.

**완료 기준:** `send_to_pc` 가 `ok: true` 이고 사용자가 PC 화면에서 팀과 칸반을 봤다고 확인했거나, 대체 경로(설정 > JSON 가져오기에 `seed.json` 붙여넣기)를 안내받았다.

## 5. 업데이트 ("대시보드 업데이트해줘")

(1) → (3) 만 다시 실행한다(인터뷰·전송 설정 생략). 이전 `config.json` 의 메뉴·담당·즐겨찾기·이름·**내 업무·테마·위젯**은 자동 유지되고 `STATE.md` 변화만 칸반에 반영된다. "2주차로 올려줘" → `--week 2`, "카톡관리 추가해줘" → `--menus kakao`, "테마 숲으로 바꿔줘"·"내 업무 메뉴 하나 더" → design.json 수정 후 `--design`(기존 `key` 는 바꾸지 않는다). PC 에서 사용자가 바꾼 상태(완료 처리 등)는 덮어쓰지 않는다. PC 설정에서 바꾼 테마·위젯·즐겨찾기는 VPS 쪽 값이 **새로 바뀔 때만** 덮어쓴다.

## 6. 나의 위젯 ("내 대시보드 위젯 만들어줘")

`references/widget-guide.md` 를 따른다. ① 2문항 인터뷰(가장 먼저 알고 싶은 숫자 하나 · 보고 나서 할 행동) → ② `~/.openclaw/workspace/dashboard/widget.html` 작성(인라인 CSS·JS만, 외부 자원·fetch 금지, `dashboard:data` 메시지로 데이터 받기) → ③ 무엇을 보여주는지 말로 미리보기, 확인 → ④ `build_dashboard.mjs --widget … --widget-title …` → `send_to_pc.mjs`. 예시를 베끼지 말고 그 사람의 내 업무 메뉴 데이터를 쓴다.

## 7. 수습 보고와 채점 ("수습 보고를 대시보드로 보내줘" · "대시보드 채점 가져와")

수습(OJT) 업무의 보고를 PC 대시보드 「수습」 메뉴에 올리고, 대표가 거기서 누른 👍 ✏️ ❌ 를 읽어 와 반영한다. 장부는 `~/.openclaw/workspace/dashboard/ojt.json` 하나이고 `scripts/ojt.mjs` 로만 고친다(JSON 을 손으로 고치지 않는다).

```bash
S=<skill-dir>/scripts
# 업무 카드(처음 한 번, 등급·최근 배운 것이 바뀔 때마다). 담당 직원 id 는 team.json 의 id
node $S/ojt.mjs job --id ad-log --title "쿠팡 광고 일지" --agent ana --level L1 --lesson "11/8 ROAS 에 VAT 포함"
# 보고 1건(본문은 파일로 넘기는 게 안전하다). 같은 --id 로 다시 부르면 고쳐 쓴다
node $S/ojt.mjs report --job ad-log --title "11/9 광고 일지" --date 2026-11-09 --id 1109 --body-file /tmp/report.md
# 보내면서 채점도 읽어 오기 → (1) build → (3) send 에 --with-grades
node $S/build_dashboard.mjs && node $S/send_to_pc.mjs --pc ~/.openclaw/workspace/dashboard/pc.json --with-grades
#   file: 결과의 grades.file(grades-latest.json) → node $S/ojt.mjs grades --file <그 파일>
#   hub : 마지막 명령 출력(===OJT-GRADES-BEGIN=== … ===OJT-GRADES-END===)을 파일로 저장 → node $S/ojt.mjs grades --hub-output <파일>
# 채점만 읽기(아침 브리핑 전): send_to_pc.mjs --pc … --grades-only
```

채점 하나마다 할 일:
- 👍 → 그 업무의 `jobs/<업무>/record.md` 에 한 줄(날짜·👍·보고 제목).
- ✏️·❌ → **"제가 틀린 이유는 ○○ 같습니다"** 가설 → `lessons.md` 한 줄 + `job.md` 수정안을 텔레그램으로 대표에게 보여 주고 **승인받은 뒤** 고친다. record.md 에도 한 줄.
- 다 처리했으면 `node $S/ojt.mjs ack --from <같은 파일>` → 최근 배운 것이 바뀌었으면 `ojt.mjs job --id … --lesson "…"` → (1) build → (3) send. PC 화면이 **반영됨 ✓** 으로 바뀐다.

PC 화면의 연속 👍 숫자는 보여주기용이다. 승급은 record.md 기준으로 비서가 제안하고 대표가 승인한다. 대표가 PC 허용 창을 못 눌러 텔레그램에 `[채점] … (id report:…)` 문장을 붙여 넣으면, 그 내용으로 위 처리를 바로 하고 `ack` 는 다음 `--with-grades` 때 한다(채점 시각은 PC 파일에만 있다).

## 경계

- PC 에 앱을 설치하지 않는다. inbox 폴더 밖에는 아무것도 쓰지 않는다 — `file` 은 정책이 막고, `hub` 는 스크립트가 만든 `echo … >> <inbox>\*.b64` 명령 외에는 exec 로 아무것도 실행하지 않는다.
- 외부 서비스(카톡·메일·쿠팡 등)와 연동하지 않는다. 카드형 메뉴는 "연동 전"으로 표시된다. 위젯도 외부 통신이 막힌 격리 화면에서 돈다(앱이 넣어 주는 데이터만 쓴다).
- 수습 채점은 PC 에서만 만든다. 비서는 채점을 지어내거나 고치지 않고, 읽고(`grades`) 반영했다고 알리기(`ack`)만 한다. hub 에서 읽기는 `type <inbox>\grades.b64` 한 줄뿐이다.
- 게이트웨이 설정 변경은 `setup_transfer.mjs` 가 하는 것(file-transfer 활성·노드 정책·`file.*` 명령 허용 — 채점 읽기용 `file.fetch` 포함)만. 토큰·바인드·다른 플러그인은 건드리지 않는다.
- 노드 기능 승인(`nodes approve`)은 사람이 한다. 스킬이 대신 승인하지 않는다.
