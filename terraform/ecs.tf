resource "aws_ecs_cluster" "main" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

resource "aws_cloudwatch_log_group" "service" {
  for_each          = toset(["api", "worker", "migrate", "storefront", "vendor-hub", "admin-panel"])
  name              = "/ecs/${local.name}/${each.key}"
  retention_in_days = var.log_retention_days
}

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# Used by ECS itself: pull images, write logs, inject secrets
resource "aws_iam_role" "execution" {
  name               = "${local.name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.app.arn,
      aws_db_instance.main.master_user_secret[0].secret_arn,
    ]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "read-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

# Runtime identity of the containers. Only needs the channel used by `aws ecs execute-command`.
resource "aws_iam_role" "backend_task" {
  name               = "${local.name}-backend-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

data "aws_iam_policy_document" "backend_s3" {
  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject"
    ]
    resources = [
      aws_s3_bucket.uploads.arn,
      "${aws_s3_bucket.uploads.arn}/*"
    ]
  }
}

resource "aws_iam_role_policy" "backend_s3_access" {
  name   = "s3-uploads-access"
  role   = aws_iam_role.backend_task.id
  policy = data.aws_iam_policy_document.backend_s3.json
}

resource "aws_iam_role" "web_task" {
  name               = "${local.name}-web-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

data "aws_iam_policy_document" "ecs_exec" {
  statement {
    actions = [
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "ecs_exec" {
  for_each = {
    backend = aws_iam_role.backend_task.id
    web     = aws_iam_role.web_task.id
  }
  name   = "ecs-exec"
  role   = each.value
  policy = data.aws_iam_policy_document.ecs_exec.json
}

locals {
  db_secret_arn  = aws_db_instance.main.master_user_secret[0].secret_arn
  app_secret_arn = aws_secretsmanager_secret.app.arn

  backend_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "PORT", value = "4000" },
    { name = "AWS_REGION", value = var.aws_region },
    { name = "DB_HOST", value = aws_db_instance.main.address },
    { name = "DB_PORT", value = tostring(aws_db_instance.main.port) },
    { name = "DB_NAME", value = aws_db_instance.main.db_name },
    { name = "DB_SSL", value = "require" },
    { name = "FIREBASE_PROJECT_ID", value = var.firebase_project_id },
    { name = "DB_SSL_CA_PATH", value = "/etc/ssl/certs/rds-global-bundle.pem" },
    { name = "UPLOADS_BUCKET", value = aws_s3_bucket.uploads.bucket },
    { name = "MAIL_PROVIDER", value = var.mail_from == "" ? "log" : "ses" },
    { name = "MAIL_FROM", value = var.mail_from },
    { name = "MAIL_CONFIGURATION_SET", value = aws_sesv2_configuration_set.main.configuration_set_name },
    { name = "PUBLIC_ORIGIN", value = local.public_origin },
    { name = "VENDOR_ORIGIN", value = local.vendor_origin },
  ]

  backend_secrets = [
    { name = "DB_USER", valueFrom = "${local.db_secret_arn}:username::" },
    { name = "DB_PASSWORD", valueFrom = "${local.db_secret_arn}:password::" },
    { name = "FIREBASE_SERVICE_ACCOUNT_JSON", valueFrom = "${local.app_secret_arn}:FIREBASE_SERVICE_ACCOUNT_JSON::" },
    { name = "RAZORPAY_KEY_ID", valueFrom = "${local.app_secret_arn}:RAZORPAY_KEY_ID::" },
    { name = "RAZORPAY_KEY_SECRET", valueFrom = "${local.app_secret_arn}:RAZORPAY_KEY_SECRET::" },
    { name = "RAZORPAY_WEBHOOK_SECRET", valueFrom = "${local.app_secret_arn}:RAZORPAY_WEBHOOK_SECRET::" },
  ]

  web_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "PORT", value = "3000" },
    { name = "HOSTNAME", value = "0.0.0.0" },
  ]

  image = { for k, repo in aws_ecr_repository.app : k => "${repo.repository_url}:${var.image_tag}" }

  services = {
    api = {
      image         = local.image["api"], cpu = 512, memory = 1024, port = 4000
      command       = null, environment = local.backend_environment, secrets = local.backend_secrets
      task_role     = aws_iam_role.backend_task.arn, sg = aws_security_group.api.id
      desired       = var.api_desired_count
      target_groups = [aws_lb_target_group.api_public.arn, aws_lb_target_group.api_internal.arn]
    }
    worker = {
      image     = local.image["api"], cpu = 256, memory = 512, port = null
      command   = ["node", "dist/worker.js"], environment = local.backend_environment, secrets = local.backend_secrets
      task_role = aws_iam_role.backend_task.arn, sg = aws_security_group.worker.id
      desired   = 1, target_groups = []
    }
    storefront = {
      image     = local.image["storefront"], cpu = 512, memory = 1024, port = 3000
      command   = null, environment = local.web_environment, secrets = []
      task_role = aws_iam_role.web_task.arn, sg = aws_security_group.web.id
      desired   = var.storefront_desired_count, target_groups = [aws_lb_target_group.storefront.arn]
    }
    vendor-hub = {
      image     = local.image["vendor-hub"], cpu = 256, memory = 512, port = 3000
      command   = null, environment = local.web_environment, secrets = []
      task_role = aws_iam_role.web_task.arn, sg = aws_security_group.web.id
      desired   = 1, target_groups = [aws_lb_target_group.vendor_hub.arn]
    }
    admin-panel = {
      image     = local.image["admin-panel"], cpu = 256, memory = 512, port = 3000
      command   = null, environment = local.web_environment, secrets = []
      task_role = aws_iam_role.web_task.arn, sg = aws_security_group.web.id
      desired   = 1, target_groups = [aws_lb_target_group.admin_panel.arn]
    }
  }
}

