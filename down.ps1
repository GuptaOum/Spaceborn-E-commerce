$ErrorActionPreference = 'Stop'

Write-Host "==================================================" -ForegroundColor Red
Write-Host "Spaceborn Complete Infrastructure Teardown" -ForegroundColor Red
Write-Host "==================================================" -ForegroundColor Red

$RepoRoot = $PSScriptRoot
$TerraformDir = Join-Path $RepoRoot 'terraform'

. (Join-Path $RepoRoot 'ops\cloudfront-keep.ps1')
Write-Host "Keeping the CloudFront distributions so the URLs stay the same next time..." -ForegroundColor Yellow
Release-CloudFront -TerraformDir $TerraformDir

Push-Location $TerraformDir
try {
  Write-Host "Running terraform destroy to remove all other AWS resources..." -ForegroundColor Yellow
  & terraform destroy -auto-approve -input=false
  if ($LASTEXITCODE -ne 0) { throw "terraform destroy exited with code $LASTEXITCODE" }
} finally {
  Pop-Location
}

Write-Host "==================================================" -ForegroundColor Green
Write-Host "Infrastructure torn down. Only the two idle CloudFront distributions remain (no monthly fee)." -ForegroundColor Green
Write-Host "Bring it back with the same URLs: .\ops\spaceborn.ps1 up" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
