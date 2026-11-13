param([string]$Root='Art/_incoming/starter_v32_20261111',[Parameter(Mandatory=$true)][string]$Family)
$ErrorActionPreference='Stop'
$base=(Resolve-Path $Root).Path;$jobs=Get-Content (Join-Path $base jobs.json) -Raw -Encoding UTF8 | ConvertFrom-Json
$env:BLENDER_USER_RESOURCES=Join-Path $base ('review_runtime_'+$Family)
foreach($job in $jobs){
    if($job.family -ne $Family){continue}
    $limit=(Get-Date).AddMinutes(60);$report=Join-Path $job.output review/structure_verification.json
    while(-not(Test-Path $report)){
        if((Get-Date) -gt $limit){throw "Verification timed out $($job.task_id)"};Start-Sleep -Seconds 3
    }
    $check=Get-Content $report -Raw -Encoding UTF8 | ConvertFrom-Json
    if(-not $check.passed){throw "Verification failed $($job.task_id)"}
    $selector="$($job.family):$($job.stage)"
    foreach($mode in @('standing','open','media')){
        $log=Join-Path $base ("review_$($job.task_id)_$mode.log")
        if($mode -eq 'media'){
            & 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --threads 4 --factory-startup --python-exit-code 1 --python tools/verify_starters_v32.py -- --jobs (Join-Path $base jobs.json) --only $selector --media-only *> $log
        }elseif($mode -eq 'open'){
            & 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --threads 4 --factory-startup --python-exit-code 1 --python tools/preview_starters_v31.py -- --jobs (Join-Path $base jobs.json) --only $selector --glb --open-wings *> $log
        }else{
            & 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --threads 4 --factory-startup --python-exit-code 1 --python tools/preview_starters_v31.py -- --jobs (Join-Path $base jobs.json) --only $selector --glb *> $log
        }
        if($LASTEXITCODE -ne 0){throw "$mode failed $($job.task_id)"}
    }
    Write-Output "V32_REVIEW_READY $($job.task_id)"
}