resource "aws_ecs_task_definition" "service" {
  for_each                 = local.services
  family                   = "${local.name}-${each.key}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = each.value.task_role

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name         = each.key
    image        = each.value.image
    essential    = true
    command      = each.value.command
    environment  = each.value.environment
    secrets      = each.value.secrets
    portMappings = each.value.port == null ? [] : [{ containerPort = each.value.port, protocol = "tcp" }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.service[each.key].name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = each.key
      }
    }
  }])
}

resource "aws_ecs_service" "service" {
  for_each               = local.services
  name                   = each.key
  cluster                = aws_ecs_cluster.main.id
  task_definition        = aws_ecs_task_definition.service[each.key].arn
  desired_count          = each.value.desired
  launch_type            = "FARGATE"
  enable_execute_command = true
  propagate_tags         = "SERVICE"

  health_check_grace_period_seconds = length(each.value.target_groups) > 0 ? 60 : null

  network_configuration {
    subnets          = aws_subnet.app[*].id
    security_groups  = [each.value.sg]
    assign_public_ip = false
  }

  dynamic "load_balancer" {
    for_each = each.value.target_groups
    content {
      target_group_arn = load_balancer.value
      container_name   = each.key
      container_port   = each.value.port
    }
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  depends_on = [
    aws_lb_listener.public_http,
    aws_lb_listener.public_https,
    aws_lb_listener.vendor_http,
    aws_lb_listener.admin_http,
  ]
}

# One-off task that runs database migrations with the API image
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${local.name}-migrate"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.backend_task.arn

  container_definitions = jsonencode([{
    name        = "migrate"
    image       = local.image["api"]
    essential   = true
    command     = ["node", "dist/db/migrate.js"]
    environment = local.backend_environment
    secrets     = local.backend_secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.service["migrate"].name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "migrate"
      }
    }
  }])
}

locals {
  autoscaled = {
    api        = var.api_max_count
    storefront = var.storefront_max_count
  }
}

resource "aws_appautoscaling_target" "service" {
  for_each           = local.autoscaled
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.service[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = local.services[each.key].desired
  max_capacity       = each.value
}

resource "aws_appautoscaling_policy" "cpu" {
  for_each           = aws_appautoscaling_target.service
  name               = "${each.key}-cpu"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = each.value.service_namespace
  resource_id        = each.value.resource_id
  scalable_dimension = each.value.scalable_dimension

  target_tracking_scaling_policy_configuration {
    target_value       = 60
    scale_in_cooldown  = 120
    scale_out_cooldown = 30

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}
