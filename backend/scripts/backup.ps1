param(
  [string] $BackupDirectory = (Join-Path $PSScriptRoot '..\..\.backups'),
  [ValidateSet('json','postgres')] [string] $Type = $(if ($env:DATABASE_URL) { 'postgres' } else { 'json' })
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$target = [System.IO.Path]::GetFullPath($BackupDirectory)
[System.IO.Directory]::CreateDirectory($target) | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

if ($Type -eq 'postgres') {
  if (-not $env:DATABASE_URL) { throw 'Atur DATABASE_URL untuk backup PostgreSQL.' }
  $pgDump = Get-Command pg_dump -ErrorAction Stop
  $file = Join-Path $target "cerdas-cermat-$stamp.dump"
  & $pgDump.Source '--format=custom' "--file=$file" "--dbname=$env:DATABASE_URL" '--no-owner' '--no-acl'
  if ($LASTEXITCODE -ne 0) { throw "pg_dump gagal dengan kode $LASTEXITCODE." }
  Write-Host "Backup PostgreSQL selesai: $file"
} else {
  $data = Join-Path $root 'backend\data'
  $file = Join-Path $target "cerdas-cermat-json-$stamp"
  [System.IO.Directory]::CreateDirectory($file) | Out-Null
  foreach ($name in @('progress.json','content.json')) {
    $source = Join-Path $data $name
    if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination (Join-Path $file $name) }
  }
  Write-Host "Backup JSON selesai: $file"
}
