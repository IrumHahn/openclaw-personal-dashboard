# OpenClaw Personal Dashboard — 내 AI 오피스 (v0.2)

내 PC 에서 돌아가는 개인 AI 오피스 화면 + VPS 의 OpenClaw 에이전트가 그 화면의 데이터를 채워 주는 **dashboard-builder 스킬**. 팀 한이룸 AI Office v2 의 메뉴 구조(5그룹 30메뉴)를 따르되, 원본의 코드·계정·업무 데이터는 포함하지 않는다.

```
VPS (OpenClaw)                                                      내 PC (OpenClaw 노드 + 이 앱)
agent-team-onboarding → team.json ─┐                                openclaw-personal-dashboard (Next.js)
HIA STATE.md                       ├→ dashboard-builder 스킬 ──Hub 앱: exec cmd echo(.b64) / 헤드리스: file.write──→ 문서\openclaw-dashboard\inbox → 30초 안에 자동 반영
openclaw agents list               ┘                                                               └ 막히면 설정 > JSON 가져오기
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
cd $HOME\Documents
git clone https://github.com/IrumHahn/openclaw-personal-dashboard.git
cd openclaw-personal-dashboard
.\scripts\setup.ps1      # Node 확인 → 패키지 설치 → .env.local → inbox 폴더 → 바탕화면 바로가기
npm run dev              # → http://127.0.0.1:3000
```

macOS/Linux 는 `bash scripts/setup.sh`. **토큰·IP 입력이 없습니다.** 설치 도우미가 마지막에 보여주는 **inbox 경로**(설정 화면에도 표시)를 VPS 의 비서에게 알려주면 끝입니다. 전제: 이 PC 가 OpenClaw 노드로 VPS 에 페어링돼 있어야 합니다(1주차 수요일 과제).

> `localhost` 전용이다. 휴대폰에서 보려면 Tailscale Serve 같은 인증된 HTTPS 경로를 직접 설정하고 `DASHBOARD_PASSWORD` 를 켠다. 일반 HTTP 인터넷에 노출하지 않는다.

## VPS 스킬 설치 (dashboard-builder · 1분)

OpenClaw 가 있는 VPS 터미널에서:

```bash
cd ~ && git clone https://github.com/IrumHahn/openclaw-personal-dashboard.git
openclaw skills install ./openclaw-personal-dashboard/skill/dashboard-builder --as dashboard-builder --agent main
openclaw skills list | grep dashboard-builder     # ready 가 보이면 성공
```

(`--agent main` 은 에이전트가 2명 이상일 때 필수. 호스팅어 템플릿의 상태 폴더는 `/data/.openclaw` 이며 `skills install` 이 알아서 넣는다.)

그다음 OpenClaw 채팅에서:

```
대시보드 만들어줘. 내 PC는 OpenClaw Hub 앱 노드고, inbox는 문서 폴더의 openclaw-dashboard\inbox 야.
내 팀(team.json)과 HIA STATE.md 를 읽어서 1주차 기본 메뉴로 시작하고, 메뉴마다 담당 직원을 제안해줘.
만들기 전에 표로 보여주고 내 확인을 받아줘.
```

스킬은 ① 재료·PC 노드·inbox 확인 → ② 메뉴 인터뷰 → ③ 미리보기·승인 → ④ 생성 → 전송 설정(`setup_transfer.mjs`, file-transfer 플러그인·노드 정책·명령 허용을 `config patch`) → 전송(`send_to_pc.mjs`, `file.write` + sha256 대조) 순으로 진행한다. 노드 **기능 승인**(`openclaw nodes approve <requestId>`)이 뜨면 사람이 한 번 실행한다. 이후에는 "대시보드 업데이트해줘" 한마디로 칸반을 갱신한다. 절차: [`skill/dashboard-builder/SKILL.md`](skill/dashboard-builder/SKILL.md) · 메뉴 키: [`references/menu-tree.md`](skill/dashboard-builder/references/menu-tree.md) · 데이터 계약: [`references/sync-contract.md`](skill/dashboard-builder/references/sync-contract.md)

## 동기화가 되는 원리와 조건

PC inbox 는 `문서\openclaw-dashboard\inbox`(`DASHBOARD_INBOX_DIR`). 앱은 30초마다 inbox 의 `manifest.json`/`manifest.b64` 의 `version` 을 확인해 바뀌면 자동 병합한다(`GET/POST /api/sync`). 두 경로:

- **Hub 앱 노드(수강생 기본)** — Windows OpenClaw Companion 에는 `file.write` 가 없어, 스킬이 파일을 base64 청크의 `cmd /c echo … >> *.b64` 명령으로 만들고 VPS 비서가 exec(host=node) 로 실행한다. 샌드박스(Recommended + Documents Read+write)에서 cmd 내장 명령은 허용되고 외부 .exe 는 막힌다. 명령마다 PC 허용 창(Allow Once)이 뜨므로 스킬이 명령을 1~2개로 묶는다. 실증: 2026-10-24 Windows 365 Cloud PC.
- **헤드리스 노드(`openclaw node run`)** — 내장 **file-transfer 플러그인** `file.write` 로 직접 쓰고 sha256 대조. VPS 에 `setup_transfer.mjs` 가 넣는 설정(플러그인 활성, 노드별 `allowWritePaths: ["<inbox>/**"]`, `gateway.nodes.commands.allow`) 필요. 실증: macOS 노드 2026.10.6, Windows 헤드리스 노드 2026.9.2.

둘 다 토큰·IP 를 PC 에 넣을 필요가 없고, 에이전트는 inbox 밖에 쓰지 않는다.

(구버전 "당겨오기" 방식은 `OPENCLAW_SYNC_URL`+`OPENCLAW_GATEWAY_TOKEN` 을 설정하면 inbox 가 없을 때만 대체로 동작한다.)

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
node --test tests/*.test.mjs     # 26 tests: 메뉴 트리·설정·병합·STATE 파서·빌더·전송(가짜 openclaw)·inbox
npm run build
```

- 기술 구성: Next.js 16 / React 19 / Lucide. 서버 전용 모듈은 `lib/config-store.js`, `lib/store.js`, `lib/registered-agents.js`. 순수 로직은 `lib/config.js`, `lib/merge.js`, `lib/sync.js`, `lib/menu-tree.js`.
- 스킬 스크립트(`skill/dashboard-builder/scripts/`)는 Node 내장 모듈만 사용하며 npm 없이 VPS 에서 돈다.
- 실증: 호스팅어 VPS(OpenClaw 2026.10.3)에서 스킬 설치·`file.write` 전송(맥미니 노드)까지 확인. Windows 노드·실제 수강생 PC 는 개강 전 확인 예정.
- 알려진 환경 이슈(호스팅어 템플릿): Codex 플러그인이 `EXDEV` 로 로드 실패할 수 있다 → `ln -s /tmp/oc-plugin-captures /data/.openclaw/tmp/plugin-captures`(node 소유) 후 컨테이너 재시작. `openclaw agents delete` 가 "not found" 를 내는 경우가 있다.

## 라이선스

MIT.
