<#
.SYNOPSIS
  Day-to-day operations for the Spaceborn AWS environment.

.DESCRIPTION
  stop     Scale every ECS service to 0, stop RDS and the bastion. Keeps the VPC,
           NAT gateway and load balancers, so the public URL survives. ~$16/mo.
  start    Start RDS and the bastion, scale the services back up.
  deploy   Upload the repo to S3, build all four images on CodeBuild, run the
           migration, then roll the services onto the new tag.
  migrate  Run database migrations only.
  seed     Load demo categories, products and three demo stores.
  status   Show task counts, image tags and the public URLs.
  destroy  terraform destroy. Removes everything except the state and build
           buckets and the ECR images. This is the only way to stop paying for
           the NAT gateway and load balancers.
  tunnel   Port-forward the admin panel (8080) or Postgres (5433) over SSM.

.EXAMPLE
  ./spaceborn.ps1 status
  ./spaceborn.ps1 deploy -Tag build-7
  ./spaceborn.ps1 stop
  ./spaceborn.ps1 tunnel -Target admin
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory, Position = 0)]
  [ValidateSet('stop', 'start', 'deploy', 'migrate', 'seed', 'status', 'destroy', 'tunnel', 'grant-admin')]
  [string]$Command,

  [string]$Tag,
  [string]$Email,
  [ValidateSet('admin', 'db')]
  [string]$Target = 'admin'
)

$ErrorActionPreference = 'Stop'

$Region      = 'ap-south-1'
$AccountId   = '758530010955'
$Cluster     = 'spaceborn-dev'
$DbInstance  = 'spaceborn-dev-db'
$BuildBucket = "spaceborn-build-$AccountId"
$BuildProject = 'spaceborn-build'
$RepoRoot    = Split-Path -Parent $PSScriptRoot
$TerraformDir = Join-Path $RepoRoot 'terraform'

# storefront and api carry two tasks; the rest are singletons.
$DesiredCounts = [ordered]@{ api = 2; worker = 1; storefront = 2; 'vendor-hub' = 1; 'admin-panel' = 1 }

function Invoke-Aws {
  param([Parameter(ValueFromRemainingArguments)][string[]]$AwsArgs)
  $output = & aws @AwsArgs --region $Region
  if ($LASTEXITCODE -ne 0) { throw "aws $($AwsArgs -join ' ') failed with exit code $LASTEXITCODE" }
  return $output
}

function Get-TerraformOutput {
  param([string]$Name)
  Push-Location $TerraformDir
  try { return (& terraform output -raw $Name 2>$null) } finally { Pop-Location }
}

function Get-NetworkConfiguration {
  $subnets = (Invoke-Aws ec2 describe-subnets --filters 'Name=tag:Tier,Values=app' --query 'Subnets[].SubnetId' --output text) -split '\s+'
  $sg = Invoke-Aws ec2 describe-security-groups --filters "Name=group-name,Values=$Cluster-api" --query 'SecurityGroups[0].GroupId' --output text
  return "awsvpcConfiguration={subnets=[$($subnets -join ',')],securityGroups=[$sg],assignPublicIp=DISABLED}"
}

function Get-BastionId {
  return Invoke-Aws ec2 describe-instances `
    --filters "Name=tag:Name,Values=$Cluster-bastion" 'Name=instance-state-name,Values=pending,running,stopping,stopped' `
    --query 'Reservations[].Instances[0].InstanceId' --output text
}

# Runs a one-off task on the API image and waits for it to exit.
function Invoke-OneOffTask {
  param([string[]]$TaskCommand, [hashtable]$Env = @{}, [string]$Label)

  $overrides = @{
    containerOverrides = @(@{
      name        = 'migrate'
      command     = $TaskCommand
      environment = @($Env.GetEnumerator() | ForEach-Object { @{ name = $_.Key; value = $_.Value } })
    })
  }
  $file = Join-Path $env:TEMP "spaceborn-override-$([guid]::NewGuid()).json"
  $overrides | ConvertTo-Json -Depth 6 -Compress | Set-Content $file -Encoding ascii

  try {
    Write-Host "$Label ..." -ForegroundColor Cyan
    $arn = Invoke-Aws ecs run-task --cluster $Cluster --launch-type FARGATE `
      --task-definition "$Cluster-migrate" --network-configuration (Get-NetworkConfiguration) `
      --overrides "file://$file" --query 'tasks[0].taskArn' --output text
    Invoke-Aws ecs wait tasks-stopped --cluster $Cluster --tasks $arn | Out-Null
    $exit = Invoke-Aws ecs describe-tasks --cluster $Cluster --tasks $arn --query 'tasks[0].containers[0].exitCode' --output text
    if ($exit -ne '0') {
      throw "$Label failed (exit $exit). Logs: aws logs tail /ecs/$Cluster/migrate --region $Region"
    }
    Write-Host "$Label done." -ForegroundColor Green
  } finally {
    Remove-Item $file -ErrorAction SilentlyContinue
  }
}

