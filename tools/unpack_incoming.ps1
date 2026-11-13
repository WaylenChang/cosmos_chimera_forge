# Compatibility entry point; defaults resolve relative to the repository.
& (Join-Path $PSScriptRoot "..\unpack_incoming.ps1") @args
