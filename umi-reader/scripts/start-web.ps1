param(
    [ValidateRange(1, 65535)][int]$Port = $(if ($env:UMI_PORT) { [int]$env:UMI_PORT } else { 4173 }),
    [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$readerUrl = 'http://127.0.0.1:' + $Port + '/'
$alreadyRunning = $false
try {
    $info = Invoke-RestMethod -Uri ($readerUrl + 'api/connection') -TimeoutSec 2
    $alreadyRunning = $info.app -eq 'umi-reader'
} catch {}
if (-not $alreadyRunning) {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCommand) { throw 'Install Node.js 20 or newer from https://nodejs.org/, then reopen this launcher.' }
    $nodePath = $nodeCommand.Source
    $nodeVersion = & $nodePath --version
    if ([int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 20) { throw 'Node.js 20 or newer is required.' }
    $logDirectory = Join-Path $projectDirectory '.build-cache\web-server'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    # This edition has no media assets and does not build a recording index.
    $serverScript = Join-Path $PSScriptRoot 'serve.mjs'
    $previousPort = $env:UMI_PORT
    try {
        $env:UMI_PORT = [string]$Port
        Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverScript + '"') -WorkingDirectory $projectDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory ('server-' + $Port + '.log')) -RedirectStandardError (Join-Path $logDirectory ('server-' + $Port + '-error.log')) | Out-Null
    } finally { $env:UMI_PORT = $previousPort }
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        try {
            $info = Invoke-RestMethod -Uri ($readerUrl + 'api/connection') -TimeoutSec 1
            if ($info.app -eq 'umi-reader') { $alreadyRunning = $true; break }
        } catch {}
        Start-Sleep -Milliseconds 250
    }
}
if (-not $alreadyRunning) { throw ('The reader could not start. Check umi-reader\.build-cache\web-server\server-' + $Port + '-error.log, or try a different -Port.') }
if (-not $NoBrowser) { Start-Process $readerUrl }
Write-Output $readerUrl
foreach ($address in $info.addresses) { Write-Output $address.url }
