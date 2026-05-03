param(
  [string]$UpstreamRemote = "upstream",
  [string]$OriginRemote = "origin",
  [string]$MirrorBranch = "master",
  [string]$DeployBranch = "appverse-ai",
  [string]$UpstreamUrl,
  [switch]$Apply,
  [switch]$NoPush,
  [switch]$AllowDirty,
  [switch]$NoPause,
  [switch]$RunBuild,
  [switch]$RunTests,
  [string]$BuildCommand = "npm run build",
  [string]$TestCommand = "npm test"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Pause-BeforeExit {
  if ($NoPause) { return }
  Write-Host ""
  Write-Host "Tekan Enter untuk menutup..." -ForegroundColor Cyan
  Read-Host | Out-Null
}

function Run-Step {
  param(
    [Parameter(Mandatory = $true)] [string]$Description,
    [Parameter(Mandatory = $true)] [string]$Command
  )

  Write-Host "`n==> $Description" -ForegroundColor Cyan
  Write-Host "    $Command" -ForegroundColor DarkGray

  if (-not $Apply) {
    Write-Host "    [dry-run] skipped" -ForegroundColor Yellow
    return
  }

  Invoke-Expression $Command
}

function Ensure-GitAvailable {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "git command tidak ditemukan di PATH."
  }
}

function Ensure-CommandAvailable {
  param([Parameter(Mandatory = $true)] [string]$CommandName)

  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Command '$CommandName' tidak ditemukan di PATH."
  }
}

function Ensure-CleanWorkingTree {
  if ($AllowDirty) {
    return
  }

  $statusOutput = git status --porcelain
  if ($LASTEXITCODE -ne 0) {
    throw "Gagal membaca git status."
  }

  if (-not [string]::IsNullOrWhiteSpace(($statusOutput -join "`n"))) {
    throw "Working tree tidak clean. Commit/stash dulu atau gunakan -AllowDirty."
  }
}

function Remote-Exists {
  param([Parameter(Mandatory = $true)] [string]$RemoteName)
  $null = git remote get-url $RemoteName 2>$null
  return ($LASTEXITCODE -eq 0)
}

function Ensure-Remote {
  param(
    [Parameter(Mandatory = $true)] [string]$RemoteName,
    [string]$RemoteUrl
  )

  if (Remote-Exists -RemoteName $RemoteName) {
    return
  }

  if ([string]::IsNullOrWhiteSpace($RemoteUrl)) {
    throw "Remote '$RemoteName' belum ada. Isi -UpstreamUrl untuk menambah remote otomatis."
  }

  Run-Step "Add missing remote '$RemoteName'" "git remote add $RemoteName $RemoteUrl"
}

function Ensure-LocalBranch {
  param([Parameter(Mandatory = $true)] [string]$BranchName)
  git show-ref --verify --quiet "refs/heads/$BranchName"
  if ($LASTEXITCODE -ne 0) {
    throw "Local branch '$BranchName' tidak ditemukan."
  }
}

$originalBranch = $null

try {
  Ensure-GitAvailable

  if ($RunBuild -or $RunTests) {
    Ensure-CommandAvailable -CommandName "npm"
  }

  Ensure-CleanWorkingTree

  $originalBranch = (git rev-parse --abbrev-ref HEAD).Trim()
  if ([string]::IsNullOrWhiteSpace($originalBranch)) {
    throw "Tidak bisa mendeteksi branch aktif saat ini."
  }

  Ensure-Remote -RemoteName $OriginRemote
  Ensure-Remote -RemoteName $UpstreamRemote -RemoteUrl $UpstreamUrl

  Ensure-LocalBranch -BranchName $MirrorBranch
  Ensure-LocalBranch -BranchName $DeployBranch

  Run-Step "Fetch latest from '$UpstreamRemote'" "git fetch $UpstreamRemote"
  Run-Step "Checkout mirror branch '$MirrorBranch'" "git checkout $MirrorBranch"
  Run-Step "Reset '$MirrorBranch' to '$UpstreamRemote/$MirrorBranch'" "git reset --hard $UpstreamRemote/$MirrorBranch"

  if (-not $NoPush) {
    Run-Step "Push mirror '$MirrorBranch' to '$OriginRemote'" "git push --force-with-lease $OriginRemote $MirrorBranch"
  }

  Run-Step "Checkout deploy branch '$DeployBranch'" "git checkout $DeployBranch"
  Run-Step "Merge '$MirrorBranch' into '$DeployBranch'" "git merge $MirrorBranch"

  if ($RunBuild) {
    Run-Step "Run build validation" $BuildCommand
  }

  if ($RunTests) {
    Run-Step "Run test validation" $TestCommand
  }

  if (-not $NoPush) {
    Run-Step "Push deploy '$DeployBranch' to '$OriginRemote'" "git push $OriginRemote $DeployBranch"
  }

  if (-not $Apply) {
    Write-Host "`nDry-run selesai. Tambahkan -Apply untuk eksekusi nyata." -ForegroundColor Green
  }
  else {
    Write-Host "`nSinkronisasi selesai." -ForegroundColor Green
  }
}
catch {
  Write-Host "`nGagal: $($_.Exception.Message)" -ForegroundColor Red
  if ($Apply -and $originalBranch) {
    Write-Host "Mencoba kembali ke branch awal '$originalBranch'..." -ForegroundColor Yellow
    git checkout $originalBranch | Out-Null
  }
  Pause-BeforeExit
  exit 1
}

Pause-BeforeExit
