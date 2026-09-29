# Service Discovery Namespace
resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "spaceborn.local"
  description = "Spaceborn internal DNS"
  vpc         = aws_vpc.main.id
}

# Redis Service Discovery
resource "aws_service_discovery_service" "redis" {
  name = "redis"
  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id
    dns_records {
      ttl  = 10
      type = "A"
    }
    routing_policy = "MULTIVALUE"
  }
}

# RabbitMQ Service Discovery
resource "aws_service_discovery_service" "rabbitmq" {
  name = "rabbitmq"
  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id
    dns_records {
      ttl  = 10
      type = "A"
    }
    routing_policy = "MULTIVALUE"
  }
}

# Redis Task
resource "aws_ecs_task_definition" "redis" {
  family                   = "spaceborn-redis"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn

  container_definitions = jsonencode([{
    name         = "redis"
    image        = "redis:7-alpine"
    essential    = true
    portMappings = [{ containerPort = 6379 }]
  }])
}

# RabbitMQ Task
resource "aws_ecs_task_definition" "rabbitmq" {
  family                   = "spaceborn-rabbitmq"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn

  container_definitions = jsonencode([{
    name      = "rabbitmq"
    image     = "rabbitmq:3.13-management-alpine"
    essential = true
    portMappings = [
      { containerPort = 5672 },
      { containerPort = 15672 }
    ]
  }])
}

# Celery Task
resource "aws_ecs_task_definition" "celery" {
  family                   = "spaceborn-celery"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn

  container_definitions = jsonencode([{
    name      = "celery-worker"
    image     = var.ecr_celery_image_uri
    essential = true
    environment = [
      { name = "RABBITMQ_URL", value = "amqp://guest:guest@rabbitmq.spaceborn.local:5672/" },
      { name = "REDIS_URL", value = "redis://redis.spaceborn.local:6379/0" }
    ]
  }])
}

# ECS Services for Backend (All Private)
resource "aws_ecs_service" "redis_service" {
  name            = "spaceborn-redis-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.redis.arn
  launch_type     = "FARGATE"
  desired_count   = 1
  network_configuration {
    subnets         = [aws_subnet.private.id]
    security_groups = [aws_security_group.admin_sg.id]
  }
  service_registries {
    registry_arn = aws_service_discovery_service.redis.arn
  }
}

resource "aws_ecs_service" "rabbitmq_service" {
  name            = "spaceborn-rabbitmq-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.rabbitmq.arn
  launch_type     = "FARGATE"
  desired_count   = 1
  network_configuration {
    subnets         = [aws_subnet.private.id]
    security_groups = [aws_security_group.admin_sg.id]
  }
  service_registries {
    registry_arn = aws_service_discovery_service.rabbitmq.arn
  }
}

resource "aws_ecs_service" "celery_service" {
  name            = "spaceborn-celery-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.celery.arn
  launch_type     = "FARGATE"
  desired_count   = 1
  network_configuration {
    subnets         = [aws_subnet.private.id]
    security_groups = [aws_security_group.admin_sg.id]
  }
}
