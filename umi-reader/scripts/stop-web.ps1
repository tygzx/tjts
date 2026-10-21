$ErrorActionPreference = 'Stop'
$serverScript = Join-Path $PSScriptRoot 'serve.mjs'
$servers = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine.IndexOf($serverScript,[StringComparison]::OrdinalIgnoreCase) -ge 0
})
foreach ($server in $servers) { Stop-Process -Id $server.ProcessId -ErrorAction Stop }
Write-Output ('Reader server stopped: ' + $servers.Count)
