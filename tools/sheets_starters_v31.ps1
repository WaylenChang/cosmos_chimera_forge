param([string]$Root='Art/_incoming/starter_v31_20261111',[switch]$SkipBase)
$ErrorActionPreference='Stop'
if(-not $SkipBase){& (Join-Path $PSScriptRoot anatomy_v3_sheets.ps1) -Root $Root}
Add-Type -AssemblyName System.Drawing
$base=(Resolve-Path $Root).Path;$jobs=Get-Content (Join-Path $base jobs.json) -Raw -Encoding UTF8 | ConvertFrom-Json
$font=[System.Drawing.Font]::new('Consolas',14)
foreach($job in $jobs){
    $review=Join-Path $job.output review;$clips=(Get-Content (Join-Path $job.output motion_spec.json) -Raw -Encoding UTF8 | ConvertFrom-Json).clips
    $source=[System.Drawing.Bitmap]::FromFile((Join-Path $review motion_review.png))
    for($start=0;$start -lt $clips.Count;$start+=8){
        $count=[math]::Min(8,$clips.Count-$start);$canvas=[System.Drawing.Bitmap]::new(1408,60+$count*335)
        $g=[System.Drawing.Graphics]::FromImage($canvas);$g.Clear([System.Drawing.Color]::FromArgb(21,27,39));$page=[int]($start/8)+1
        $g.DrawString("V3.1 $($job.family) / $($job.stage) | actions $($start+1)-$($start+$count) | side + 3/4",$font,[System.Drawing.Brushes]::White,12,12)
        for($row=0;$row -lt $count;$row++){
            $index=$start+$row;$y=60+$row*335
            $g.DrawString($clips[$index].id,$font,[System.Drawing.Brushes]::White,12,$y)
            $g.DrawImage($source,[System.Drawing.Rectangle]::new(0,$y+30,1408,300),[System.Drawing.Rectangle]::new(0,60+$index*300,1408,300),[System.Drawing.GraphicsUnit]::Pixel)
        }
        $canvas.Save((Join-Path $review "motion_page_$page.png"));$g.Dispose();$canvas.Dispose()
    }
    $source.Dispose();Write-Output "V31_SHEETS $($job.task_id)"
}
$font.Dispose()
