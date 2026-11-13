param([string]$Root='Art/_incoming/starter_anatomy_v3_20261111')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$base=(Resolve-Path $Root).Path
$f=[System.Drawing.Font]::new('Consolas',15)
$small=[System.Drawing.Font]::new('Consolas',11)
$canvas=[System.Drawing.Bitmap]::new(1200,1150)
$g=[System.Drawing.Graphics]::FromImage($canvas)
$g.Clear([System.Drawing.Color]::FromArgb(21,27,39))
$g.DrawString('V3 SPECIES STRUCTURE | side / 3D volume / actual rig',$f,[System.Drawing.Brushes]::White,15,15)
$g.DrawString('Design prototypes. Final sculpt, materials and performance remain unfinished.',$small,[System.Drawing.Brushes]::LightGray,15,45)
$families=@('sun','moon','star');$codes=@('a111','b111','c111')
for($r=0;$r -lt 3;$r++){
    for($c=0;$c -lt 3;$c++){
        $name=@('view_090.png','view_045.png','rig_side.png')[$c]
        $p=Join-Path $base "mdl-20261111-$($codes[$r])-1302/review/$name"
        $im=[System.Drawing.Image]::FromFile($p)
        $g.DrawImage($im,[System.Drawing.Rectangle]::new($c*400+40,80+$r*350,320,320))
        $g.DrawString("$($families[$r]) / $name",$small,[System.Drawing.Brushes]::White,($c*400+10),(400+$r*350))
        $im.Dispose()
    }
}
$canvas.Save((Join-Path $base v3_adult_structure_preview.png));$g.Dispose();$canvas.Dispose()
$jobs=Get-Content (Join-Path $base jobs.json) -Raw -Encoding UTF8 | ConvertFrom-Json
$canvas=[System.Drawing.Bitmap]::new(1440,1210);$g=[System.Drawing.Graphics]::FromImage($canvas)
$g.Clear([System.Drawing.Color]::FromArgb(21,27,39))
$g.DrawString('V3 | 12 ANATOMICAL STRUCTURE STUDIES | NOT FINAL ART',$f,[System.Drawing.Brushes]::White,15,14)
for($i=0;$i -lt 12;$i++){
    $j=$jobs[$i];$im=[System.Drawing.Image]::FromFile((Join-Path $j.output review/view_045.png))
    $x=($i%4)*360;$y=60+[math]::Floor($i/4)*380
    $g.DrawImage($im,[System.Drawing.Rectangle]::new($x+5,$y,350,350))
    $g.DrawString("$($j.family) / $($j.stage)",$small,[System.Drawing.Brushes]::White,($x+10),($y+350));$im.Dispose()
}
$canvas.Save((Join-Path $base v3_12_forms_overview.png));$g.Dispose();$canvas.Dispose();$f.Dispose();$small.Dispose()
