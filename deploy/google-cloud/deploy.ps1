[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z][a-z0-9-]{4,28}[a-z0-9]$')]
    [string]$ProjectId,
    [ValidatePattern('^[a-z]+-[a-z]+[0-9]+$')]
    [string]$Region = 'asia-south1',
    [ValidatePattern('^[a-z][a-z0-9-]{0,47}[a-z0-9]$')]
    [string]$Service = 'webguide-ai',
    [ValidatePattern('^[a-z][a-z0-9-]{0,47}[a-z0-9]$')]
    [string]$Repository = 'webguide',
    [switch]$Initialize,
    [switch]$PublicAccess
)
$ErrorActionPreference = 'Stop'
function Invoke-Gcloud {
    param([string[]]$Arguments)
    & gcloud @Arguments
    if ($LASTEXITCODE -ne 0) { throw "gcloud failed: $($Arguments[0]) $($Arguments[1])" }
}
# Authenticate and validate the explicit target before any billable operation.
Invoke-Gcloud @('projects', 'describe', $ProjectId, '--format=value(projectId)')
$runtimeName = 'webguide-runtime'
$runtimeAccount = "$runtimeName@$ProjectId.iam.gserviceaccount.com"
if ($Initialize) {
    Invoke-Gcloud @('services', 'enable', 'run.googleapis.com', 'cloudbuild.googleapis.com', 'artifactregistry.googleapis.com', '--project', $ProjectId, '--quiet')
    $repositories = & gcloud artifacts repositories list --project $ProjectId --location $Region --format='value(name)'
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect Artifact Registry repositories.' }
    if (-not ($repositories | Where-Object { $_ -match "/repositories/$Repository$" })) {
        Invoke-Gcloud @('artifacts', 'repositories', 'create', $Repository, '--repository-format=docker', '--location', $Region, '--project', $ProjectId, '--quiet')
    }
    $accounts = & gcloud iam service-accounts list --project $ProjectId --format='value(email)'
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect runtime service accounts.' }
    if ($runtimeAccount -notin $accounts) {
        Invoke-Gcloud @('iam', 'service-accounts', 'create', $runtimeName, '--display-name=WebGuide frontend runtime', '--project', $ProjectId, '--quiet')
    }
}
# This dedicated frontend identity needs no application API/data roles.
Invoke-Gcloud @('iam', 'service-accounts', 'describe', $runtimeAccount, '--project', $ProjectId, '--format=value(email)')
$stage = & (Join-Path $PSScriptRoot 'prepare-source.ps1')
$tag = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
$image = "$Region-docker.pkg.dev/$ProjectId/$Repository/${Service}:$tag"
$buildConfig = Join-Path $PSScriptRoot 'cloudbuild.yaml'
Invoke-Gcloud @('builds', 'submit', $stage, '--config', $buildConfig, '--substitutions', "_REGION=$Region,_REPOSITORY=$Repository,_IMAGE=$Service,_TAG=$tag", '--project', $ProjectId, '--quiet')
$access = if ($PublicAccess) { '--allow-unauthenticated' } else { '--no-allow-unauthenticated' }
Invoke-Gcloud @('run', 'deploy', $Service, '--image', $image, '--project', $ProjectId, '--region', $Region,
    '--platform=managed', '--port=8080', '--cpu=1', '--memory=512Mi', '--concurrency=40', '--timeout=60',
    '--min=0', '--max=2', '--service-account', $runtimeAccount, '--ingress=all', $access, '--quiet')
Invoke-Gcloud @('run', 'services', 'describe', $Service, '--project', $ProjectId, '--region', $Region,
    '--format=value(status.url,status.latestReadyRevisionName)')
Write-Output 'Frontend deployment finished. Perform HTTPS browser and assistive-technology acceptance before claiming voice readiness.'
