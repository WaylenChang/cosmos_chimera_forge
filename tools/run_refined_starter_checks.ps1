param([string]$Root='Art/_incoming/starter_refined_20261111',[string]$LogPrefix='',[string]$Only='',[switch]$Balanced)
$ErrorActionPreference='Stop'
$base=(Resolve-Path -LiteralPath $Root).Path
$jobsFile=Join-Path $base jobs.json
$jobs=Get-Content -LiteralPath $jobsFile -Raw | ConvertFrom-Json
$blender='C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
$env:BLENDER_USER_RESOURCES=Join-Path $base blender_checks
foreach($job in $jobs){
    if($Only -and "$($job.family):$($job.stage)" -notin $Only.Split(',')){continue}
    $starLog=($job.family -eq 'star') -or ($Balanced -and $job.family -eq 'moon' -and $job.index -ge 2)
    $log=Join-Path $base ($LogPrefix+$(if($starLog){'star.log'}else{'sun_moon.log'}))
    while(-not ((Get-Content -LiteralPath $log -Raw).Contains("REFINE_DONE $($job.task_id)"))){Start-Sleep -Seconds 3}
    $stageSelector="$($job.family):$($job.stage)"
    $verifyPath=Join-Path $job.output 'review/verification.json'
    $modelDir=Join-Path $job.output models
    if((Test-Path $verifyPath) -and (Test-Path (Join-Path $job.output 'review/glb_back.png'))){
        $latestModel=(Get-ChildItem -LiteralPath $modelDir -File | Where-Object {$_.Extension -in @('.glb','.blend')} | Measure-Object LastWriteTime -Maximum).Maximum
        if(((Get-Content $verifyPath -Raw | ConvertFrom-Json).passed) -and ((Get-Item $verifyPath).LastWriteTime -ge $latestModel)){
            & ./tools/starter_review_sheets.ps1 -Root $Root -TaskId $job.task_id
            Write-Output "REFINED_REVIEW_READY $($job.task_id) (already checked)"
            continue
        }
    }
    & $blender --background --factory-startup --python-exit-code 1 --python tools/finalize_starter_blender.py -- --jobs $jobsFile --only $stageSelector *> (Join-Path $base "finalize_$($job.task_id).log")
    if($LASTEXITCODE -ne 0){throw "Finalization failed: $stageSelector"}
    if($job.family -ne 'sun'){
        & $blender --background --factory-startup --python-exit-code 1 --python tools/fix_starter_faint.py -- --jobs $jobsFile --only $stageSelector *> (Join-Path $base "collapse_$($job.task_id).log")
        if($LASTEXITCODE -ne 0){throw "Collapse correction failed: $stageSelector"}
    }
    & $blender --background --factory-startup --python-exit-code 1 --python tools/verify_starter_blender.py -- --jobs $jobsFile --only $stageSelector *> (Join-Path $base "verify_$($job.task_id).log")
    if($LASTEXITCODE -ne 0){throw "Verification failed: $stageSelector"}
    & ./tools/starter_review_sheets.ps1 -Root $Root -TaskId $job.task_id
    Write-Output "REFINED_REVIEW_READY $($job.task_id)"
}
