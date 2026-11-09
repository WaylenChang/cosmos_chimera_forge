# ==============================================================================
# 宙獸紀 · COSMIMERA · 美術交付包一鍵解壓工具 (unpack_incoming.ps1)
# ==============================================================================
# 規格：無論立繪 (chr-*, cr-*) 或 3D (mdl-*, anim-*)，審查檔案均存放在本專案 (Art/_incoming/)。
#   - 預設模式：解壓至本專案 (Art/_incoming/<task_id>/) 供成果審查台進行 2D/3D 檢閱與覆核。
#   - 交付模式 (-DeployToGame)：審查核可後，直接解壓/部署至主遊戲專案 (cosmos_chimera/Art/_incoming/<task_id>/)。
#
# 使用方式：
#   powershell unpack_incoming.ps1                                # 解壓所有交付包至本專案審查區
#   powershell unpack_incoming.ps1 -Pattern "mdl-*"               # 僅解壓 3D 交付包至本專案
#   powershell unpack_incoming.ps1 -DeployToGame                  # 審查通過，直接解壓部署至 cosmos_chimera
#   powershell unpack_incoming.ps1 -Pattern "mdl-*" -DeployToGame # 部署特定交付包至 cosmos_chimera
# ==============================================================================

[CmdletBinding()]
param(
    [string]$SourceDir = "",
    [string]$DestDir = "",
    [string]$ZipPath = "",
    [string]$Pattern = "*",
    [switch]$DeployToGame,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# 1. 決定來源審查目錄（本專案 Art\_incoming）
$ForgeRoot = $PSScriptRoot
if (-not $SourceDir) {
    $DefaultIncoming = Join-Path $ForgeRoot "Art\_incoming"
    if (Test-Path $DefaultIncoming) {
        $SourceDir = $DefaultIncoming
    } elseif (Test-Path (Join-Path $HOME "Downloads")) {
        $SourceDir = Join-Path $HOME "Downloads"
    } else {
        $SourceDir = $ForgeRoot
    }
}

# 2. 決定解壓目標目錄：
#    - 預設解壓至本專案 (Art/_incoming/<task_id>/) 供本地審查
#    - 若指定 -DeployToGame 或指定 -DestDir，才輸出至 cosmos_chimera
if (-not $DestDir) {
    if ($DeployToGame) {
        $Candidate1 = Join-Path $ForgeRoot "..\cosmos_chimera\Art\_incoming"
        $Candidate2 = "C:\Users\user\Documents\app\cosmos_chimera\Art\_incoming"
        if (Test-Path (Join-Path $ForgeRoot "..\cosmos_chimera")) {
            $DestRepo = (Resolve-Path (Join-Path $ForgeRoot "..\cosmos_chimera")).Path
            $DestDir = Join-Path $DestRepo "Art\_incoming"
        } elseif (Test-Path "C:\Users\user\Documents\app\cosmos_chimera") {
            $DestDir = $Candidate2
        } else {
            $DestDir = Join-Path $ForgeRoot "..\cosmos_chimera\Art\_incoming"
        }
    } else {
        $DestDir = Join-Path $ForgeRoot "Art\_incoming"
    }
}

if (-not (Test-Path $DestDir)) {
    New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

# 收集目標 Zip 檔案清單
$TargetZips = @()

if ($ZipPath -and (Test-Path $ZipPath)) {
    $TargetZips += Get-Item $ZipPath
} else {
    $ValidPrefixes = @("mdl-", "chr-", "cr-", "fx-", "vsl-", "anim-")
    $AllZips = Get-ChildItem -Path $SourceDir -Filter "*.zip" -ErrorAction SilentlyContinue
    if (($AllZips.Count -eq 0) -and ($SourceDir -ne $ForgeRoot)) {
        $AllZips = Get-ChildItem -Path $ForgeRoot -Filter "*.zip" -ErrorAction SilentlyContinue
    }
    foreach ($z in $AllZips) {
        $name = $z.BaseName
        $isMatch = $false
        foreach ($prefix in $ValidPrefixes) {
            if ($name.StartsWith($prefix)) {
                $isMatch = $true
                break
            }
        }
        if ($isMatch -and ($z.Name -like $Pattern -or $name -like $Pattern)) {
            $TargetZips += $z
        }
    }
}

if ($TargetZips.Count -eq 0) {
    Write-Host "[INFO] 在 '$SourceDir' 未找到符合格式的美術/3D 交付包 (mdl-*, chr-*, cr-*, fx-*, vsl-*)" -ForegroundColor Yellow
    exit 0
}

$TargetLabel = if ($DeployToGame) { "主遊戲專案 (cosmos_chimera)" } else { "本專案審查目錄 (cosmos_chimera_forge)" }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " COSMIMERA · 交付包解壓工具" -ForegroundColor Cyan
Write-Host " 來源目錄: $SourceDir" -ForegroundColor DarkGray
Write-Host " 目標專案: $TargetLabel" -ForegroundColor DarkGray
Write-Host " 目標目錄: $DestDir" -ForegroundColor DarkGray
Write-Host "==========================================================" -ForegroundColor Cyan

$SuccessCount = 0

foreach ($zip in $TargetZips) {
    $taskId = $zip.BaseName
    Write-Host ""
    Write-Host "[ZIP] 正在處理: $($zip.Name)" -ForegroundColor White

    $zipArchive = [System.IO.Compression.ZipFile]::OpenRead($zip.FullName)
    try {
        $hasTopDir = $false
        foreach ($entry in $zipArchive.Entries) {
            if ($entry.FullName.StartsWith("$taskId/") -or $entry.FullName.StartsWith("$taskId\")) {
                $hasTopDir = $true
                break
            }
        }

        $destTaskDir = Join-Path $DestDir $taskId
        if (-not (Test-Path $destTaskDir)) {
            New-Item -ItemType Directory -Path $destTaskDir -Force | Out-Null
        }

        foreach ($entry in $zipArchive.Entries) {
            if ($entry.FullName.EndsWith("/") -or $entry.FullName.EndsWith("\")) {
                continue
            }

            $relPath = $entry.FullName
            if ($hasTopDir) {
                $relPath = $relPath.Substring($taskId.Length).TrimStart('/', '\')
            }

            $targetFilePath = Join-Path $destTaskDir $relPath
            $targetSubDir = [System.IO.Path]::GetDirectoryName($targetFilePath)
            if (-not (Test-Path $targetSubDir)) {
                New-Item -ItemType Directory -Path $targetSubDir -Force | Out-Null
            }

            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $targetFilePath, $true)
        }

        $manifestPath = Join-Path $destTaskDir "manifest.json"
        if (Test-Path $manifestPath) {
            Write-Host "  [OK] 解壓完成: $destTaskDir (含 manifest.json)" -ForegroundColor Green
            if ($DeployToGame) {
                Write-Host "  [VALIDATE] 驗收指令 (在 cosmos_chimera 目錄執行): python tools/validate_art.py Art/_incoming/$taskId --apply" -ForegroundColor DarkCyan
            } else {
                Write-Host "  [REVIEW] 可在成果審查台進行檢閱；審查通過後可部署至 cosmos_chimera" -ForegroundColor DarkCyan
            }
        } else {
            Write-Host "  [WARN] 解壓完成但未發現 manifest.json: $destTaskDir" -ForegroundColor Yellow
        }

        $SuccessCount++
    }
    catch {
        Write-Host "  [ERROR] 解壓失敗 $($zip.Name): $_" -ForegroundColor Red
    }
    finally {
        $zipArchive.Dispose()
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 完成！共解壓 $SuccessCount 個交付包至 $DestDir" -ForegroundColor Green
if ($DeployToGame) {
    Write-Host " 請切換至 cosmos_chimera 專案目錄執行資產驗收：" -ForegroundColor DarkGray
    Write-Host "   python tools/validate_art.py Art/_incoming/<task_id> --apply" -ForegroundColor White
} else {
    Write-Host " 可在成果審查台開啟檢視，或執行以下指令將已審查成果交付至 cosmos_chimera：" -ForegroundColor DarkGray
    Write-Host "   powershell unpack_incoming.ps1 -DeployToGame" -ForegroundColor White
}
Write-Host "==========================================================" -ForegroundColor Cyan
