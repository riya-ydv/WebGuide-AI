$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
function Get-ArchiveSha256([string]$FilePath) {
  $stream = [IO.File]::OpenRead($FilePath)
  $hasher = [Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
  finally { $hasher.Dispose(); $stream.Dispose() }
}
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot '.webguide-local'
$downloads = Join-Path $runtimeRoot 'downloads'
New-Item -ItemType Directory -Force -Path $downloads | Out-Null
$nodeDirectory = Join-Path $runtimeRoot 'node'
$nodeExe = Join-Path $nodeDirectory 'node.exe'
if ((Test-Path -LiteralPath $nodeExe) -and ((& $nodeExe -p 'process.versions.node') -eq '24.22.3')) { exit 0 }
$machineArchitecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
switch ($machineArchitecture.ToUpperInvariant()) {
  'AMD64' { $arch = 'x64'; $expected = 'e612af99f626ab415ea225af6bce5c971feb448cb5cae250bb1c3fa50c5f7d9f' }
  'ARM64' { $arch = 'arm64'; $expected = 'b3cc74a295b39d4f273271e96f58c06dd2b35757ca12abec64c7d0598b434f14' }
  default { throw 'Portable Node supports Windows x64 and ARM64.' }
}
$asset = "node-v24.22.3-win-$arch.zip"
$archive = Join-Path $downloads $asset
Write-Host 'Preparing private Node.js 24.22.3; no global installation or administrator rights.'
if (!(Test-Path -LiteralPath $archive) -or ((Get-ArchiveSha256 $archive) -ne $expected)) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Write-Host 'Downloading the official Node archive; this may take a few minutes.'
  Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/v24.22.3/$asset" -OutFile $archive -TimeoutSec 1800
}
Write-Host 'Verifying the pinned Node SHA-256.'
if ((Get-ArchiveSha256 $archive) -ne $expected) { throw 'Node checksum failed. Nothing was executed; relaunch to retry.' }
$stage = Join-Path $runtimeRoot ('node-stage-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
Write-Host 'Extracting private Node runtime.'
[Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem') | Out-Null
$zip = [IO.Compression.ZipFile]::OpenRead($archive)
try {
  foreach ($entry in $zip.Entries) {
    $entryName = $entry.FullName.Replace('\', '/')
    if ($entryName.StartsWith('/') -or $entryName.Contains(':') -or ($entryName.Split('/') -contains '..') -or (($entry.ExternalAttributes -shr 16) -band 61440) -eq 40960) { throw 'Unsafe archive entry path or symbolic link.' }
  }
} finally { $zip.Dispose() }
# Windows bundled bsdtar handles archive members exceeding MAX_PATH without global policy changes.
$tarExe = [IO.Path]::Combine($env:SystemRoot, 'System32', 'tar.exe')
if (![IO.File]::Exists($tarExe)) { throw 'Windows bundled tar.exe is required (supported Windows 10/11). Update Windows and retry.' }
[IO.Directory]::CreateDirectory($stage) | Out-Null
& $tarExe -xf $archive -C $stage
if ($LASTEXITCODE -ne 0) { throw 'Verified runtime extraction failed. Check disk space and retry.' }
$extracted = Join-Path $stage "node-v24.22.3-win-$arch"
if (!(Test-Path -LiteralPath (Join-Path $extracted 'node.exe'))) { throw 'Unexpected Node archive layout.' }
# All move targets are resolved and checked inside this project runtime directory.
foreach ($target in @($extracted, $nodeDirectory)) {
  if (![IO.Path]::GetFullPath($target).StartsWith([IO.Path]::GetFullPath($runtimeRoot) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Runtime path escaped project directory.' }
}
if (Test-Path -LiteralPath $nodeDirectory) { Move-Item -LiteralPath $nodeDirectory -Destination (Join-Path $runtimeRoot ('node-previous-' + [guid]::NewGuid().ToString('N'))) }
Move-Item -LiteralPath $extracted -Destination $nodeDirectory
