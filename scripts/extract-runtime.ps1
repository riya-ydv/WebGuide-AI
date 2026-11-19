param([Parameter(Mandatory=$true)][string]$Archive, [Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot '.webguide-local'))
$archivePath = [IO.Path]::GetFullPath($Archive)
$destinationPath = [IO.Path]::GetFullPath($Destination)
if (-not $archivePath.StartsWith($runtimeRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or -not $destinationPath.StartsWith($runtimeRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive extraction must stay in the application-local runtime directory.' }
[Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem') | Out-Null
$zip = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  foreach ($entry in $zip.Entries) {
    $entryName = $entry.FullName.Replace('\', '/')
    if ($entryName.StartsWith('/') -or $entryName.Contains(':') -or ($entryName.Split('/') -contains '..') -or (($entry.ExternalAttributes -shr 16) -band 61440) -eq 40960) { throw 'Unsafe archive entry path or symbolic link.' }
  }
} finally { $zip.Dispose() }
# Windows bundled bsdtar handles archive members exceeding MAX_PATH without global policy changes.
$tarExe = [IO.Path]::Combine($env:SystemRoot, 'System32', 'tar.exe')
if (![IO.File]::Exists($tarExe)) { throw 'Windows bundled tar.exe is required (supported Windows 10/11). Update Windows and retry.' }
[IO.Directory]::CreateDirectory($destinationPath) | Out-Null
& $tarExe -xf $archivePath -C $destinationPath
if ($LASTEXITCODE -ne 0) { throw 'Verified runtime extraction failed. Check disk space and retry.' }
