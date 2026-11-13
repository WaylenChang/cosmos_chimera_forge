param([string]$Root='Art/_incoming/starter_anatomy_v3_20261111')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$base=(Resolve-Path -LiteralPath $Root).Path
$jobs=Get-Content (Join-Path $base jobs.json) -Raw -Encoding UTF8 | ConvertFrom-Json
$font=[System.Drawing.Font]::new('Consolas',15)
$small=[System.Drawing.Font]::new('Consolas',11)
function Draw-Image($g,$p,[int]$x,[int]$y,[int]$size){
    $im=[System.Drawing.Image]::FromFile($p)
    $g.DrawImage($im,[System.Drawing.Rectangle]::new($x,$y,$size,$size))
    $im.Dispose()
}
foreach($job in $jobs){
    $out=$job.output;$r=Join-Path $out review
    if(-not (Test-Path (Join-Path $out build_report.json))){continue}
    $canvas=[System.Drawing.Bitmap]::new(1536,1690)
    $g=[System.Drawing.Graphics]::FromImage($canvas);$g.Clear([System.Drawing.Color]::FromArgb(21,27,39))
    $g.DrawString("V3 STRUCTURE | $($job.family) / $($job.stage) | PROTOTYPE",$font,[System.Drawing.Brushes]::White,15,14)
    $g.DrawString('Shared framing, eight azimuths + top. Structure review; not final sculpt or textures.',$small,[System.Drawing.Brushes]::LightGray,15,46)
    $names=@('000','045','090','135','180','225','270','315','top')
    for($i=0;$i -lt 9;$i++){
        $x=($i%3)*512;$y=80+[math]::Floor($i/3)*536
        Draw-Image $g (Join-Path $r "view_$($names[$i]).png") $x $y 512
        $g.DrawString($names[$i],$small,[System.Drawing.Brushes]::White,($x+12),($y+512))
    }
    $canvas.Save((Join-Path $r volume_review.png));$g.Dispose();$canvas.Dispose()
    $canvas=[System.Drawing.Bitmap]::new(1536,1170)
    $g=[System.Drawing.Graphics]::FromImage($canvas);$g.Clear([System.Drawing.Color]::FromArgb(21,27,39))
    $g.DrawString("V3 ANATOMY / WING VOLUME | $($job.family) / $($job.stage)",$font,[System.Drawing.Brushes]::White,15,14)
    $bare=@('front','side','back','top')
    for($i=0;$i -lt 4;$i++){
        $x=($i%3)*512;$y=65+[math]::Floor($i/3)*548
        Draw-Image $g (Join-Path $r "bare_$($bare[$i]).png") $x $y 512
        $g.DrawString("Bare $($bare[$i])",$small,[System.Drawing.Brushes]::White,($x+12),($y+512))
    }
    if(Test-Path (Join-Path $r open_side.png)){
        Draw-Image $g (Join-Path $r open_side.png) 512 613 512
        Draw-Image $g (Join-Path $r open_top.png) 1024 613 512
        $g.DrawString('Open wing / side',$small,[System.Drawing.Brushes]::White,524,1125)
        $g.DrawString('Open wing / top',$small,[System.Drawing.Brushes]::White,1036,1125)
    }
    $canvas.Save((Join-Path $r anatomy_review.png));$g.Dispose();$canvas.Dispose()
    $motion=Get-Content (Join-Path $out motion_spec.json) -Raw -Encoding UTF8 | ConvertFrom-Json
    $h=60+$motion.clips.Count*300;$canvas=[System.Drawing.Bitmap]::new(1408,$h)
    $g=[System.Drawing.Graphics]::FromImage($canvas);$g.Clear([System.Drawing.Color]::FromArgb(21,27,39))
    $g.DrawString("V3 MOTION PROTOTYPES | $($job.family) / $($job.stage) | side + 3/4",$font,[System.Drawing.Brushes]::White,15,14)
    $row=0
    foreach($clip in $motion.clips){
        $y=60+$row*300
        $g.DrawString($clip.action,$small,[System.Drawing.Brushes]::White,10,$y)
        $g.DrawString("$($clip.frames)f",$small,[System.Drawing.Brushes]::LightGray,10,($y+22))
        foreach($view in @('side','quarter')){
            $vy=$y+$(if($view -eq 'side'){0}else{144})
            for($i=0;$i -lt 8;$i++){Draw-Image $g (Join-Path $r "motion_$($clip.action)_$($view)_$i.png") (128+$i*160) $vy 144}
        }
        $row++
    }
    $canvas.Save((Join-Path $r motion_review.png));$g.Dispose();$canvas.Dispose()
    Write-Output "SHEETS $($job.task_id)"
}
$font.Dispose();$small.Dispose()
