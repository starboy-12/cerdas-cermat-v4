$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$backendPath = Join-Path $root 'backend'
$frontendPath = Join-Path $root 'frontend'
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source

function Test-Endpoint([string] $Url) {
  try {
    $response = Invoke-WebRequest -Uri $Url -TimeoutSec 2 -UseBasicParsing
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Test-PortInUse([int] $Port) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $pending = $client.BeginConnect('localhost', $Port, $null, $null)
    if (-not $pending.AsyncWaitHandle.WaitOne(500)) { return $false }
    try { $client.EndConnect($pending); return $true } catch { return $false }
  } finally {
    $client.Dispose()
  }
}

function Start-Service([string] $Name, [string] $Directory, [string] $HealthUrl, [int] $Port, [string] $EntryPoint) {
  if (Test-Endpoint $HealthUrl) {
    Write-Host "$Name sudah berjalan: $HealthUrl" -ForegroundColor Green
    return
  }
  if (Test-PortInUse $Port) {
    throw "Port $Port sedang digunakan layanan lain. Hentikan layanan tersebut atau ubah port $Name."
  }
  Start-Process -FilePath $nodePath -ArgumentList $EntryPoint -WorkingDirectory $Directory | Out-Null
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 500
    if (Test-Endpoint $HealthUrl) {
      Write-Host "$Name siap: $HealthUrl" -ForegroundColor Green
      return
    }
  }
  throw "$Name belum merespons di $HealthUrl. Periksa pesan error di jendela proses yang baru dibuka."
}

Start-Service 'Backend' $backendPath 'http://127.0.0.1:3101/api/health' 3101 'src/server.js'
Start-Service 'Frontend' $frontendPath 'http://localhost:5174/' 5174 'server.js'
Write-Host 'Aplikasi dapat dibuka di http://localhost:5174' -ForegroundColor Cyan
