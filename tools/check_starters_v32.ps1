param([string]$Root='Art/_incoming/starter_v32_20261111',[string]$Only='')
$ErrorActionPreference='Stop'
$base=(Resolve-Path $Root).Path;$jobs=Get-Content (Join-Path $base jobs.json) -Raw -Encoding UTF8 | ConvertFrom-Json
$env:BLENDER_USER_RESOURCES=Join-Path $base ('check_runtime_'+$PID)
foreach($job in $jobs){
    $selector="$($job.family):$($job.stage)";if($Only -and $selector -notin $Only.Split(',')){continue}
    $producer='build_'+$job.family+'.log'
    $limit=(Get-Date).AddMinutes(30)
    while(-not(Select-String -LiteralPath (Join-Path $base $producer) -SimpleMatch -Pattern "V32_DONE $($job.task_id)" -Quiet)){
        if((Get-Date) -gt $limit){throw "Build timed out: $selector"};Start-Sleep -Seconds 3
    }
    $log=Join-Path $base ("verify_"+$job.task_id+'.log')
    & 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python tools/verify_starters_v32.py -- --jobs (Join-Path $base jobs.json) --only $selector *> $log
    if($LASTEXITCODE -ne 0){throw "Verification process failed: $selector"}
    $report=Get-Content (Join-Path $job.output review/structure_verification.json) -Raw -Encoding UTF8 | ConvertFrom-Json
    if(-not $report.passed){throw "$selector : $($report.errors -join ', ')"}
    Write-Output "V32_CHECKED $($job.task_id)"
}
