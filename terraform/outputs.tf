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

output "db_endpoint" {
  value = aws_db_instance.main.address
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
