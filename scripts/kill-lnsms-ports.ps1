# LNSMS 로컬 스택 포트 리스너 완전 종료 (node/mongod/Host)
param(
    [int[]]$Ports = @(27017, 40000, 63001, 58000),
    [int]$Passes = 2
)

$ErrorActionPreference = "SilentlyContinue"

function Stop-PortListeners {
    param([int]$Port)
    $pids = @()
    $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($conns) {
        $pids += $conns | ForEach-Object { $_.OwningProcess } | Where-Object { $_ -gt 0 }
    }
    foreach ($procId in ($pids | Sort-Object -Unique)) {
        Write-Host "[kill] port $Port PID $procId"
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}

for ($i = 1; $i -le $Passes; $i++) {
    Write-Host "--- pass $i ---"
    foreach ($port in $Ports) {
        Stop-PortListeners -Port $port
    }
    if ($i -lt $Passes) { Start-Sleep -Milliseconds 800 }
}

Start-Sleep -Milliseconds 500
foreach ($port in $Ports) {
    $still = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($still) {
        Write-Warning "port $port still listening (PIDs: $(($still.OwningProcess | Sort-Object -Unique) -join ','))"
    } else {
        Write-Host "port $port free"
    }
}
