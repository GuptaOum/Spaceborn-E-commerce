resource "aws_ecs_cluster" "main" {
  name = "spaceborn-cluster"
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_execution_role" {
  name = "spaceborn-ecs-execution-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_role_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Task Definition for the Public App
resource "aws_ecs_task_definition" "public_app" {
  family                   = "spaceborn-public"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn

  container_definitions = jsonencode([{
    name      = "public-frontend"
    image     = var.ecr_image_uri
    essential = true
    portMappings = [{
      containerPort = 3000
      hostPort      = 3000
      protocol      = "tcp"
    }]
    environment = [
      { name = "NEXT_PUBLIC_APP_TYPE", value = "PUBLIC" },
      { name = "NEXT_PUBLIC_SUPABASE_URL", value = var.supabase_url },
      { name = "NEXT_PUBLIC_SUPABASE_ANON_KEY", value = var.supabase_anon_key },
      { name = "NEXT_PUBLIC_FIREBASE_API_KEY", value = var.firebase_api_key },
      { name = "RABBITMQ_URL", value = "amqp://guest:guest@rabbitmq.spaceborn.local:5672/" },
      { name = "REDIS_URL", value = "redis://redis.spaceborn.local:6379/0" }
    ]
  }])
}

# Task Definition for the Private Admin App
resource "aws_ecs_task_definition" "admin_app" {
  family                   = "spaceborn-admin"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn

  container_definitions = jsonencode([{
    name      = "admin-frontend"
    image     = var.ecr_image_uri
    essential = true
    portMappings = [{
      containerPort = 4000
      hostPort      = 4000
      protocol      = "tcp"
    }]
    environment = [
      { name = "PORT", value = "4000" },
      { name = "NEXT_PUBLIC_APP_TYPE", value = "ADMIN" },
      { name = "NEXT_PUBLIC_SUPABASE_URL", value = var.supabase_url },
      { name = "NEXT_PUBLIC_SUPABASE_ANON_KEY", value = var.supabase_anon_key },
      { name = "RABBITMQ_URL", value = "amqp://guest:guest@rabbitmq.spaceborn.local:5672/" },
      { name = "REDIS_URL", value = "redis://redis.spaceborn.local:6379/0" }
    ]
  }])
}

# Public ECS Service (Deployed in the Public Subnet)
resource "aws_ecs_service" "public_service" {
  name            = "spaceborn-public-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.public_app.arn
  launch_type     = "FARGATE"
  desired_count   = 1

  network_configuration {
    subnets          = [aws_subnet.public.id]
    security_groups  = [aws_security_group.public_sg.id]
    assign_public_ip = true
  }
}

# Admin ECS Service (Deployed in the Strict Private Subnet)
resource "aws_ecs_service" "admin_service" {
  name            = "spaceborn-admin-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.admin_app.arn
  launch_type     = "FARGATE"
  desired_count   = 1

  network_configuration {
    subnets          = [aws_subnet.private.id]
    security_groups  = [aws_security_group.admin_sg.id]
    assign_public_ip = false # Strictly Private
  }
}
