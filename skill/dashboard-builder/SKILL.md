---
name: dashboard-builder
description: 팀 온보딩 결과(team.json)·HIA STATE.md·OpenClaw 에이전트 목록으로 사용자의 "내 AI 오피스" 대시보드 데이터(메뉴·담당 직원·칸반·즐겨찾기·주차)를 만들어 VPS 캔버스 폴더에 저장하고, PC 대시보드가 동기화하도록 안내한다. "대시보드 만들어줘", "대시보드 업데이트해줘", "메뉴 추가해줘", "내 AI 오피스 만들어줘" 또는 "build my dashboard", "update the dashboard" 에 사용. 대시보드 앱 자체(Next.js)를 설치·실행하는 스킬이 아니다.
---

# Dashboard Builder — 팀이 보이는 내 AI 오피스

이 스킬은 **데이터를 만든다.** 화면(앱)은 사용자의 PC 에서 `openclaw-personal-dashboard` 가 띄우고, 이 스킬이 VPS 에 써 둔 파일을 **PC 가 당겨간다**(동기화). 그래서 노드 명령 실행도, 파일 전송 승인도 필요 없다.

```
VPS (여기)                                   PC
team.json ─┐                                 openclaw-personal-dashboard
STATE.md  ─┼→ build_dashboard.mjs → canvas/dashboard/{manifest,config,seed}.json ──(Bearer 토큰, HTTP)──→ [동기화] 버튼
agents list┘                                 └ 실패하면 설정 > JSON 가져오기
```

사용자에게는 사용자의 언어로 쉽게 말한다. 만들지 않은 것을 만들었다고 말하지 않는다. 토큰·비밀번호는 어떤 파일에도 넣지 않는다(스크립트가 발견하면 거부한다).

## 1. 재료 확인

1. `references/menu-tree.md`, `references/sync-contract.md` 를 읽는다.
2. 재료 위치를 찾는다:
   - **`team.json`** — 팀 온보딩 스킬이 `<workspaces>/<team-id>/team.json` 에 저장. 없으면 "팀 온보딩을 먼저 하면 직원이 메뉴에 붙습니다. 지금은 1인 대시보드로 진행할까요?" 라고 묻고, 동의하면 진행한다.
   - **HIA `STATE.md`** — 사용자의 프로젝트 루트(HIA 가 설치된 폴더). 없으면 칸반은 비워 둔다.
   - **`openclaw agents list --json`** — 스크립트가 직접 호출한다(실패하면 등록 여부 "미확인"으로 둔다).
3. 이미 만든 적이 있으면 `~/.openclaw/workspace/canvas/dashboard/manifest.json` 을 읽어 현재 버전·메뉴를 파악한다(업데이트 모드).

**완료 기준:** 세 재료의 위치(또는 없음)를 알고, 처음인지 업데이트인지 안다.

## 2. 메뉴 인터뷰 (처음 만들 때만)

기본 6개를 보여주고 묻는다:

> 1주차 기본 메뉴는 **업무현황 · 팀관리 · 이메일 · 글감실 · 나의 메모 · 설정** 입니다. 빼거나 더할 메뉴가 있나요? (전체 30개 중 고를 수 있어요. 2주차 이후 메뉴는 지금 넣어도 자물쇠가 걸려 있다가 그 주에 열립니다.)

- 메뉴마다 담당 직원을 붙인다. `team.json` 의 `menus` 가 있으면 그대로, 없으면 역할로 추천하고 확인받는다. 담당이 없는 메뉴는 **"담당 없음"으로 둔다** — 억지로 배정하지 않는다. 필요한 직원은 팀 온보딩 스킬로 추가하라고 안내한다.
- 즐겨찾기 6개(홈 상단 타일)와 대시보드 이름을 정한다. 기본 이름은 `"<사용자 호칭>의 AI 오피스"`.
- 업데이트 모드면 인터뷰를 생략하고 "바뀐 것만" 묻는다(메뉴 추가/담당 변경/주차 올리기).

