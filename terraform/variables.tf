variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "aws_profile" {
  type        = string
  description = "Named AWS CLI profile holding the credentials (see `aws configure --profile`)."
  default     = "spaceborn"
}

variable "aws_account_id" {
  type        = string
  description = "12-digit AWS account ID. Terraform refuses to run against any other account."

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "aws_account_id must be a 12-digit AWS account ID."
  }
}

variable "environment" {
  type    = string
  default = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging or prod."
  }
}

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "single_nat_gateway" {
  type        = bool
  description = "One shared NAT gateway (cheaper) instead of one per AZ (survives an AZ outage)."
  default     = false
}

variable "domain_name" {
  type        = string
  description = "Root domain, e.g. spaceborn.in. Storefront serves the root, vendor hub serves vendor.<domain>."
  default     = "example.com"
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM certificate covering domain_name and *.domain_name. Leave empty to serve plain HTTP (dev only)."
  default     = ""
}

variable "cloudfront_certificate_arn" {
  type        = string
  description = "ACM certificate in us-east-1 covering domain_name and *.domain_name (CloudFront only accepts certificates from that region). Leave empty to serve the distributions on their *.cloudfront.net names only."
  default     = ""
}

variable "admin_allowed_cidrs" {
  type        = list(string)
  description = "CIDRs allowed to reach the internal admin load balancer (VPN ranges). The VPC itself is always allowed."
  default     = []
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_engine_version" {
  type    = string
  default = "16"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_max_allocated_storage" {
  type    = number
  default = 100
}

variable "db_multi_az" {
  type    = bool
  default = true
}

variable "db_backup_retention_days" {
  type    = number
  default = 7
}

variable "firebase_project_id" {
  type        = string
  description = "Firebase project used for identity. ID tokens are verified against it."
}

variable "image_tag" {
  type        = string
  description = "Container image tag deployed for every service (usually the git SHA)."
  default     = "latest"
}

variable "api_desired_count" {
  type    = number
  default = 2
}

variable "api_max_count" {
  type    = number
  default = 6
}

variable "storefront_desired_count" {
  type    = number
  default = 2
}

variable "storefront_max_count" {
  type    = number
  default = 6
}

variable "enable_cloudfront" {
  type        = bool
  description = "Front the public load balancer with CloudFront. Gives edge caching and HTTPS while no domain is attached; ignored once acm_certificate_arn is set."
  default     = true
}

variable "mail_from" {
  type        = string
  description = "Verified SES sender for transactional mail. Empty disables email (events are only logged)."
  default     = ""
}

variable "copilot_model_id" {
  type        = string
  description = "Bedrock model or inference profile the shopping copilot uses (Converse API with tool use)."
  default     = "global.amazon.nova-2-lite-v1:0"
}

variable "copilot_desired_count" {
  type    = number
  default = 1
}

variable "copilot_max_count" {
  type    = number
  default = 4
}

variable "kafka_image" {
  type        = string
  description = "Kafka broker image (KRaft mode). kafkajs speaks the 3.x protocol, so stay on 3.x."
  default     = "apache/kafka:3.9.1"
}

variable "log_retention_days" {
  type    = number
  default = 30
}
