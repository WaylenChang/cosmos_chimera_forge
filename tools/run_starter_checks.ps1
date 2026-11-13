param([string]$Root = 'Art/_incoming/starter_blender_20261111', [switch]$SkipEarlySun)
$ErrorActionPreference='Stop'
$base=(Resolve-Path -LiteralPath $Root).Path
$jobsFile=Join-Path $base 'jobs.json'
$jobs=Get-Content -LiteralPath $jobsFile -Raw | ConvertFrom-Json
$blender='C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
$env:BLENDER_USER_RESOURCES=Join-Path $base 'blender_final_checks'
foreach($job in $jobs){
    if($SkipEarlySun -and $job.family -eq 'sun' -and $job.index -lt 2){continue}
    $integrity=Join-Path $job.output 'review/mesh_integrity.json'
    $verified=Join-Path $job.output 'review/verification.json'
    if((Test-Path -LiteralPath $integrity) -and (Test-Path -LiteralPath $verified) -and ((Get-Content -LiteralPath $verified -Raw | ConvertFrom-Json).passed) -and ((Get-Item -LiteralPath $verified).LastWriteTime -gt (Get-Item -LiteralPath $integrity).LastWriteTime)){
        & ./tools/starter_review_sheets.ps1 -Root $Root -TaskId $job.task_id
        Write-Output "REVIEW_READY $($job.task_id) (already checked)"
        continue
    }
    $logName=switch($job.family){'sun'{'sun_revision.log'} 'moon'{'moon_revision.log'} 'star'{'production.log'}}
    $sourceLog=Join-Path $base $logName
    while(-not ((Get-Content -LiteralPath $sourceLog -Raw).Contains("STAGE_DONE $($job.task_id)"))){Start-Sleep -Seconds 3}
    $only="$($job.family):$($job.stage)"
    & $blender --background --factory-startup --python-exit-code 1 --python tools/finalize_starter_blender.py -- --jobs $jobsFile --only $only *> (Join-Path $base "finalize_$($job.family)_$($job.stage).log")
    if($LASTEXITCODE -ne 0){throw "Finalization failed: $only"}
    & $blender --background --factory-startup --python-exit-code 1 --python tools/verify_starter_blender.py -- --jobs $jobsFile --only $only *> (Join-Path $base "verify_final_$($job.family)_$($job.stage).log")
    if($LASTEXITCODE -ne 0){throw "Verification failed: $only"}
    & ./tools/starter_review_sheets.ps1 -Root $Root -TaskId $job.task_id
    Write-Output "REVIEW_READY $($job.task_id)"
}
