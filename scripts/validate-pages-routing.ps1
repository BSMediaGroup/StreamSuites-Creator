param(
  [int]$Port = 8793
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stdoutLog = Join-Path $repoRoot "tmp-wrangler-validate.out.log"
$stderrLog = Join-Path $repoRoot "tmp-wrangler-validate.err.log"

if (Test-Path -LiteralPath $stdoutLog) {
  Remove-Item -LiteralPath $stdoutLog -Force
}

if (Test-Path -LiteralPath $stderrLog) {
  Remove-Item -LiteralPath $stderrLog -Force
}

$compatibilityDate = Get-Date -Format "yyyy-MM-dd"
$process = $null

function Invoke-RouteCheck {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [int]$ExpectedStatus,
    [switch]$RejectHtml
  )

  $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port$Path" -SkipHttpErrorCheck
  if ($response.StatusCode -ne $ExpectedStatus) {
    throw "Route $Path returned $($response.StatusCode), expected $ExpectedStatus."
  }

  if ($RejectHtml -and $response.Content -match "<!DOCTYPE html>") {
    throw "Route $Path unexpectedly returned HTML."
  }
}

try {
  $process = Start-Process -FilePath "npx.cmd" -ArgumentList @(
    "wrangler",
    "pages",
    "dev",
    ".",
    "--port",
    $Port,
    "--compatibility-date",
    $compatibilityDate
  ) -WorkingDirectory $repoRoot -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru

  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
    Start-Sleep -Seconds 1
    if ($process.HasExited) {
      throw "wrangler pages dev exited before validation completed."
    }

    try {
      Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -TimeoutSec 2 | Out-Null
      $ready = $true
      break
    } catch {
      continue
    }
  }

  if (-not $ready) {
    throw "Timed out waiting for wrangler pages dev on port $Port."
  }

  Invoke-RouteCheck -Path "/overview" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/integrations/discord" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/platforms/youtube" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/modules/clips" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/definitely-invalid-route" -ExpectedStatus 404
  Invoke-RouteCheck -Path "/js/app.js" -ExpectedStatus 200 -RejectHtml

  Write-Host "Creator Pages routing validation passed on port $Port."
} finally {
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
}
