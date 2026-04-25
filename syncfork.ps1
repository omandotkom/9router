$target = Join-Path $PSScriptRoot 'scripts\sync-upstream.ps1'
if (-not (Test-Path $target)) {
  Write-Error "File tidak ditemukan: $target"
  exit 1
}

& $target @args
