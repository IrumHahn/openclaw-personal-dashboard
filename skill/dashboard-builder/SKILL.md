---
name: dashboard-builder
description: 팀 온보딩 결과(team.json)·HIA STATE.md·OpenClaw 에이전트 목록으로 사용자의 "내 AI 오피스" 대시보드 데이터(메뉴·담당 직원·칸반·즐겨찾기·주차)를 만들고, 페어링된 PC 노드에 file.write 로 보내 PC 화면에 반영되게 한다. "대시보드 만들어줘", "대시보드 업데이트해줘", "메뉴 추가해줘", "내 AI 오피스 만들어줘" 또는 "build my dashboard", "update the dashboard" 에 사용. 대시보드 앱 자체(Next.js)를 PC 에 설치·실행하는 스킬은 아니다.
---

# Dashboard Builder — 팀이 보이는 내 AI 오피스

이 스킬은 **데이터를 만들어 PC 로 보낸다.** 화면(앱)은 사용자의 PC 에서 `openclaw-personal-dashboard` 가 띄우고, 이 스킬이 만든 파일 3개를 **OpenClaw 의 file-transfer 기능(`file.write` 노드 명령)** 으로 PC 의 inbox 폴더에 쓴다. PC 앱은 30초 안에 자동 반영한다.

```
VPS (여기)                                                       PC (페어링된 OpenClaw 노드)
team.json ─┐                                                     openclaw-personal-dashboard
STATE.md  ─┼→ build_dashboard.mjs → workspace/dashboard/*.json ──file.write──→ .data/inbox/*.json → 자동 반영
agents list┘                        send_to_pc.mjs                               └ 안 되면 설정 > JSON 가져오기
```

사용자에게는 사용자의 언어로 쉽게 말한다. 만들지 않은 것을 만들었다고, 보내지 않은 것을 보냈다고 말하지 않는다. 토큰·비밀번호는 어떤 파일에도 넣지 않는다(스크립트가 발견하면 거부한다). 전송은 **sha256 이 PC 응답과 일치할 때만** "보냈다"고 보고한다.

## 0. 먼저 알아둘 것 (에이전트용)

- 스크립트는 이 폴더의 `scripts/` 에 있다. `<skill-dir>` = 이 SKILL.md 가 있는 폴더(보통 `<workspace>/skills/dashboard-builder`).
- 만든 파일은 `~/.openclaw/workspace/dashboard/`(기본). 전송 설정은 같은 폴더의 `pc.json`.
- 필요한 OpenClaw 기능: file-transfer 플러그인(내장, 2026.10+), PC 가 **페어링 + 기능 승인**된 노드. 1단계 스크립트가 플러그인·정책을 자동으로 켠다. **노드 승인은 사람이 한다**(`openclaw nodes approve <requestId>`).
- 2026.10 CLI 는 stdout 에 `[plugins] …` 로그를 섞는다. 스크립트가 걸러 내므로 결과는 항상 JSON 으로 읽는다.

## 1. 재료와 PC 확인

1. `references/menu-tree.md`, `references/sync-contract.md` 를 읽는다.
2. 재료 위치:
   - **`team.json`** — 팀 온보딩이 `<workspaces>/<team-id>/team.json` 에 저장. 없으면 "팀 온보딩을 먼저 하면 직원이 메뉴에 붙습니다. 지금은 1인 대시보드로 진행할까요?" 라고 묻고 동의하면 진행.
   - **HIA `STATE.md`** — 사용자의 프로젝트 루트. 없으면 칸반은 비워 둔다.
   - 에이전트 목록은 스크립트가 `openclaw agents list --json` 으로 직접 읽는다.
3. **PC 노드**: `openclaw nodes list` 로 사용자의 PC 가 보이는지 확인한다. 없으면 "수요일에 한 PC 노드 연결(`openclaw node run …`)이 켜져 있어야 합니다" 라고 안내하고 멈춘다. Pending(승인 대기)이 있으면 `openclaw nodes approve <requestId>` 를 사용자가 실행하도록 안내한다.
4. **inbox 경로**: PC 대시보드 앱의 **설정 화면 → 동기화** 에 표시된 폴더(예: `C:\Users\홍길동\Documents\openclaw-personal-dashboard\.data\inbox`). 사용자에게 복사해 달라고 한다. 처음 한 번만.
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
# (2) 전송 설정 (처음 한 번, 이후엔 생략 가능) — 플러그인·정책·명령 허용을 config patch 로 넣고 pc.json 저장
node <skill-dir>/scripts/setup_transfer.mjs --node "<PC 노드 이름 또는 ID>" --inbox "<PC inbox 절대경로>" --save ~/.openclaw/workspace/dashboard/pc.json
# (3) 전송 — seed → config → manifest 순서로 file.write, sha256 대조
node <skill-dir>/scripts/send_to_pc.mjs --pc ~/.openclaw/workspace/dashboard/pc.json
# (4) 점검 (문제가 있을 때)
node <skill-dir>/scripts/check_sync.mjs
```

- (1) 결과의 `version`·`counts`·`reasons` 를 사용자에게 요약한다. `reasons` 는 그대로 전달(예: "STATE.md 에 다음 행동 섹션이 없어 칸반이 비었습니다"). 종료코드 3 = 비밀값 발견 → 어느 재료에 있는지 알려주고 멈춘다.
- (2) 결과의 `nextSteps` 에 `openclaw nodes approve …` 가 있으면 **사용자가** 실행하게 한 뒤 (3) 으로. `--dry-run` 으로 먼저 보여줄 수 있다.
- (3) 성공하면 "PC 대시보드 홈에서 30초 안에 반영됩니다. 홈 오른쪽 '동기화 버전'이 `<version>` 이 되면 끝입니다" 라고 말한다. 실패하면 `references/sync-contract.md` 의 "막혔을 때" 표로 원인을 좁힌다.

**완료 기준:** `send_to_pc` 가 `ok: true` 이고 사용자가 PC 화면에서 팀과 칸반을 봤다고 확인했거나, 대체 경로(설정 > JSON 가져오기에 `seed.json` 붙여넣기)를 안내받았다.

## 5. 업데이트 ("대시보드 업데이트해줘")

(1) → (3) 만 다시 실행한다(인터뷰·전송 설정 생략). 이전 `config.json` 의 메뉴·담당·즐겨찾기·이름은 자동 유지되고 `STATE.md` 변화만 칸반에 반영된다. "2주차로 올려줘" → `--week 2`, "카톡관리 추가해줘" → `--menus kakao`. PC 에서 사용자가 바꾼 상태(완료 처리 등)는 덮어쓰지 않는다.

## 경계

- PC 에 앱을 설치하거나 명령을 실행하지 않는다. inbox 폴더 밖에는 아무것도 쓰지 않는다(정책이 막는다).
- 외부 서비스(카톡·메일·쿠팡 등)와 연동하지 않는다. 카드형 메뉴는 "연동 전"으로 표시된다.
- 게이트웨이 설정 변경은 `setup_transfer.mjs` 가 하는 것(file-transfer 활성·노드 정책·`file.*` 명령 허용)만. 토큰·바인드·다른 플러그인은 건드리지 않는다.
- 노드 기능 승인(`nodes approve`)은 사람이 한다. 스킬이 대신 승인하지 않는다.