**완료 기준:** 메뉴 목록·담당·즐겨찾기·이름·주차가 정해졌다.

## 3. 미리보기와 승인

표로 보여준다: 메뉴 | 담당 | 열리는 주차, 그리고 칸반에 들어갈 항목 수(대기/진행/완료), 직원 표(VPS 등록 여부). "이대로 만들까요?" 한 번 확인받는다.

## 4. 생성

```bash
node <skill-dir>/scripts/build_dashboard.mjs \
  --team <workspaces>/<team-id>/team.json \
  --state <project-root>/STATE.md \
  [--menus kakao,news] [--owner email=<agent-id>] [--favorites tasks,agents,email,ideas,notes,settings] \
  [--name "사장님의 AI 오피스"] [--week 1] [--out ~/.openclaw/workspace/canvas/dashboard]
```

- 결과 JSON 의 `version`(16자 해시), `counts`, `reasons` 를 읽고 사용자에게 요약한다. `reasons` 는 **그대로 전달**한다(예: "STATE.md 에 다음 행동 섹션이 없어 칸반이 비었습니다").
- 기존 파일은 `.bak-<시각>` 으로 보관된다. 종료코드 3 = 비밀값 발견 → 어느 재료에 들어 있는지 알려주고 멈춘다.
- 이어서 점검: `node <skill-dir>/scripts/check_sync.mjs` → `hints` 에 PC 쪽 `.env.local` 값 형식과 게이트웨이 바인드 주의가 나온다.

**완료 기준:** 3개 파일이 캔버스 폴더에 있고 `check_sync` 가 `ok: true`.

## 5. PC 연결 안내

사용자에게 이렇게 말한다(처음 한 번):

> PC 에서 대시보드 앱을 아직 설치하지 않았다면 `openclaw-personal-dashboard` 저장소의 **PC 설치** 절차(PowerShell 에서 `.\scripts\setup.ps1`)를 따르세요. 설치 때 VPS Tailscale IP 와 게이트웨이 토큰을 넣으면 홈의 **[동기화]** 버튼으로 가져옵니다. 동기화가 되면 홈 오른쪽 "동기화 버전"이 `<version>` 으로 바뀝니다.

동기화가 안 되면(401/404/연결 실패) `references/sync-contract.md` 의 "막혔을 때" 표를 따라 원인을 좁히고, 그래도 안 되면 **대체 경로**: 캔버스 폴더의 `seed.json`·`config.json` 내용을 사용자에게 보여주고 PC 대시보드 **설정 > JSON 가져오기**에 붙여넣게 한다.

**완료 기준:** 사용자가 PC 화면에서 자기 팀과 칸반을 봤다고 확인했거나, 대체 경로를 안내받았다.

## 6. 업데이트 ("대시보드 업데이트해줘")

1~4 를 다시 실행하되 인터뷰는 생략한다. 이전 `config.json` 의 메뉴·담당·즐겨찾기·이름은 자동으로 유지되고, `STATE.md` 변화만 칸반에 반영된다. 사용자가 "2주차로 올려줘" 하면 `--week 2`, "카톡관리 추가해줘" 하면 `--menus kakao`. 끝나면 "PC 에서 [동기화] 를 눌러 주세요" 라고 말한다. PC 에서 사용자가 바꾼 상태(완료 처리 등)는 동기화해도 되돌아가지 않는다.

## 경계

- 이 스킬은 PC 에 아무것도 설치하지 않고, 노드에서 명령을 실행하지 않는다.
- 외부 서비스(카톡·메일·쿠팡 등)와 연동하지 않는다. 카드형 메뉴는 "연동 전" 상태로 표시된다.
- 캔버스 폴더 밖의 파일을 쓰지 않는다. 기존 파일은 백업 후 교체한다.
- 게이트웨이 바인드·토큰·canvasHost 설정을 바꾸지 않는다. 필요하면 사용자에게 무엇을 확인할지 알려준다.