function Set-ServiceScale {
  param([switch]$Up)
  foreach ($name in $DesiredCounts.Keys) {
    $count = if ($Up) { $DesiredCounts[$name] } else { 0 }
    Invoke-Aws ecs update-service --cluster $Cluster --service $name --desired-count $count --output text --query 'service.serviceName' | Out-Null
    Write-Host "  $name -> $count"
  }
}

switch ($Command) {

  'stop' {
    Write-Host 'Scaling services to zero' -ForegroundColor Cyan
    Set-ServiceScale

    Write-Host 'Stopping RDS (takes a few minutes; AWS restarts it automatically after 7 days)' -ForegroundColor Cyan
    try { Invoke-Aws rds stop-db-instance --db-instance-identifier $DbInstance --query 'DBInstance.DBInstanceStatus' --output text | Out-Null }
    catch { Write-Host "  RDS already stopped or stopping" -ForegroundColor Yellow }

    $bastion = Get-BastionId
    if ($bastion) {
      Invoke-Aws ec2 stop-instances --instance-ids $bastion --query 'StoppingInstances[0].CurrentState.Name' --output text | Out-Null
      Write-Host "  bastion $bastion stopping"
    }

    Write-Host ''
    Write-Host 'Parked. The NAT gateway and both load balancers still bill about $75/month.' -ForegroundColor Yellow
    Write-Host 'Run "./spaceborn.ps1 destroy" to stop paying for those too.' -ForegroundColor Yellow
  }

  'start' {
    Write-Host 'Starting RDS' -ForegroundColor Cyan
    try {
      Invoke-Aws rds start-db-instance --db-instance-identifier $DbInstance --query 'DBInstance.DBInstanceStatus' --output text | Out-Null
    } catch { Write-Host '  RDS already available' -ForegroundColor Yellow }

    $bastion = Get-BastionId
    if ($bastion) { Invoke-Aws ec2 start-instances --instance-ids $bastion --output text | Out-Null }

    Write-Host 'Waiting for the database to accept connections' -ForegroundColor Cyan
    Invoke-Aws rds wait db-instance-available --db-instance-identifier $DbInstance | Out-Null

    Write-Host 'Scaling services up' -ForegroundColor Cyan
    Set-ServiceScale -Up
    Write-Host ''
    Write-Host "Storefront: http://$(Get-TerraformOutput 'public_url')" -ForegroundColor Green
  }

  'deploy' {
    if (-not $Tag) { $Tag = "build-$(Get-Date -Format 'yyyyMMdd-HHmm')" }
    $zip = Join-Path $env:TEMP 'spaceborn-src.zip'

    Write-Host "Packaging the repository" -ForegroundColor Cyan
    Push-Location $RepoRoot
    try {
      Remove-Item $zip -ErrorAction SilentlyContinue
      tar -a -cf $zip --exclude node_modules --exclude .next --exclude dist --exclude .terraform `
        --exclude .git --exclude tfplan --exclude '*.pem' --exclude '*.tfstate*' .
      if ($LASTEXITCODE -ne 0) { throw 'packaging failed' }
    } finally { Pop-Location }

    Invoke-Aws s3 cp $zip "s3://$BuildBucket/src.zip" --only-show-errors | Out-Null

    Write-Host "Building images on CodeBuild as $Tag" -ForegroundColor Cyan
    $buildId = Invoke-Aws codebuild start-build --project-name $BuildProject `
      --environment-variables-override "name=IMAGE_TAG,value=$Tag,type=PLAINTEXT" `
      --query 'build.id' --output text

    do {
      Start-Sleep 20
      $status = Invoke-Aws codebuild batch-get-builds --ids $buildId --query 'builds[0].buildStatus' --output text
      Write-Host "  $status"
    } while ($status -eq 'IN_PROGRESS')

    if ($status -ne 'SUCCEEDED') {
      $stream = Invoke-Aws codebuild batch-get-builds --ids $buildId --query 'builds[0].logs.streamName' --output text
      throw "build $status. Logs: aws logs tail /aws/codebuild/$BuildProject --log-stream-names $stream --region $Region"
    }

    Write-Host "Pointing the task definitions at $Tag" -ForegroundColor Cyan
    Push-Location $TerraformDir
    try {
      & terraform apply -auto-approve -input=false -var "image_tag=$Tag"
      if ($LASTEXITCODE -ne 0) { throw 'terraform apply failed' }
    } finally { Pop-Location }

    Invoke-OneOffTask -TaskCommand @('node', 'dist/db/migrate.js') -Label 'Running migrations'

    Write-Host 'Rolling the services' -ForegroundColor Cyan
    foreach ($name in $DesiredCounts.Keys) {
      Invoke-Aws ecs update-service --cluster $Cluster --service $name --force-new-deployment --query 'service.serviceName' --output text | Out-Null
      Write-Host "  $name"
    }
    Write-Host ''
    Write-Host "Deployed $Tag. Storefront: http://$(Get-TerraformOutput 'public_url')" -ForegroundColor Green
  }

  'migrate' { Invoke-OneOffTask -TaskCommand @('node', 'dist/db/migrate.js') -Label 'Running migrations' }

  'seed' { Invoke-OneOffTask -TaskCommand @('node', 'dist/db/seed.js') -Env @{ FORCE_SEED = 'true' } -Label 'Seeding demo data' }

  'grant-admin' {
    if (-not $Email) { throw 'Please specify the email to make admin: .\ops\spaceborn.ps1 grant-admin -Email user@example.com' }
    Invoke-OneOffTask -TaskCommand @('node', 'dist/scripts/grant-admin.js', $Email) -Label "Granting admin role to $Email"
  }

  'status' {
    $names = @($DesiredCounts.Keys)
    $json = Invoke-Aws ecs describe-services --cluster $Cluster --services @names `
      --query 'services[].{name:serviceName,desired:desiredCount,running:runningCount,taskDef:taskDefinition}' --output json
    ($json | ConvertFrom-Json) |
      Select-Object name, desired, running, @{ n = 'revision'; e = { $_.taskDef.Split('/')[-1] } } |
      Format-Table -AutoSize

    $db = Invoke-Aws rds describe-db-instances --db-instance-identifier $DbInstance --query 'DBInstances[0].DBInstanceStatus' --output text
    Write-Host "database : $db"
    Write-Host "storefront: http://$(Get-TerraformOutput 'public_url')"
    Write-Host "vendor    : $(Get-TerraformOutput 'vendor_url')"
    Write-Host "admin     : $(Get-TerraformOutput 'admin_internal_url') (SSM tunnel only)"
  }

  'destroy' {
    Write-Host 'This deletes the VPC, load balancers, NAT gateway, RDS instance and all ECS services.' -ForegroundColor Red
    Write-Host 'The Terraform state bucket, the build bucket and the ECR images are kept.' -ForegroundColor Yellow
    if ((Read-Host 'Type the word destroy to continue') -ne 'destroy') { Write-Host 'Cancelled.'; break }
    Push-Location $TerraformDir
    try { & terraform destroy -auto-approve -input=false } finally { Pop-Location }
  }

  'tunnel' {
    $bastion = Get-BastionId
    if (-not $bastion) { throw 'No bastion instance found.' }

    if ($Target -eq 'admin') {
      $host_ = Get-TerraformOutput 'admin_internal_url'; $remotePort = 80; $localPort = 8080
      Write-Host "Admin panel will be at http://localhost:$localPort" -ForegroundColor Green
    } else {
      $host_ = Get-TerraformOutput 'db_endpoint'; $remotePort = 5432; $localPort = 5433
      Write-Host "Postgres will be at localhost:$localPort" -ForegroundColor Green
      Write-Host 'Credentials: aws secretsmanager get-secret-value --secret-id <db_master_secret_arn>' -ForegroundColor Yellow
    }

    & aws ssm start-session --region $Region --target $bastion `
      --document-name AWS-StartPortForwardingSessionToRemoteHost `
      --parameters "host=$host_,portNumber=$remotePort,localPortNumber=$localPort"
  }
}
