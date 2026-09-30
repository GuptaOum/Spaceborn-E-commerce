$ErrorActionPreference = 'Stop'

Write-Host "==================================================" -ForegroundColor Red
Write-Host "Spaceborn Complete Infrastructure Teardown" -ForegroundColor Red
Write-Host "==================================================" -ForegroundColor Red

$RepoRoot = $PSScriptRoot
$TerraformDir = Join-Path $RepoRoot 'terraform'

Push-Location $TerraformDir
try {
  Write-Host "Running terraform destroy to remove all AWS resources..." -ForegroundColor Yellow
  & terraform destroy -auto-approve -input=false
  if ($LASTEXITCODE -ne 0) { throw "terraform destroy exited with code $LASTEXITCODE" }
} finally {
  Pop-Location
}

Write-Host "==================================================" -ForegroundColor Green
Write-Host "Infrastructure completely torn down! Zero resources running." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
