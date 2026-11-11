param([string]$Root='Art/_incoming/starter_v31_20261111')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$base=(Resolve-Path $Root).Path
$jobs=Get-Content (Join-Path $base jobs.json) -Raw -Encoding UTF8 | ConvertFrom-Json
$codec=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$settings=[System.Drawing.Imaging.EncoderParameters]::new(1)
$settings.Param[0]=[System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality,[long]92)
foreach($j in $jobs){
    $target=Join-Path $base "review_jpeg/$($j.task_id)";New-Item -ItemType Directory -Path $target -Force | Out-Null
    foreach($p in Get-ChildItem (Join-Path $j.output review) -Filter *.png){
        if($p.Name.StartsWith('motion_') -and -not $p.Name.StartsWith('motion_page_') -and $p.Name -ne 'motion_diagnostic.png'){continue}
        if($p.Name.StartsWith('_')){continue}
        $im=[System.Drawing.Bitmap]::FromFile($p.FullName)
        $rgb=[System.Drawing.Bitmap]::new($im.Width,$im.Height,[System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
        $g=[System.Drawing.Graphics]::FromImage($rgb);$g.Clear([System.Drawing.Color]::FromArgb(40,47,61));$g.DrawImageUnscaled($im,0,0)
        $rgb.Save((Join-Path $target ($p.BaseName+'.jpg')),$codec,$settings)
        $g.Dispose();$rgb.Dispose();$im.Dispose()
    }
    Write-Output "V31_REVIEW_JPEG $($j.task_id)"
}
$settings.Dispose()
