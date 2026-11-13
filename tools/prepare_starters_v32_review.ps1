param([string]$Root='Art/_incoming/starter_v32_20261111')
$ErrorActionPreference='Stop'
$base=(Resolve-Path $Root).Path;$jobs=Get-Content (Join-Path $base jobs.json) -Raw -Encoding UTF8 | ConvertFrom-Json
$limit=(Get-Date).AddMinutes(40)
while($true){
 $ready=$true
 foreach($j in $jobs){
  $models=@(Get-ChildItem (Join-Path $j.output models) -File -ErrorAction SilentlyContinue | Where-Object Extension -in @('.glb','.blend'))
  if($models.Count -ne 2){$ready=$false;break}
  $latest=($models | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1).LastWriteTimeUtc
  foreach($n in @('structure_verification.json','material_front.png','material_side.png','material_back.png','material_quarter.png','rig_side.png')){
   $p=Join-Path $j.output "review/$n"
   if(-not(Test-Path $p) -or (Get-Item $p).LastWriteTimeUtc -lt $latest){$ready=$false;break}
  }
  if(-not $ready){break}
 }
 # The chick is deliberately rebuilt last, so a previous fresh render cannot
 # satisfy this gate while its final build is still pending.
 $babyLog=Join-Path $base sun_baby_final_open.log
 if(-not(Test-Path $babyLog) -or -not(Select-String -LiteralPath $babyLog -Pattern 'Blender quit' -SimpleMatch -Quiet)){$ready=$false}
 if($ready){break};if((Get-Date) -gt $limit){throw 'Review gate timed out'};Start-Sleep 3
}
& ./tools/sheets_starters_v32.ps1 -Root $Root *> (Join-Path $base sheets.log)
& ./tools/diagnostics_starters_v32.ps1 -Root $Root
& ./tools/comparison_starters_v32.ps1 -Root $Root *> (Join-Path $base comparison.log)
& ./tools/overview_starters_v32.ps1 -Root $Root
Write-Output 'V32_ALL_PREVIEWS_READY'
