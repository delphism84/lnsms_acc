# C# Host 없이 로컬 스택만 기동 (mongod + lnsms-be + admin-fe) — greenfield necall.guest
param(
    [string]$RepoRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$Userid = "necall",
    [string]$StoreId = "guest",
    [switch]$SkipMongo,
    [switch]$NoKill
)

$ErrorActionPreference = "Stop"
$mongoData = Join-Path $RepoRoot "data\mongo"
$uploadDir = Join-Path $RepoRoot "data\uploads"
$be = Join-Path $RepoRoot "packages\lnsms-be"
$fe = Join-Path $RepoRoot "packages\lnsms-admin-fe"

function Kill-PortListeners([int[]]$Ports) {
    foreach ($port in $Ports) {
        Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
            ForEach-Object {
                if ($_.OwningProcess -gt 0) {
                    Write-Host "Kill port $port PID $($_.OwningProcess)"
                    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
                }
            }
    }
}

if (-not $NoKill) {
    Kill-PortListeners @(27017, 40000, 63001)
    Start-Sleep -Seconds 1
}

New-Item -ItemType Directory -Force -Path $uploadDir | Out-Null

if (-not $SkipMongo) {
    New-Item -ItemType Directory -Force -Path $mongoData | Out-Null
    $mongod = (Get-Command mongod -ErrorAction SilentlyContinue)?.Source
    if (-not $mongod) { throw "mongod not in PATH. Install MongoDB or add to PATH." }
    Start-Process $mongod -ArgumentList "--dbpath `"$mongoData`" --port 27017" -WindowStyle Hidden
    Write-Host "mongod -> $mongoData"
    Start-Sleep -Seconds 2
    $mongoUri = "mongodb://127.0.0.1:27017/lnsms"
} else {
    $mongoUri = "memory"
}

$env:PORT = "40000"
$env:MONGODB_URI = $mongoUri
$env:LOCAL_GUEST_PASSWORD = "guest"
$env:UPLOAD_DIR = $uploadDir
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$be'; npm run dev"

Start-Sleep -Seconds 2

$feCmd = @(
    "cd '$fe'",
    "`$env:NEXT_PUBLIC_API_URL='http://127.0.0.1:40000'",
    "`$env:API_PROXY_TARGET='http://127.0.0.1:40000'",
    "`$env:NEXT_PUBLIC_LOCAL_USERID='$Userid'",
    "`$env:NEXT_PUBLIC_LOCAL_STORE_ID='$StoreId'",
    "`$env:NEXT_PUBLIC_LOCAL_GUEST_PASSWORD='guest'",
    "`$env:NEXT_PUBLIC_REMOTE_API_URL='https://admin.necall.com'",
    "npm run dev"
) -join "; "

Start-Process powershell -ArgumentList "-NoExit", "-Command", $feCmd

Write-Host ""
Write-Host "BE    http://127.0.0.1:40000/health"
Write-Host "FE    http://127.0.0.1:63001"
Write-Host "Store http://127.0.0.1:63001/s/$Userid/$StoreId/setting"
Write-Host "Agent Host (58000): packages\agent-host\bin\Debug\net9.0-windows\debug-kill-build-run.bat"
