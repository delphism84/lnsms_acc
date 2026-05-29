param(
    [string]$RepoRoot = (Split-Path $PSScriptRoot -Parent),
    [int]$Port = 27017
)

$ErrorActionPreference = "Stop"
$data = Join-Path $RepoRoot "data\mongo"
New-Item -ItemType Directory -Force -Path $data | Out-Null

$mongod = (Get-Command mongod -ErrorAction SilentlyContinue)?.Source
if (-not $mongod) { throw "mongod not in PATH" }

Write-Host "mongod --dbpath $data --port $Port"
Start-Process $mongod -ArgumentList "--dbpath `"$data`" --port $Port" -NoNewWindow -Wait
