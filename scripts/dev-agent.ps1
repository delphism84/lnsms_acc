# C# Host 없이 로컬 스택만 기동 (mongod + lnsms-be + admin-fe)
param(
    [string]$RepoRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$AgentId = "a1",
    [string]$StoreId = "s1",
    [switch]$SkipMongo,
    [switch]$NoKill
)

$ErrorActionPreference = "Stop"
$mongoData = Join-Path $RepoRoot "data\mongo"
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
    $killScript = Join-Path (Split-Path $PSScriptRoot -Parent) "scripts\kill-lnsms-ports.ps1"
    & $killScript -Ports @(27017, 40000, 63001)
}

if (-not $SkipMongo) {
    New-Item -ItemType Directory -Force -Path $mongoData | Out-Null
    $mongodCmd = Get-Command mongod -ErrorAction SilentlyContinue
    $mongod = if ($mongodCmd) { $mongodCmd.Source } else { $null }
    if (-not $mongod) {
        $candidates = @(
            "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe",
            "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe"
        )
        $mongod = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    }
    if (-not $mongod) { throw "mongod not found. Install MongoDB Community or set PATH / use Host with mongoFallbackToMemory." }
    Start-Process $mongod -ArgumentList "--dbpath `"$mongoData`" --port 27017" -WindowStyle Hidden
    Write-Host "mongod -> $mongoData"
    Start-Sleep -Seconds 2
    $mongoUri = "mongodb://127.0.0.1:27017/lnsms"
} else {
    $mongoUri = "memory"
}

$env:PORT = "40000"
$env:MONGODB_URI = $mongoUri
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$be'; npm run dev"

Start-Sleep -Seconds 2

$feCmd = @(
    "cd '$fe'",
    "`$env:NEXT_PUBLIC_API_URL='http://127.0.0.1:40000'",
    "`$env:API_PROXY_TARGET='http://127.0.0.1:40000'",
    "`$env:NEXT_PUBLIC_STORE_AGENT_ID='$AgentId'",
    "`$env:NEXT_PUBLIC_STORE_STORE_ID='$StoreId'",
    "npm run dev"
) -join "; "

Start-Process powershell -ArgumentList "-NoExit", "-Command", $feCmd

Write-Host ""
Write-Host "BE   http://127.0.0.1:40000/health"
Write-Host "FE   http://127.0.0.1:63001"
Write-Host "Store http://127.0.0.1:63001/s/$AgentId/$StoreId/setting"
Write-Host "Agent Host (58000)는 packages\agent-host 를 F5로 실행하세요."
