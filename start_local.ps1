[CmdletBinding()]
param(
  [int]$Port = 8687,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$url = "http://localhost:$Port"

function Find-Python {
  foreach ($cmd in @("python", "python3", "py")) {
    $found = Get-Command $cmd -ErrorAction SilentlyContinue
    if ($found) {
      return $found.Source
    }
  }
  return $null
}

$inUse = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($inUse) {
  Write-Host "本機伺服器已在 $url 執行中。" -ForegroundColor Green
  if (-not $NoBrowser) {
    Start-Process $url
  }
  exit 0
}

$python = Find-Python
if (-not $python) {
  Write-Error "找不到 Python，請先安裝 Python 3 後再執行此腳本。"
  exit 1
}

Write-Host "正在啟動 COSMIMERA 本機伺服器：$url" -ForegroundColor Cyan
Write-Host "按 Ctrl+C 可停止伺服器。" -ForegroundColor DarkGray

if (-not $NoBrowser) {
  Start-Job -ScriptBlock {
    param($TargetUrl)
    Start-Sleep -Milliseconds 600
    Start-Process $TargetUrl
  } -ArgumentList $url | Out-Null
}

if ([System.IO.Path]::GetFileNameWithoutExtension($python) -eq "py") {
  & $python -3 -m http.server $Port
} else {
  & $python -m http.server $Port
}
