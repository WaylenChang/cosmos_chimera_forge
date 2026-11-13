param([string]$Root='Art/_incoming/starter_v32_20261111')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$jobs=Get-Content (Join-Path $Root jobs.json) -Raw -Encoding UTF8 | ConvertFrom-Json
$font=[System.Drawing.Font]::new('Consolas',14)
foreach($j in $jobs){
 $r=Join-Path $j.output review;$clips=@((Get-Content (Join-Path $j.output motion_spec.json) -Raw -Encoding UTF8 | ConvertFrom-Json).clips)
 $indices=@();for($i=0;$i -lt $clips.Count;$i++){if(($clips[$i].action -in @('canonical_run','canonical_faint','canonical_atk_melee_front','canonical_victory')) -or $clips[$i].action -eq 'wing_fold'){$indices+=,$i}}
 $source=[System.Drawing.Bitmap]::FromFile((Join-Path $r motion_review.png));$canvas=[System.Drawing.Bitmap]::new(1408,60+$indices.Count*335);$g=[System.Drawing.Graphics]::FromImage($canvas);$g.Clear([System.Drawing.Color]::FromArgb(21,27,39))
 $g.DrawString("V3.2 $($j.family) / $($j.stage) | diagnostic poses, side + quarter",$font,[System.Drawing.Brushes]::White,12,12)
 for($row=0;$row -lt $indices.Count;$row++){$i=$indices[$row];$y=60+$row*335;$g.DrawString($clips[$i].id,$font,[System.Drawing.Brushes]::White,12,$y);$g.DrawImage($source,[System.Drawing.Rectangle]::new(0,$y+30,1408,300),[System.Drawing.Rectangle]::new(0,60+$i*300,1408,300),[System.Drawing.GraphicsUnit]::Pixel)}
 $canvas.Save((Join-Path $r motion_diagnostic.png));$g.Dispose();$canvas.Dispose();$source.Dispose()
}
$font.Dispose()
