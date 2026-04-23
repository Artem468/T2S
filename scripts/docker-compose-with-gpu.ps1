# Docker compose: use NVIDIA GPU overlay when nvidia-smi works; else CPU-only base compose.
# Use ASCII-only messages so Windows PowerShell 5.1 does not misparse the file encoding.
$ErrorActionPreference = "SilentlyContinue"
$repoRoot = Split-Path -Parent $PSScriptRoot
$base = Join-Path $repoRoot "docker-compose.yml"
$gpuFile = Join-Path $repoRoot "docker-compose.gpu.yml"

$useGpu = $false
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    nvidia-smi -L 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $useGpu = $true }
}

if ($useGpu) {
    Write-Host "[compose] NVIDIA GPU detected, using docker-compose.gpu.yml" -ForegroundColor Green
    docker compose -f $base -f $gpuFile @args
}
else {
    Write-Host "[compose] No NVIDIA GPU or nvidia-smi unavailable, CPU-only (base compose only)" -ForegroundColor Yellow
    docker compose -f $base @args
}
exit $LASTEXITCODE
