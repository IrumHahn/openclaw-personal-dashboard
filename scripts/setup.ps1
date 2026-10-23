# 내 AI 오피스 — Windows 설치 도우미
# 사용: 저장소 폴더에서 PowerShell 을 열고  .\scripts\setup.ps1
# 하는 일: Node 확인 → npm install → .env.local 생성(토큰은 화면에 안 보이게 입력) → 바탕화면 바로가기 → 실행 안내
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

# 3. .env.local
if (-not (Test-Path '.env.local')) {
  Write-Host ''
  Write-Host 'VPS 동기화 설정 (모르면 Enter — 나중에 설정 화면의 JSON 가져오기로 대신할 수 있습니다)'
  $ip = Read-Host 'VPS 의 Tailscale IP (예: 100.101.102.103)'
  $port = Read-Host '게이트웨이 포트 (기본 18789, Enter)'
  if (-not $port) { $port = '18789' }
  $secure = Read-Host '게이트웨이 토큰 (입력이 화면에 보이지 않습니다)' -AsSecureString
  $token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
  $name = Read-Host '대시보드 이름 (기본: 내 AI 오피스)'
  if (-not $name) { $name = '내 AI 오피스' }
  $lines = @()
  if ($ip) { $lines += "OPENCLAW_SYNC_URL=http://$ip`:$port/__openclaw__/canvas/dashboard/" } else { $lines += 'OPENCLAW_SYNC_URL=' }
  $lines += "OPENCLAW_GATEWAY_TOKEN=$token"
  $lines += 'DASHBOARD_PASSWORD='
  $lines += 'DASHBOARD_INGEST_TOKEN='
  $lines += "NEXT_PUBLIC_DASHBOARD_NAME=$name"
  [IO.File]::WriteAllLines((Join-Path $root '.env.local'), $lines, (New-Object Text.UTF8Encoding $false))
  Ok '.env.local 생성 (Git 에 올라가지 않습니다)'
} else { Ok '.env.local 이미 있음 (건너뜀)' }

# 4. 바탕화면 바로가기 (브라우저로 여는 링크)
try {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $url = Join-Path $desktop '내 AI 오피스.url'
  "[InternetShortcut]`r`nURL=http://127.0.0.1:3000/" | Set-Content -Path $url -Encoding ASCII
  Ok "바탕화면 바로가기: $url"
} catch { Write-Host '(바로가기 생성 건너뜀)' }

Write-Host ''
Write-Host '실행하려면 이 폴더에서:  npm run dev' -ForegroundColor Cyan
Write-Host '브라우저에서 http://127.0.0.1:3000 을 엽니다. 홈의 [동기화] 를 누르면 VPS 데이터가 들어옵니다.'
Write-Host '창을 닫으면 대시보드도 멈춥니다. 켜 둘 PC 라면 "npm run build" 후 "npm run start" 를 권장합니다.'
