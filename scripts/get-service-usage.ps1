param(
  [Parameter(Mandatory = $true)]
  [string]$ServiceApiToken,

  [string]$BaseUrl = "https://ai.appverse.id",

  [ValidateSet("24h", "7d", "30d", "60d", "all")]
  [string]$Period = "7d",

  [string]$ApiKeyId,

  [string]$ApiKey,

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
  if ($ApiKeyId -and $ApiKey) {
    throw "Gunakan salah satu saja: -ApiKeyId atau -ApiKey"
  }

  $parsedBase = $null
  if (-not [System.Uri]::TryCreate($BaseUrl, [System.UriKind]::Absolute, [ref]$parsedBase)) {
    throw "BaseUrl tidak valid: $BaseUrl"
  }

  if ($parsedBase.Scheme -notin @("http", "https")) {
    throw "BaseUrl harus menggunakan skema http/https"
  }

  $normalizedBase = $BaseUrl.TrimEnd("/")
  $endpoint = "$normalizedBase/api/service/usage/api-keys"

  $query = @("period=$([System.Uri]::EscapeDataString($Period))")
  if ($ApiKeyId) {
    $query += "apiKeyId=$([System.Uri]::EscapeDataString($ApiKeyId))"
  }
  elseif ($ApiKey) {
    $query += "apiKey=$([System.Uri]::EscapeDataString($ApiKey))"
  }

  $uri = "${endpoint}?" + ($query -join "&")

  $headers = @{
    Authorization = "Bearer $($ServiceApiToken.Trim())"
    "Content-Type" = "application/json"
  }

  $response = Invoke-RestMethod -Uri $uri -Method Get -Headers $headers
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
