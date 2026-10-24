#!/usr/bin/env bash
# 내 AI 오피스 — macOS/Linux 설치 도우미. 저장소 폴더에서:  bash scripts/setup.sh
# 토큰은 필요 없습니다. VPS 의 비서가 OpenClaw 노드를 통해 .data/inbox 에 파일을 넣습니다.
set -euo pipefail
cd "$(dirname "$0")/.."
ok() { printf '\033[32m✓ %s\033[0m\n' "$1"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$1"; exit 1; }

command -v node >/dev/null || fail "Node.js 가 없습니다. https://nodejs.org 에서 LTS(20 이상)를 설치하세요."
major=$(node -v | sed 's/^v//' | cut -d. -f1)
[ "$major" -ge 20 ] || fail "Node.js $(node -v) 은 너무 낮습니다. 20.9 이상이 필요합니다."
ok "Node.js $(node -v)"

[ -d node_modules ] || { echo '패키지를 설치합니다 (1~3분)…'; npm install --no-audit --no-fund >/dev/null; }
ok 'npm 패키지'

if [ ! -f .env.local ]; then
  read -r -p '대시보드 이름 (기본: 내 AI 오피스): ' name; name=${name:-내 AI 오피스}
  printf 'OPENCLAW_SYNC_URL=\nOPENCLAW_GATEWAY_TOKEN=\nDASHBOARD_PASSWORD=\nDASHBOARD_INGEST_TOKEN=\nNEXT_PUBLIC_DASHBOARD_NAME=%s\nDASHBOARD_INBOX_DIR=%s\n' "$name" "$HOME/Documents/openclaw-dashboard/inbox" > .env.local
  chmod 600 .env.local
  ok '.env.local 생성'
else ok '.env.local 이미 있음 (건너뜀)'; fi

inbox="$HOME/Documents/openclaw-dashboard/inbox"
mkdir -p "$inbox"
grep -q '^DASHBOARD_INBOX_DIR=' .env.local || printf 'DASHBOARD_INBOX_DIR=%s\n' "$inbox" >> .env.local
ok "받은 데이터 폴더: $inbox"

echo
printf '\033[36m실행:  npm run dev   → http://127.0.0.1:3000\033[0m\n'
printf '\033[36m그다음 VPS 의 비서에게:\033[0m  \033[33m대시보드 만들어줘. 내 PC inbox 경로는 %s 야.\033[0m\n' "$inbox"
