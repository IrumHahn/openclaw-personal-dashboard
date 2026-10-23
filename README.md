# OpenClaw Personal Dashboard — 내 AI 오피스 (v0.2)

내 PC 에서 돌아가는 개인 AI 오피스 화면 + VPS 의 OpenClaw 에이전트가 그 화면의 데이터를 채워 주는 **dashboard-builder 스킬**. 팀 한이룸 AI Office v2 의 메뉴 구조(5그룹 30메뉴)를 따르되, 원본의 코드·계정·업무 데이터는 포함하지 않는다.

```
VPS (OpenClaw)                                     내 PC
agent-team-onboarding → team.json ─┐               openclaw-personal-dashboard (이 저장소, Next.js)
HIA STATE.md                       ├→ dashboard-builder 스킬 → canvas/dashboard/*.json ──(토큰, HTTP)──→ [동기화]
openclaw agents list               ┘                                                      └ 막히면 설정 > JSON 가져오기
```

## 화면 (v0.2)

- **홈**: 즐겨찾기 6타일 · 최근 움직임 · 팀과 시스템 · [동기화] 버튼
- **업무현황**: 칸반(대기 / 진행 중 / 검토 대기 / 완료) ↔ 목록. 담당 직원 칩. 버튼으로 상태 이동
- **팀관리**: 조직도(team.json) ⨝ VPS 등록 상태 ⨝ 이 PC 의 CLI. 담당 없는 메뉴 알림
- **설정**: 이름 · 주차 · 메뉴 켜기/끄기(30개) · 담당 · 열리는 주차 · 즐겨찾기 · 순서 · 메뉴 순서 초기화 · 동기화 · 내보내기 · JSON 가져오기
- **기록형 메뉴 17개**(이메일·글감실·나의 메모·미팅기록·…): 제목/내용/담당/상태 기록
- **카드형 메뉴 10개**(비즈카톡·카톡관리·쿠팡 주문·유튜브·…): 연동 전에는 담당·목적·다음 할 일 카드. 연동된 척하지 않음
- **주차 잠금**: 2~4주차 메뉴는 자물쇠. 설정에서 주차를 올리면 열림

## PC 설치 (Windows · 5분)

전제: Node.js 20.9 이상 ([nodejs.org](https://nodejs.org) LTS). OpenClaw 노드를 PC 에 설치했다면 이미 있다.

```powershell
git clone https://github.com/IrumHahn/openclaw-personal-dashboard.git
cd openclaw-personal-dashboard
.\scripts\setup.ps1      # Node 확인 → 패키지 설치 → .env.local 생성(토큰은 화면에 안 보임) → 바탕화면 바로가기
npm run dev              # → http://127.0.0.1:3000
```

macOS/Linux 는 `bash scripts/setup.sh`. `setup` 이 묻는 **VPS Tailscale IP** 는 `tailscale status` 의 VPS 줄, **게이트웨이 토큰**은 hPanel 또는 VPS 에서 `openclaw config get gateway.auth.token`. 모르면 Enter 로 건너뛰고 나중에 **설정 > JSON 가져오기**를 쓴다.

> `localhost` 전용이다. 휴대폰에서 보려면 Tailscale Serve 같은 인증된 HTTPS 경로를 직접 설정하고 `DASHBOARD_PASSWORD` 를 켠다. 일반 HTTP 인터넷에 노출하지 않는다.

## VPS 스킬 설치 (dashboard-builder · 1분)

OpenClaw 가 있는 VPS 터미널에서:

```bash
git clone https://github.com/IrumHahn/openclaw-personal-dashboard.git
mkdir -p ~/.openclaw/skills
cp -R openclaw-personal-dashboard/skill/dashboard-builder ~/.openclaw/skills/
openclaw skills list     # dashboard-builder 가 보이면 성공
```

그다음 OpenClaw 채팅에서:

```
대시보드 만들어줘. 내 팀(team.json)과 HIA STATE.md 를 읽어서 1주차 기본 메뉴로 시작하고,
메뉴마다 담당 직원을 제안해줘. 만들기 전에 표로 보여주고 내 확인을 받아줘.
```

스킬은 ① 재료 확인 → ② 메뉴 인터뷰 → ③ 미리보기·승인 → ④ 생성(`canvas/dashboard/`) → ⑤ PC 연결 안내 순으로 진행한다. 이후에는 "대시보드 업데이트해줘" 한마디로 칸반을 갱신한다. 절차: [`skill/dashboard-builder/SKILL.md`](skill/dashboard-builder/SKILL.md) · 메뉴 키: [`references/menu-tree.md`](skill/dashboard-builder/references/menu-tree.md) · 데이터 계약: [`references/sync-contract.md`](skill/dashboard-builder/references/sync-contract.md)

## 동기화가 되는 원리와 조건

PC 의 `/api/sync` 가 `OPENCLAW_SYNC_URL`(VPS 캔버스 폴더)에서 `manifest/config/seed.json` 을 **Bearer 토큰**으로 가져와 로컬 JSON 저장소에 병합한다. 조건: 게이트웨이가 Tailscale(비루프백)에 바인드돼 있고(`openclaw config get gateway.bind`), canvasHost 가 켜져 있어야 한다. 토큰은 서버 환경변수에만 있고 브라우저로 가지 않는다.

병합 규칙: `source+sourceId` 가 같으면 갱신, PC 에서 사용자가 바꾼 상태는 보존, 삭제는 전파하지 않음. 상세는 [sync-contract.md](skill/dashboard-builder/references/sync-contract.md). 동기화가 막히면 같은 파일을 **설정 > JSON 가져오기**에 붙여넣으면 된다(같은 규칙).

## 데이터와 보안

- 기록은 `.data/dashboard.json`, 설정은 `dashboard.config.json`, VPS 에이전트 목록은 `.data/registered-agents.json`. 모두 Git 제외. 백업은 **설정 > 내보내기**.
- `.env.local` 은 Git 제외. 토큰·비밀번호를 커밋하거나 채팅에 붙여넣지 않는다. 동기화·가져오기 데이터에 토큰 패턴이 있으면 거부된다.
- 기본 서버는 `127.0.0.1` 바인드. 1인·1설치용. 여러 수강생 데이터를 한 인스턴스에 넣지 않는다.
- 외부 서비스(메일·카톡·쿠팡 등)에 자동 연결되지 않는다. 그런 연동은 각자 권한을 정하고 별도로 붙인다.

## 텔레그램 음성 전사 연결 (선택)

v0.1 과 같다. `.env.local` 의 `DASHBOARD_INGEST_TOKEN` 을 설정하고 `POST /api/ingest` 에 `{ collection: "meetings"|"notes", title, summary, body, source, sourceId }` 를 보낸다. 같은 `source+sourceId` 는 중복 저장하지 않는다.

## 개발

```bash
npm ci
node --test tests/*.test.mjs     # 20 tests: 메뉴 트리·설정·병합·STATE 파서·빌더·동기화
npm run build
```

- 기술 구성: Next.js 16 / React 19 / Lucide. 서버 전용 모듈은 `lib/config-store.js`, `lib/store.js`, `lib/registered-agents.js`. 순수 로직은 `lib/config.js`, `lib/merge.js`, `lib/sync.js`, `lib/menu-tree.js`.
- 스킬 스크립트(`skill/dashboard-builder/scripts/`)는 Node 내장 모듈만 사용하며 npm 없이 VPS 에서 돈다.
- 아직 실제 VPS 에서 end-to-end 동기화를 검증하지 않았다(단위 테스트·로컬 가져오기만). 배포 전 1회 확인 필요.

## 라이선스

MIT.
