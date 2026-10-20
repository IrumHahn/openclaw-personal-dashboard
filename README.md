# OpenClaw Personal Dashboard

다른 OpenClaw 사용자도 자신의 컴퓨터에 내려받아 실행할 수 있는 개인 AI 오피스 템플릿입니다. 팀한이룸 대시보드 v2의 차분한 시각 언어에서 영감을 얻었지만, 원본의 코드·계정·업무 데이터는 포함하지 않습니다.

## 화면

- **팀 운영:** 업무현황, 업무제안, 팀관리, 운영현황
- **응대와 소통:** 이메일, 인맥관리
- **기록 / 시스템:** 미팅기록, 나의 메모, 노트북LM
- **홈:** 중요한 업무와 최근 기록, OpenClaw 연결 상태

업무·제안·메일 처리 메모·연락처·미팅·메모·NotebookLM 링크는 로컬 JSON 파일에 저장합니다. 팀관리와 운영현황은 설치된 OpenClaw CLI에서 에이전트와 자동화의 **제한된 읽기 전용 정보**를 가져옵니다. 이메일과 NotebookLM은 자동 연동된 것처럼 표시하지 않습니다. 해당 계정 연동은 사용자 환경에 맞게 별도로 확장해야 합니다.

## 요구 사항

- Node.js 20.9 이상
- OpenClaw CLI (팀관리·운영현황에만 필요; 없어도 나머지 화면은 동작)
- npm

## 설치

```bash
git clone https://github.com/IrumHahn/openclaw-personal-dashboard.git
cd openclaw-personal-dashboard
npm install
cp .env.example .env.local
npm run dev
```

컴퓨터의 브라우저에서 <http://127.0.0.1:3000>을 엽니다. 기본값은 **localhost 전용**이며 다른 사람에게 공개되지 않습니다. `NEXT_PUBLIC_DASHBOARD_NAME`을 바꾸면 왼쪽 상단 이름을 개인화할 수 있습니다.

배포용으로 빌드하려면:

```bash
npm run build
npm run start
```

## 데이터와 보안

- 기록은 `.data/dashboard.json`에 저장되며 Git에서 제외됩니다. 백업은 이 파일을 별도로 복사하세요.
- `.env.local`도 Git에서 제외됩니다. 비밀번호·토큰을 커밋하지 마세요.
- 기본 서버는 `127.0.0.1`에만 바인딩됩니다. 휴대폰에서 접속하려면 Tailscale Serve 등 **인증된 HTTPS 경로**를 직접 설정하세요. 이때 `DASHBOARD_PASSWORD`를 설정하세요. Basic 인증을 일반 HTTP 인터넷에 노출하지 마세요.
- 이 템플릿은 **1인·1설치**용입니다. 여러 수강생의 데이터를 하나의 인스턴스에 넣지 마세요.
- 서드파티 메일·NotebookLM 계정은 이 템플릿에 자동 연결되지 않습니다.

## 텔레그램 음성 전사 연결

대시보드 자체는 녹음·전사를 하지 않습니다. 각 사용자의 OpenClaw 텔레그램 봇이 음성 파일을 받아 전사한 뒤, 결과를 이 API에 보낼 수 있습니다. `.env.local`에 긴 임의의 `DASHBOARD_INGEST_TOKEN`을 설정하고 서버를 재시작하세요.

```bash
curl -X POST http://127.0.0.1:3000/api/ingest \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "collection": "meetings",
    "title": "주간 회의",
    "summary": "주요 결정과 후속 작업",
    "body": "전사 원문",
    "source": "telegram",
    "sourceId": "telegram-message-unique-id"
  }'
```

`YOUR_TOKEN`을 자신의 `.env.local`에 설정한 값으로 바꾸세요. `collection`은 `meetings` 또는 `notes`입니다. 같은 `source`와 `sourceId`가 다시 들어오면 중복 저장하지 않습니다. 자동 분류가 애매한 녹음은 봇 쪽에서 사람에게 확인을 요청한 뒤 보내세요. 대화 녹음은 참여자의 동의를 확인하세요.

## 템플릿의 의도적 제한

이메일 메뉴는 **처리 메모**만 저장합니다. 메일함 조회·발송 기능은 없습니다. 노트북LM 메뉴는 **링크 보관**용입니다. 작업 제안은 수락·완료 상태를 정리할 수 있지만 OpenClaw 작업 실행을 자동 트리거하지 않습니다. 이처럼 외부 서비스에 쓰기 권한이 필요한 기능은 각 사용자가 직접 연동 방식과 권한을 결정해야 합니다.

## 기술 구성

- Next.js 16 / React 19 / Lucide icons
- 로컬 JSON 저장소 (`.data/dashboard.json`), 원자적 파일 교체
- `openclaw status --json`, `openclaw cron list --json`의 필수 필드만 화면에 전달
- 기본 포트 `3000`; 다른 포트가 필요하면 `npm run dev -- -p 3100`

## 라이선스

MIT. 사용자의 OpenClaw 설정과 기록은 이 저장소에 포함되어 있지 않습니다.
