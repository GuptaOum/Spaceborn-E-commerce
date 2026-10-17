output "public_url" {
  description = "Point domain_name and vendor.<domain_name> at this load balancer (CNAME or Route 53 alias)."
  value       = aws_lb.public.dns_name
}

output "storefront_url" {
  description = "What customers should use: HTTPS and edge-cached when CloudFront is enabled."
  value       = local.public_origin
}

output "razorpay_webhook_url" {
  value = "${local.public_origin}/v1/webhooks/razorpay"
}

output "vendor_url" {
  value = local.vendor_origin
}

output "cloudfront_urls" {
  description = "The *.cloudfront.net names. They keep working next to the custom domain."
  value = local.cloudfront_enabled ? {
    storefront = "https://${aws_cloudfront_distribution.main[0].domain_name}"
    vendor     = "https://${aws_cloudfront_distribution.vendor[0].domain_name}"
  } : {}
}

output "dns_records" {
  description = "Records to create at the domain registrar once a certificate is attached."
  value = local.https_enabled ? {
    "${var.domain_name} (ALIAS/ANAME, or CNAME on www)" = local.cloudfront_enabled ? aws_cloudfront_distribution.main[0].domain_name : aws_lb.public.dns_name
    "vendor.${var.domain_name} (CNAME)"                 = local.cloudfront_enabled ? aws_cloudfront_distribution.vendor[0].domain_name : aws_lb.public.dns_name
    "origin.${var.domain_name} (CNAME)"                 = aws_lb.public.dns_name
    "vendor-origin.${var.domain_name} (CNAME)"          = aws_lb.public.dns_name
  } : {}
}

output "admin_internal_url" {
  value = aws_lb.admin.dns_name
}

output "bastion_instance_id" {
  value = aws_instance.bastion.id
}

output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "app_subnets" {
  value = aws_subnet.app[*].id
}

output "api_security_group" {
  value = aws_security_group.api.id
}

output "ecr_repositories" {
  value = { for k, repo in aws_ecr_repository.app : k => repo.repository_url }
}

output "internal_service_names" {
  description = "Cloud Map names used between services inside the VPC."
  value = {
    api     = "api.${local.internal_domain}:4000"
    copilot = local.copilot_url
    kafka   = local.kafka_bootstrap
  }
}

output "ai_memory_table" {
  value = aws_dynamodb_table.ai_memory.name
}

output "db_endpoint" {
  value = aws_db_instance.main.address
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "db_master_secret_arn" {
  value = local.db_secret_arn
}

output "app_secret_arn" {
  value = aws_secretsmanager_secret.app.arn
}

output "admin_tunnel_command" {
  description = "Opens the admin panel at http://localhost:8080 through Session Manager."
  value       = "aws ssm start-session --profile ${var.aws_profile} --region ${var.aws_region} --target ${aws_instance.bastion.id} --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters host=${aws_lb.admin.dns_name},portNumber=80,localPortNumber=8080"
}

output "db_tunnel_command" {
  description = "Exposes Postgres at localhost:5433 through Session Manager."
  value       = "aws ssm start-session --profile ${var.aws_profile} --region ${var.aws_region} --target ${aws_instance.bastion.id} --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters host=${aws_db_instance.main.address},portNumber=5432,localPortNumber=5433"
}

output "migrate_command" {
  value = "aws ecs run-task --profile ${var.aws_profile} --region ${var.aws_region} --cluster ${aws_ecs_cluster.main.name} --launch-type FARGATE --task-definition ${aws_ecs_task_definition.migrate.family} --network-configuration 'awsvpcConfiguration={subnets=[${join(",", aws_subnet.app[*].id)}],securityGroups=[${aws_security_group.api.id}],assignPublicIp=DISABLED}'"
}
