# Keeps the CloudFront distributions (and so the public URLs) across a full teardown.
# Dot-source this file, then call Release-CloudFront before `terraform destroy` and
# Adopt-CloudFront before `terraform apply`. Comments must match terraform/cloudfront.tf.

$KeptDistributions = @(
  @{ Address = 'aws_cloudfront_distribution.main[0]';   Comment = 'spaceborn-dev storefront and API' },
  @{ Address = 'aws_cloudfront_distribution.vendor[0]'; Comment = 'spaceborn-dev vendor hub' }
)

function Get-StateAddresses {
  param([string]$TerraformDir)
  Push-Location $TerraformDir
  try { return @(& terraform state list 2>$null) } finally { Pop-Location }
}

# Removes the distributions from Terraform state so `destroy` leaves them running in AWS.
function Release-CloudFront {
  param([string]$TerraformDir)
  $state = Get-StateAddresses $TerraformDir
  Push-Location $TerraformDir
  try {
    foreach ($d in $KeptDistributions) {
      if ($state -contains $d.Address) {
        & terraform state rm -no-color $d.Address | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "terraform state rm $($d.Address) failed" }
        Write-Host "  kept $($d.Address) (URL survives the teardown)" -ForegroundColor Green
      }
    }
  } finally { Pop-Location }
}

# Imports a surviving distribution back into state, so `apply` repoints it at the new ALB instead of creating a new URL.
function Adopt-CloudFront {
  param([string]$TerraformDir, [string]$Region = 'ap-south-1')
  $state = Get-StateAddresses $TerraformDir
  Push-Location $TerraformDir
  try {
    foreach ($d in $KeptDistributions) {
      if ($state -contains $d.Address) { continue }
      $id = & aws cloudfront list-distributions --region $Region `
        --query "DistributionList.Items[?Comment=='$($d.Comment)'].Id | [0]" --output text
      if ($LASTEXITCODE -ne 0) { throw 'aws cloudfront list-distributions failed' }
      if (-not $id -or $id -eq 'None') { continue }
      & terraform import -input=false -no-color $d.Address $id | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "terraform import $($d.Address) $id failed" }
      Write-Host "  re-attached $($d.Address) -> $id" -ForegroundColor Green
    }
  } finally { Pop-Location }
}
