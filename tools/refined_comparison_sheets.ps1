param([string]$Root='Art/_incoming/starter_refined_20261111',[string]$TaskId='')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$base=(Resolve-Path -LiteralPath $Root).Path
$jobs=Get-Content (Join-Path $base jobs.json) -Raw -Encoding UTF8 | ConvertFrom-Json
$baseline=(Resolve-Path Art/_incoming/starter_blender_20261111).Path
$font=[System.Drawing.Font]::new('Consolas',14)
$small=[System.Drawing.Font]::new('Consolas',10)
function Get-SubjectRect([System.Drawing.Bitmap]$Image,[bool]$Alpha){
    $left=$Image.Width;$top=$Image.Height;$right=0;$bottom=0
    for($y=0;$y -lt $Image.Height;$y+=5){
        for($x=0;$x -lt $Image.Width;$x+=5){
            $c=$Image.GetPixel($x,$y)
            $max=[Math]::Max($c.R,[Math]::Max($c.G,$c.B));$min=[Math]::Min($c.R,[Math]::Min($c.G,$c.B))
            $foreground=if($Alpha){$c.A -gt 30}else{($max-$min -gt 22) -or ($min -gt 175) -or ($max -lt 55)}
            if($foreground){$left=[Math]::Min($left,$x);$right=[Math]::Max($right,$x);$top=[Math]::Min($top,$y);$bottom=[Math]::Max($bottom,$y)}
        }
    }
    if($right -le $left){return [System.Drawing.Rectangle]::new(0,0,$Image.Width,$Image.Height)}
    $left=[Math]::Max(0,$left-9);$top=[Math]::Max(0,$top-9)
    return [System.Drawing.Rectangle]::new($left,$top,[Math]::Min($Image.Width-$left,$right-$left+18),[Math]::Min($Image.Height-$top,$bottom-$top+18))
}
function Draw-Fit($Graphics,$Image,$Rect,[int]$X,[int]$Y,[int]$W,[int]$H){
    $scale=[Math]::Min($W/$Rect.Width,$H/$Rect.Height)
    $dw=[int]($Rect.Width*$scale);$dh=[int]($Rect.Height*$scale)
    $dest=[System.Drawing.Rectangle]::new([int]($X+($W-$dw)/2),[int]($Y+$H-$dh),$dw,$dh)
    $Graphics.DrawImage($Image,$dest,$Rect,[System.Drawing.GraphicsUnit]::Pixel)
}
function Get-ViewCuts([System.Drawing.Bitmap]$Image){
    $cuts=@(0)
    for($boundary=1;$boundary -lt 4;$boundary++){
        $expected=$boundary*$Image.Width/4;$best=100000;$cut=[int]$expected;$distance=100000
        for($x=[int]($expected-$Image.Width*.08);$x -le [int]($expected+$Image.Width*.08);$x+=2){
            $score=0
            for($y=0;$y -lt $Image.Height;$y+=6){
                $c=$Image.GetPixel($x,$y);$max=[Math]::Max($c.R,[Math]::Max($c.G,$c.B));$min=[Math]::Min($c.R,[Math]::Min($c.G,$c.B))
                if(($max-$min -gt 22) -or ($min -gt 175) -or ($max -lt 55)){$score++}
            }
            if(($score -lt $best) -or (($score -eq $best) -and ([Math]::Abs($x-$expected) -lt $distance))){$best=$score;$cut=$x;$distance=[Math]::Abs($x-$expected)}
        }
        $cuts+=,$cut
    }
    return $cuts+@($Image.Width)
}
foreach($job in $jobs){
    if($TaskId -and $job.task_id -ne $TaskId){continue}
    $review=Join-Path $job.output review
    if(-not (Test-Path (Join-Path $review glb_back.png))){continue}
    $unit="cr_$($job.subject_id)_$($job.stage)"
    $sheet=[System.Drawing.Bitmap]::new(1200,1450)
    $g=[System.Drawing.Graphics]::FromImage($sheet);$g.Clear([System.Drawing.Color]::FromArgb(27,33,47))
    $g.DrawString("$($job.family) / $($job.stage) | front / side / back",$font,[System.Drawing.Brushes]::White,10,8)
    $g.DrawString('Original concept / refined GLB reimport / previous model. Views fitted separately.',$small,[System.Drawing.Brushes]::White,10,32)
    $turn=[System.Drawing.Bitmap]::FromFile((Join-Path $job.source_dir "images/$($unit)_turnaround.png"))
    $cuts=Get-ViewCuts $turn
    for($col=0;$col -lt 3;$col++){
        if($col -eq 0){$img=[System.Drawing.Bitmap]::FromFile((Join-Path $job.source_dir "images/$($unit)_front.png"))}
        else{
            $section=[System.Drawing.Rectangle]::new($cuts[$col],0,($cuts[$col+1]-$cuts[$col]),$turn.Height)
            $img=$turn.Clone($section,$turn.PixelFormat)
        }
        $rect=Get-SubjectRect $img $false
        Draw-Fit $g $img $rect ($col*400+12) 62 376 420
        $g.DrawString('Original '+@('front','side','back')[$col],$small,[System.Drawing.Brushes]::White,($col*400+12),486)
        $img.Dispose()
        $kind=@('front','side','back')[$col]
        $img=[System.Drawing.Bitmap]::FromFile((Join-Path $review "glb_$kind.png"))
        $rect=Get-SubjectRect $img $true
        Draw-Fit $g $img $rect ($col*400+12) 516 376 420
        $g.DrawString('Refined GLB '+$kind,$small,[System.Drawing.Brushes]::White,($col*400+12),940)
        $img.Dispose()
        $img=[System.Drawing.Bitmap]::FromFile((Join-Path $baseline "$($job.task_id)/images/$($unit)_model_$kind.png"))
        $rect=[System.Drawing.Rectangle]::new(0,0,$img.Width,$img.Height)
        Draw-Fit $g $img $rect ($col*400+12) 972 376 420
        $g.DrawString('Previous model '+$kind,$small,[System.Drawing.Brushes]::White,($col*400+12),1398)
        $img.Dispose()
    }
    $turn.Dispose();$sheet.Save((Join-Path $review reference_front_side_back.png));$g.Dispose();$sheet.Dispose()
    Write-Output "COMPARISON $($job.task_id)"
}
$font.Dispose();$small.Dispose()
