# Local: memory Mongo + BE + Admin FE (optional single-store mode)
param(
  [string]$AgentId = $env:NEXT_PUBLIC_STORE_AGENT_ID,
  [string]$StoreId = $env:NEXT_PUBLIC_STORE_STORE_ID
)

$root = Split-Path $PSScriptRoot -Parent
$be = Join-Path $root "packages\lnsms-be"
$fe = Join-Path $root "packages\lnsms-admin-fe"

$env:MONGODB_URI = "memory"
$env:PORT = "40000"

$feEnv = @(
  "`$env:NEXT_PUBLIC_API_URL='http://localhost:40000'",
  "`$env:API_PROXY_TARGET='http://localhost:40000'"
)
if ($AgentId -and $StoreId) {
  $feEnv += "`$env:NEXT_PUBLIC_STORE_AGENT_ID='$AgentId'"
  $feEnv += "`$env:NEXT_PUBLIC_STORE_STORE_ID='$StoreId'"
  Write-Host "Single-store mode: / -> /s/$AgentId/$StoreId/setting"
}

$feCmd = "cd '$fe'; " + ($feEnv -join '; ') + "; npm run dev"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$be'; npm run dev"
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", $feCmd

Write-Host ""
Write-Host "BE  http://localhost:40000/health"
Write-Host "FE  http://localhost:63001"
Write-Host "Platform  http://localhost:63001/platform"
if ($AgentId -and $StoreId) {
  Write-Host "Store  http://localhost:63001/s/$AgentId/$StoreId/setting"
}
