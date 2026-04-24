param(
  [Parameter(Mandatory = $true)]
  [string]$ServiceApiToken,

  [Parameter(Mandatory = $true)]
  [string]$Name,

  [string]$BaseUrl = "https://ai.appverse.id",

  [switch]$IncludeQuota,

  [bool]$QuotaEnabled = $true,

  [int]$QuotaLimit = 500000,

  [ValidateSet("daily", "monthly", "total")]
  [string]$QuotaPeriod = "monthly",

  [switch]$NoPause
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Pause-BeforeExit {
  if ($NoPause) {
    return
  }
  Write-Host ""
  Write-Host "Tekan Enter untuk menutup..." -ForegroundColor Cyan
  Read-Host | Out-Null
}

function Get-ErrorInfo {
  param([Parameter(Mandatory = $true)] [System.Management.Automation.ErrorRecord]$ErrorRecord)

  $statusCode = $null
  $responseBody = $null
  $resp = $ErrorRecord.Exception.Response

  if ($resp) {
    try {
      if ($resp -is [System.Net.HttpWebResponse]) {
        $statusCode = [int]$resp.StatusCode
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        $reader.Close()
      }
      elseif ($resp -is [System.Net.Http.HttpResponseMessage]) {
        $statusCode = [int]$resp.StatusCode
        $responseBody = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
      }
      elseif ($resp.StatusCode) {
        $statusCode = [int]$resp.StatusCode
      }
    }
    catch {
      $responseBody = $null
    }
  }

  if (-not $responseBody) {
    $responseBody = $ErrorRecord.Exception.Message
  }

  return @{
    StatusCode = $statusCode
    ResponseBody = $responseBody
  }
}

try {
  $trimmedName = $Name.Trim()
  if ([string]::IsNullOrWhiteSpace($trimmedName)) {
    throw "Parameter -Name wajib diisi."
  }

  $parsedBase = $null
  if (-not [System.Uri]::TryCreate($BaseUrl, [System.UriKind]::Absolute, [ref]$parsedBase)) {
    throw "BaseUrl tidak valid: $BaseUrl"
  }

  if ($parsedBase.Scheme -notin @("http", "https")) {
    throw "BaseUrl harus menggunakan skema http/https"
  }

  $normalizedBase = $BaseUrl.TrimEnd("/")
  $endpoint = "$normalizedBase/api/service/keys"

  $headers = @{
    Authorization = "Bearer $($ServiceApiToken.Trim())"
    "Content-Type" = "application/json"
  }

  $payload = @{
    name = $trimmedName
  }

  if ($IncludeQuota) {
    $payload.quota = @{
      enabled = $QuotaEnabled
      limit = $QuotaLimit
      period = $QuotaPeriod
    }
  }

  $body = $payload | ConvertTo-Json -Depth 8
  $response = Invoke-RestMethod -Uri $endpoint -Method Post -Headers $headers -Body $body
  $response | ConvertTo-Json -Depth 10
}
catch {
  $errorInfo = Get-ErrorInfo -ErrorRecord $_

  Write-Host "Request failed." -ForegroundColor Red
  if ($errorInfo.StatusCode -ne $null) {
    Write-Host "Status: $($errorInfo.StatusCode)" -ForegroundColor Yellow
  }
  if ($errorInfo.ResponseBody) {
    Write-Host "Response: $($errorInfo.ResponseBody)" -ForegroundColor Yellow
  }
  Pause-BeforeExit
  exit 1
}

Pause-BeforeExit
