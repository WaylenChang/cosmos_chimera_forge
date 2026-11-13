param([string]$Root='Art/_incoming/starter_v31_20261111',[string]$Only='')
$ErrorActionPreference='Stop'
$base=(Resolve-Path $Root).Path;$jobs=Get-Content (Join-Path $base jobs.json) -Raw -Encoding UTF8 | ConvertFrom-Json
$env:BLENDER_USER_RESOURCES=Join-Path $base ('check_runtime_'+$PID)
foreach($job in $jobs){
    $selector="$($job.family):$($job.stage)";if($Only -and $selector -notin $Only.Split(',')){continue}
    $producer=if($job.family -eq 'sun' -or ($job.family -eq 'moon' -and $job.index -lt 2)){'build_a.log'}else{'build_b.log'}
    $limit=(Get-Date).AddMinutes(30)
    while(-not(Select-String -LiteralPath (Join-Path $base $producer) -SimpleMatch -Pattern "V31_DONE $($job.task_id)" -Quiet)){
        if((Get-Date) -gt $limit){throw "Build timed out: $selector"};Start-Sleep -Seconds 3
    }
    $log=Join-Path $base ("verify_"+$job.task_id+'.log')
    & 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python tools/verify_starters_v31.py -- --jobs (Join-Path $base jobs.json) --only $selector *> $log
    if($LASTEXITCODE -ne 0){throw "Verification process failed: $selector"}
    $report=Get-Content (Join-Path $job.output review/structure_verification.json) -Raw -Encoding UTF8 | ConvertFrom-Json
    if(-not $report.passed){throw "$selector : $($report.errors -join ', ')"}
    Write-Output "V31_CHECKED $($job.task_id)"
}
