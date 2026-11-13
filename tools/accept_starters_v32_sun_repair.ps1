param([string]$Root='Art/_incoming/starter_v32_20261111')
$ErrorActionPreference='Stop'
$base=(Resolve-Path $Root).Path;$jobs=Get-Content (Join-Path $base jobs.json) -Raw -Encoding UTF8 | ConvertFrom-Json
$env:BLENDER_USER_RESOURCES=Join-Path $base repair_sun_final_runtime
$limit=(Get-Date).AddMinutes(50)
while(-not(Select-String -LiteralPath (Join-Path $base review_sun.log) -Pattern 'V32_REVIEW_READY mdl-20261111-a111-1303' -SimpleMatch -Quiet)) {if((Get-Date) -gt $limit){throw 'Original sun review timed out'};Start-Sleep 3}
foreach($j in $jobs){
 if($j.family -ne 'sun'){continue}
 $log=Join-Path $base $(if($j.index -in @(0,1)){'repair_a.log'}else{'repair_b.log'})
 while(-not(Select-String -LiteralPath $log -Pattern "V32_DONE $($j.task_id)" -SimpleMatch -Quiet)){if((Get-Date) -gt $limit){throw 'Sun repair timed out'};Start-Sleep 3}
 $source=Join-Path $base "sun_repair/$($j.task_id)";Copy-Item (Join-Path $source '*') -Destination $j.output -Recurse -Force
 & 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --threads 4 --factory-startup --python-exit-code 1 --python tools/verify_starters_v32.py -- --jobs (Join-Path $base jobs.json) --only "sun:$($j.stage)" *> (Join-Path $base "verify_$($j.task_id).log")
 if($LASTEXITCODE -ne 0){throw "Sun repair verify process $($j.task_id)"}
 $v=Get-Content (Join-Path $j.output review/structure_verification.json) -Raw -Encoding UTF8 | ConvertFrom-Json
 if(-not $v.passed){throw "Sun repair numeric check $($j.task_id)"}
 Write-Output "V32_REPAIRED $($j.task_id)"
}
& ./tools/review_starters_v32.ps1 -Root $Root -Family sun
