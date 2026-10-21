param(
  [Parameter(Mandatory=$true)] [string] $InputFile,
  [ValidateSet('json','postgres')] [string] $Type,
  [string] $DestinationDirectory,
  [switch] $ConfirmRestore
)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $InputFile).Path
if (-not $ConfirmRestore) { throw 'Restore memerlukan -ConfirmRestore. Untuk JSON, pilih folder tujuan baru; untuk PostgreSQL, gunakan database kosong yang khusus untuk uji pemulihan.' }

if ($Type -eq 'postgres') {
  if (-not $env:RESTORE_DATABASE_URL) { throw 'Atur RESTORE_DATABASE_URL ke database pemulihan yang kosong.' }
  $pgRestore = Get-Command pg_restore -ErrorAction Stop
  & $pgRestore.Source '--exit-on-error' '--no-owner' '--no-acl' "--dbname=$env:RESTORE_DATABASE_URL" $source
  if ($LASTEXITCODE -ne 0) { throw "pg_restore gagal dengan kode $LASTEXITCODE." }
  Write-Host 'Restore PostgreSQL selesai. Jalankan validasi katalog dan pemeriksaan jumlah rekaman.'
} else {
  if (-not $DestinationDirectory) { throw 'DestinationDirectory wajib menunjuk folder pemulihan terpisah.' }
  $target = [System.IO.Path]::GetFullPath($DestinationDirectory)
  [System.IO.Directory]::CreateDirectory($target) | Out-Null
  foreach ($name in @('progress.json','content.json')) {
    $candidate = Join-Path $source $name
    if (Test-Path -LiteralPath $candidate) { Copy-Item -LiteralPath $candidate -Destination (Join-Path $target $name) -Force }
  }
  Write-Host "File JSON dipulihkan ke folder terpisah: $target"
}
