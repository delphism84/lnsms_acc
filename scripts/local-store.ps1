# Local: memory Mongo + BE + Admin FE (greenfield necall.guest)
param(
  [string]$Userid = "necall",
  [string]$StoreId = "guest"
)

$root = Split-Path $PSScriptRoot -Parent
$be = Join-Path $root "packages\lnsms-be"
$fe = Join-Path $root "packages\lnsms-admin-fe"
$uploadDir = Join-Path $root "data\uploads"

New-Item -ItemType Directory -Force -Path $uploadDir | Out-Null

$env:MONGODB_URI = "memory"
$env:PORT = "40000"
$env:LOCAL_GUEST_PASSWORD = "guest"
$env:UPLOAD_DIR = $uploadDir

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

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$be'; npm run dev"
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", $feCmd

Write-Host ""
Write-Host "BE  http://127.0.0.1:40000/health"
Write-Host "FE  http://127.0.0.1:63001"
Write-Host "Store  http://127.0.0.1:63001/s/$Userid/$StoreId/setting"
Write-Host "Platform  http://127.0.0.1:63001/platform"
