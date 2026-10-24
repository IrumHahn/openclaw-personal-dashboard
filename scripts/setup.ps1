# 내 AI 오피스 — Windows 설치 도우미
# 사용: 저장소 폴더에서 PowerShell 을 열고  .\scripts\setup.ps1
# 하는 일: Node 확인 → npm install → .env.local 생성 → inbox 폴더(문서\openclaw-dashboard\inbox) 생성 → 바탕화면 바로가기 → 실행 안내
# 토큰은 필요 없습니다. VPS 의 비서가 OpenClaw 노드(Hub 앱 또는 헤드리스)를 통해 inbox 폴더에 파일을 넣습니다.
# inbox 를 "문서" 폴더 아래에 두는 이유: Windows Hub 앱의 샌드박스가 기본으로 열어 줄 수 있는 폴더가 Documents 이기 때문입니다.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Fail($msg) { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }
function Ok($msg) { Write-Host "✓ $msg" -ForegroundColor Green }

# 1. Node.js
try { $nodeVersion = (node -v) } catch { Fail "Node.js 가 없습니다. https://nodejs.org 에서 LTS(20 이상)를 설치한 뒤 PowerShell 을 다시 열고 재실행하세요." }
$major = [int]($nodeVersion.TrimStart('v').Split('.')[0])
if ($major -lt 20) { Fail "Node.js $nodeVersion 은 너무 낮습니다. 20.9 이상이 필요합니다." }
Ok "Node.js $nodeVersion"

# 2. 의존성
if (-not (Test-Path 'node_modules')) { Write-Host '패키지를 설치합니다 (1~3분)…'; npm install --no-audit --no-fund | Out-Null }
Ok 'npm 패키지'

# 3. inbox 폴더 — 비서가 파일을 넣는 곳. 모든 수강생이 같은 자리: 문서\openclaw-dashboard\inbox
$inbox = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'openclaw-dashboard\inbox'
New-Item -ItemType Directory -Force $inbox | Out-Null
Ok "받은 데이터 폴더: $inbox"

# 4. .env.local (토큰 불필요). 이미 있으면 inbox 경로 줄만 없을 때 보탭니다.
$envFile = Join-Path $root '.env.local'
if (-not (Test-Path $envFile)) {
  $name = Read-Host '대시보드 이름 (기본: 내 AI 오피스)'
  if (-not $name) { $name = '내 AI 오피스' }
  $lines = @('OPENCLAW_SYNC_URL=', 'OPENCLAW_GATEWAY_TOKEN=', 'DASHBOARD_PASSWORD=', 'DASHBOARD_INGEST_TOKEN=', "NEXT_PUBLIC_DASHBOARD_NAME=$name", "DASHBOARD_INBOX_DIR=$inbox")
  [IO.File]::WriteAllLines($envFile, $lines, (New-Object Text.UTF8Encoding $false))
  Ok '.env.local 생성'
} elseif (-not (Select-String -Path $envFile -Pattern '^DASHBOARD_INBOX_DIR=' -Quiet)) {
  Add-Content -Path $envFile -Value "DASHBOARD_INBOX_DIR=$inbox" -Encoding UTF8
  Ok '.env.local 에 inbox 경로 추가'
} else { Ok '.env.local 이미 있음 (건너뜀)' }

# 5. 바탕화면 바로가기
try {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $url = Join-Path $desktop '내 AI 오피스.url'
  "[InternetShortcut]`r`nURL=http://127.0.0.1:3000/" | Set-Content -Path $url -Encoding ASCII
  Ok "바탕화면 바로가기: $url"
} catch { Write-Host '(바로가기 생성 건너뜀)' }

Write-Host ''
Write-Host '실행하려면 이 폴더에서:  npm run dev   → 브라우저에서 http://127.0.0.1:3000' -ForegroundColor Cyan
Write-Host ''
Write-Host '그다음 VPS 의 비서에게 이렇게 말하세요:' -ForegroundColor Cyan
Write-Host '  대시보드 만들어줘. 내 PC는 OpenClaw Hub 앱 노드고, inbox는 문서 폴더의 openclaw-dashboard\inbox 야.' -ForegroundColor Yellow
Write-Host "  (헤드리스 노드라면 경로를 그대로: $inbox)" -ForegroundColor DarkGray
Write-Host 'Hub 앱을 쓰면 앱 Settings > Sandbox 를 Recommended 로, Documents 를 Read + write 로 켜 두세요.' -ForegroundColor Cyan
Write-Host '창을 닫으면 대시보드도 멈춥니다. 켜 둘 PC 라면 "npm run build" 후 "npm run start" 를 권장합니다.'
