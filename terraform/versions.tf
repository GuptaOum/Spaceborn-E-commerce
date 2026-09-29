terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }

  # Remote state. Create the bucket once, fill in the name, then run `terraform init -migrate-state`.
  # backend "s3" {
  #   bucket       = "REPLACE_WITH_STATE_BUCKET"
  #   key          = "spaceborn/terraform.tfstate"
  #   region       = "ap-south-1"
  #   encrypt      = true
  #   use_lockfile = true
  # }
}

# Credentials are never stored here. Configure them on the machine that runs Terraform:
#   aws configure --profile spaceborn
provider "aws" {
  region              = var.aws_region
  profile             = var.aws_profile
  allowed_account_ids = [var.aws_account_id]

  default_tags {
    tags = local.tags
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

locals {
  name = "spaceborn-${var.environment}"
  azs  = slice(data.aws_availability_zones.available.names, 0, 2)

  tags = {
    Project     = "spaceborn"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
