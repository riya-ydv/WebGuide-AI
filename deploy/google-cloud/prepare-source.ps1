[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$stage = Join-Path $PSScriptRoot ('.source-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
# Only these inputs are uploaded. In particular: no .env, Git history, model,
# recordings, screenshots, old PDF packages, or local browser evidence.
foreach ($name in @('package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json')) {
    Copy-Item -LiteralPath (Join-Path $root $name) -Destination $stage
}
foreach ($name in @('src', 'public', 'shared', 'browser-extension', 'widget')) {
    Copy-Item -LiteralPath (Join-Path $root $name) -Destination $stage -Recurse
}
New-Item -ItemType Directory -Path (Join-Path $stage 'scripts') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'scripts/build-assistance.mjs') -Destination (Join-Path $stage 'scripts')
$deployDir = Join-Path $stage 'deploy/google-cloud'
New-Item -ItemType Directory -Path $deployDir -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Dockerfile') -Destination $deployDir
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'cloudbuild.yaml') -Destination $deployDir
# Reject secret-like file names even if they were mistakenly put in public/src.
$forbidden = Get-ChildItem -LiteralPath $stage -Recurse -File | Where-Object {
    $_.Name -match '^\.env($|\.)|\.(pem|p12|pfx|key)$|^credentials\.json$|^api-key\.txt$'
}
if ($forbidden) { throw 'A secret-like file was found in the selected source; upload stopped.' }
$envFile = Join-Path $root '.env'
if (Test-Path -LiteralPath $envFile) {
    $secrets = Get-Content -LiteralPath $envFile | ForEach-Object {
        if ($_ -match '^[A-Z0-9_]*(KEY|TOKEN)=(.{24,})$') { $Matches[2].Trim() }
    }
    foreach ($file in Get-ChildItem -LiteralPath $stage -Recurse -File) {
        $content = [System.IO.File]::ReadAllText($file.FullName)
        foreach ($secret in $secrets) {
            if ($content.Contains($secret)) { throw 'A configured credential occurs in the selected source; upload stopped.' }
        }
    }
}
# No deletion of prior stages; each invocation is independent and reviewable.
Write-Output $stage
