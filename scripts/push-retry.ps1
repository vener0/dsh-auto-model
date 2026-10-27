# Push-retry helper for dsh-auto-model.
#
# Retries `git push` (main) and `git push -f` (tag) until the remote tag
# actually points at the local HEAD. GitHub connectivity from some networks is
# flaky; each failed attempt waits IntervalSeconds and tries again.
#
# Usage:
#   pwsh -File scripts/push-retry.ps1
#   pwsh -File scripts/push-retry.ps1 -IntervalSeconds 15
#   pwsh -File scripts/push-retry.ps1 -MaxAttempts 20
#
# Press Ctrl+C to stop.

[CmdletBinding()]
param(
  [string]$Branch = 'main',
  [string]$Tag = 'v3.0.1',
  [int]$IntervalSeconds = 10,
  [int]$MaxAttempts = 0,
  [switch]$SkipMain
)

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function Run-Git {
  param([string[]]$GitArgs)
  $output = (& git @GitArgs 2>&1 | Out-String).Trim()
  $code = $LASTEXITCODE
  return [pscustomobject]@{
    Code = $code
    Output = $output
  }
}

function Get-LocalHead {
  (Run-Git -GitArgs @('rev-parse', 'HEAD')).Output
}

function Get-LocalTagSha {
  (Run-Git -GitArgs @('rev-parse', "refs/tags/$Tag")).Output
}

function Get-RemoteTagSha {
  $result = Run-Git -GitArgs @('ls-remote', '--tags', 'origin', $Tag)
  if ($result.Code -ne 0) { return $null }
  $line = ($result.Output -split "`n" | Where-Object { $_ -match "refs/tags/$([regex]::Escape($Tag))$" } | Select-Object -First 1)
  if ($null -eq $line) { return $null }
  return ($line -split "`t")[0]
}

Write-Host "repo    : $repo"
Write-Host "branch  : $Branch"
Write-Host "tag     : $Tag"
Write-Host "interval: ${IntervalSeconds}s"
Write-Host "attempts: $(if ($MaxAttempts -le 0) { 'until success' } else { $MaxAttempts })"
Write-Host ""

$attempt = 0
while ($true) {
  $attempt++
  $stamp = Get-Date -Format 'HH:mm:ss'
  Write-Host "[$stamp] attempt $attempt" -ForegroundColor Cyan

  $ok = $true

  if (-not $SkipMain) {
    $main = Run-Git -GitArgs @('push', 'origin', $Branch)
    if ($main.Code -ne 0) {
      $ok = $false
      Write-Host "  main push failed" -ForegroundColor Yellow
      Write-Host "  $($main.Output)" -ForegroundColor DarkYellow
    } else {
      Write-Host "  main pushed" -ForegroundColor Green
    }
  }

  if ($ok) {
    $tag = Run-Git -GitArgs @('push', '-f', 'origin', $Tag)
    if ($tag.Code -ne 0) {
      $ok = $false
      Write-Host "  tag push failed" -ForegroundColor Yellow
      Write-Host "  $($tag.Output)" -ForegroundColor DarkYellow
    } else {
      Write-Host "  tag pushed" -ForegroundColor Green
    }
  }

  if ($ok) {
    $local = Get-LocalTagSha
    $head = Get-LocalHead
    $remote = Get-RemoteTagSha
    if ($null -eq $remote) {
      $ok = $false
      Write-Host "  remote tag not found yet" -ForegroundColor Yellow
    } elseif ($remote -ne $local) {
      $ok = $false
      Write-Host "  remote tag mismatch: local tag=$local remote=$remote (will force again)" -ForegroundColor Yellow
    } else {
      Write-Host "  verified: $Tag -> $local" -ForegroundColor Green
      if ($head -ne $local) {
        Write-Host "  note: tag is at $local, HEAD is $head (move the tag if this is a release)" -ForegroundColor DarkYellow
      }
    }
  }

  if ($ok) {
    Write-Host ""
    Write-Host "SUCCESS after $attempt attempt(s)." -ForegroundColor Green
    exit 0
  }

  if ($MaxAttempts -gt 0 -and $attempt -ge $MaxAttempts) {
    Write-Host ""
    Write-Host "Gave up after $attempt attempt(s)." -ForegroundColor Red
    exit 1
  }

  Start-Sleep -Seconds $IntervalSeconds
}
