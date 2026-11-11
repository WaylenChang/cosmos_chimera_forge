param([string]$Root = 'Art/_incoming/starter_blender_20261111', [string]$TaskId = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$base = (Resolve-Path -LiteralPath $Root).Path
$jobs = Get-Content -LiteralPath (Join-Path $base 'jobs.json') -Raw | ConvertFrom-Json
$font = [System.Drawing.Font]::new('Consolas', 11)
$small = [System.Drawing.Font]::new('Consolas', 9)
$white = [System.Drawing.Brushes]::White
foreach ($job in $jobs) {
    if ($TaskId -and $job.task_id -ne $TaskId) { continue }
    $review = Join-Path $job.output 'review'
    if (-not (Test-Path -LiteralPath (Join-Path $review 'verification.json'))) { continue }
    for ($page=0; $page -lt 2; $page++) {
        $start = $page * 13
        $count = [Math]::Min(13, $job.actions.Count - $start)
        $canvas = [System.Drawing.Bitmap]::new(960, 56 + $count * 160)
        $g = [System.Drawing.Graphics]::FromImage($canvas)
        $g.Clear([System.Drawing.Color]::FromArgb(20,25,35))
        $g.DrawString("$($job.family) / $($job.stage) - every action, 0 / 1/3 / 2/3 / end", $font, $white, 8, 8)
        for ($r=0; $r -lt $count; $r++) {
            $action = $job.actions[$start+$r]
            $y = 48 + $r*160
            $g.DrawString($action.id, $font, $white, 8, $y+50)
            $g.DrawString("$($action.f) frames / 30fps", $small, $white, 8, $y+72)
            for ($col=0; $col -lt 4; $col++) {
                $file = Join-Path $review "motion_frames/$($action.id)_$col.png"
                $img = [System.Drawing.Image]::FromFile($file)
                $g.DrawImage($img, 256+$col*170, $y, 156, 156)
                $img.Dispose()
            }
        }
        $canvas.Save((Join-Path $review "animation_review_$($page+1).png"))
        $g.Dispose(); $canvas.Dispose()
    }
    $canvas = [System.Drawing.Bitmap]::new(1280, 680)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.Clear([System.Drawing.Color]::FromArgb(20,25,35))
    $g.DrawString("$($job.family) / $($job.stage) - source front / model front / side / back | GLB reopened / three-quarter / walk", $small, $white, 8, 8)
    $unit="cr_$($job.subject_id)_$($job.stage)"
    $files = @((Join-Path $job.source_dir "images/$($unit)_front.png"), (Join-Path $job.output "images/$($unit)_model_front.png"), (Join-Path $job.output "images/$($unit)_model_side.png"), (Join-Path $job.output "images/$($unit)_model_back.png"), (Join-Path $review 'glb_reopened.png'), (Join-Path $job.output "images/$($unit)_model_three_quarter.png"), (Join-Path $job.output "images/$($unit)_walk_frame_08.png"))
    for ($i=0; $i -lt $files.Count; $i++) {
        $img=[System.Drawing.Image]::FromFile($files[$i])
        $g.DrawImage($img, ($i%4)*320, 32+[Math]::Floor($i/4)*320, 320, 320)
        $img.Dispose()
    }
    $canvas.Save((Join-Path $review 'appearance_review.png'))
    $g.Dispose(); $canvas.Dispose()
    Write-Output "SHEETS $($job.task_id)"
}
$font.Dispose(); $small.Dispose()
