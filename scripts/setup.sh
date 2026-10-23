#!/usr/bin/env bash
# 내 AI 오피스 — macOS/Linux 설치 도우미. 저장소 폴더에서:  bash scripts/setup.sh
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
  echo
  echo 'VPS 동기화 설정 (모르면 Enter — 나중에 설정 화면의 JSON 가져오기로 대신할 수 있습니다)'
  read -r -p 'VPS 의 Tailscale IP (예: 100.101.102.103): ' ip
  read -r -p '게이트웨이 포트 (기본 18789): ' port; port=${port:-18789}
  read -r -s -p '게이트웨이 토큰 (화면에 보이지 않음): ' token; echo
  read -r -p '대시보드 이름 (기본: 내 AI 오피스): ' name; name=${name:-내 AI 오피스}
  {
    if [ -n "$ip" ]; then echo "OPENCLAW_SYNC_URL=http://$ip:$port/__openclaw__/canvas/dashboard/"; else echo 'OPENCLAW_SYNC_URL='; fi
    echo "OPENCLAW_GATEWAY_TOKEN=$token"
    echo 'DASHBOARD_PASSWORD='
    echo 'DASHBOARD_INGEST_TOKEN='
    echo "NEXT_PUBLIC_DASHBOARD_NAME=$name"
  } > .env.local
  chmod 600 .env.local
  ok '.env.local 생성 (Git 에 올라가지 않습니다)'
else ok '.env.local 이미 있음 (건너뜀)'; fi

echo
printf '\033[36m실행:  npm run dev   → http://127.0.0.1:3000\033[0m\n'
echo '홈의 [동기화] 를 누르면 VPS 데이터가 들어옵니다.'
