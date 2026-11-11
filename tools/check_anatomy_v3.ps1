param([string]$Root='Art/_incoming/starter_anatomy_v3_20261111',[string]$Only='')
$ErrorActionPreference='Stop'
$base=(Resolve-Path -LiteralPath $Root).Path
$jobs=Get-Content (Join-Path $base jobs.json) -Raw -Encoding UTF8 | ConvertFrom-Json
$env:BLENDER_USER_RESOURCES=Join-Path $base ('verify_runtime_'+$PID)
foreach($job in $jobs){
    $selector="$($job.family):$($job.stage)"
    if($Only -and $selector -notin $Only.Split(',')){continue}
    $deadline=(Get-Date).AddMinutes(20)
    do{
        $done=Select-String -LiteralPath (Join-Path $base anatomy_final.log) -SimpleMatch "ANATOMY_DONE $($job.task_id)" -Quiet
        if($done){break}
        if((Get-Date) -gt $deadline){throw "Build timeout: $selector"}
        Start-Sleep -Seconds 3
    }while($true)
    $log=Join-Path $base ("verify_final_"+$job.task_id+'.log')
    & 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python tools/verify_anatomy_v3.py -- --jobs (Join-Path $base jobs.json) --only $selector --media *> $log
    if($LASTEXITCODE -ne 0){throw "Verification process failed: $selector (see $log)"}
    $r=Get-Content (Join-Path $job.output review/structure_verification.json) -Raw -Encoding UTF8 | ConvertFrom-Json
    if(-not $r.passed){throw "$selector : $($r.errors -join ', ')"}
    Write-Output "V3_CHECKED $($job.task_id)"
}
