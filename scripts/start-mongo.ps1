param(
    [string]$RepoRoot = (Split-Path $PSScriptRoot -Parent),
    [int]$Port = 27017
)

$ErrorActionPreference = "Stop"
$data = Join-Path $RepoRoot "data\mongo"
New-Item -ItemType Directory -Force -Path $data | Out-Null

$mongodCmd = Get-Command mongod -ErrorAction SilentlyContinue
$mongod = if ($mongodCmd) { $mongodCmd.Source } else { $null }
if (-not $mongod) {
    $found = Get-ChildItem "C:\Program Files\MongoDB\Server" -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path $_.FullName "bin\mongod.exe" } |
        Where-Object { Test-Path $_ } |
        Sort-Object -Descending |
        Select-Object -First 1
    if ($found) { $mongod = $found }
}
if (-not $mongod) { throw "mongod not found. Install MongoDB Community Server." }

Write-Host "mongod --dbpath $data --port $Port"
Start-Process $mongod -ArgumentList "--dbpath `"$data`" --port $Port" -NoNewWindow -Wait
