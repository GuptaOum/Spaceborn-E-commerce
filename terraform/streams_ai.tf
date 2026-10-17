# Copilot (FastAPI + LangGraph on Bedrock), Kafka (KRaft, single broker), the analytics consumer and
# the Celery CAD worker. Internal services find each other through Cloud Map DNS: <name>.spaceborn.internal.

resource "aws_service_discovery_private_dns_namespace" "internal" {
  name        = "spaceborn.internal"
  description = "Service-to-service names inside the VPC"
  vpc         = aws_vpc.main.id
}

resource "aws_service_discovery_service" "internal" {
  for_each = toset(["api", "copilot", "kafka"])
  name     = each.key

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.internal.id
    routing_policy = "MULTIVALUE"
    dns_records {
      type = "A"
      ttl  = 10
    }
  }

  # ECS reports task health to Cloud Map; unhealthy tasks are removed from DNS.
  health_check_custom_config {
    failure_threshold = 1
  }
}

locals {
  internal_domain = aws_service_discovery_private_dns_namespace.internal.name
  kafka_bootstrap = "kafka.${local.internal_domain}:9092"
  copilot_url     = "http://copilot.${local.internal_domain}:8000"
  # "global.amazon.nova-2-lite-v1:0" -> "amazon.nova-2-lite-v1:0"
  copilot_base_model = replace(var.copilot_model_id, "/^(global|us|eu|apac|jp|au)\\./", "")
}

# ---------------------------------------------------------------------------------------------
# Security groups

# The API group references this one inline (catalog tools call the API directly), so this group's own
# ingress is a separate rule resource; inline rules on both sides would form a dependency cycle.
resource "aws_security_group" "copilot" {
  name        = "${local.name}-copilot"
  description = "Copilot microservice, reachable only from the API"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "Bedrock (through NAT) and the catalog API"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_vpc_security_group_ingress_rule" "copilot_from_api" {
  security_group_id            = aws_security_group.copilot.id
  referenced_security_group_id = aws_security_group.api.id
  from_port                    = 8000
  to_port                      = 8000
  ip_protocol                  = "tcp"
  description                  = "Chat requests from the API gateway"
}

resource "aws_security_group" "kafka" {
  name        = "${local.name}-kafka"
  description = "Kafka broker, reachable from the API, worker and consumer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Kafka clients"
    from_port       = 9092
    to_port         = 9092
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id, aws_security_group.worker.id]
  }

  # The broker advertises its Cloud Map name, which resolves to this task. Traffic from the task to
  # that address is checked against this group, so the broker must be allowed to reach itself.
  ingress {
    description = "Broker to its own advertised address"
    from_port   = 9092
    to_port     = 9092
    protocol    = "tcp"
    self        = true
  }

  egress {
    description = "Inside the VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  # Fargate pulls the image and ships logs through the task's own network interface.
  egress {
    description = "Image pull and CloudWatch Logs (HTTPS through NAT)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ---------------------------------------------------------------------------------------------
# DynamoDB: copilot conversation memory (one item per conversation, expired by TTL)

resource "aws_dynamodb_table" "ai_memory" {
  name         = "${local.name}-ai-memory"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  server_side_encryption {
    enabled = true
  }

  deletion_protection_enabled = var.environment == "prod"
}

data "aws_iam_policy_document" "backend_ai_memory" {
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem"]
    resources = [aws_dynamodb_table.ai_memory.arn]
  }
}

resource "aws_iam_role_policy" "backend_ai_memory" {
  name   = "ai-memory"
  role   = aws_iam_role.backend_task.id
  policy = data.aws_iam_policy_document.backend_ai_memory.json
}

# ---------------------------------------------------------------------------------------------
# Shared secret between the API gateway and the copilot

resource "random_password" "copilot_token" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "copilot_token" {
  name                    = "${local.name}/copilot-token"
  description             = "Shared token the API sends to the copilot service"
  recovery_window_in_days = var.environment == "prod" ? 7 : 0
}

resource "aws_secretsmanager_secret_version" "copilot_token" {
  secret_id     = aws_secretsmanager_secret.copilot_token.id
  secret_string = random_password.copilot_token.result
}

data "aws_iam_policy_document" "execution_copilot_token" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.copilot_token.arn]
  }
}

resource "aws_iam_role_policy" "execution_copilot_token" {
  name   = "read-copilot-token"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_copilot_token.json
}

# ---------------------------------------------------------------------------------------------
# Task roles

resource "aws_iam_role" "copilot_task" {
  name               = "${local.name}-copilot-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

# Cross-region inference profiles route to the model in several regions, so the foundation model is
# allowed in every region, but only when called through the profile.
data "aws_iam_policy_document" "copilot_bedrock" {
  statement {
    sid       = "InferenceProfile"
    actions   = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
    resources = ["arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:inference-profile/${var.copilot_model_id}"]
  }

  statement {
    sid     = "FoundationModelViaProfile"
    actions = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
    resources = [
      "arn:aws:bedrock:*::foundation-model/${local.copilot_base_model}",
      "arn:aws:bedrock:::foundation-model/${local.copilot_base_model}",
    ]
    condition {
      test     = "StringLike"
      variable = "bedrock:InferenceProfileArn"
      values   = ["arn:aws:bedrock:*:${data.aws_caller_identity.current.account_id}:inference-profile/${var.copilot_model_id}"]
    }
  }
}

resource "aws_iam_role_policy" "copilot_bedrock" {
  name   = "bedrock-chat"
  role   = aws_iam_role.copilot_task.id
  policy = data.aws_iam_policy_document.copilot_bedrock.json
}

resource "aws_iam_role" "cad_worker_task" {
  name               = "${local.name}-cad-worker-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

data "aws_iam_policy_document" "cad_worker_s3" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/*"]
  }
}

resource "aws_iam_role_policy" "cad_worker_s3" {
  name   = "read-uploads"
  role   = aws_iam_role.cad_worker_task.id
  policy = data.aws_iam_policy_document.cad_worker_s3.json
}

# The broker needs no AWS access at all; the role only carries ECS Exec for debugging.
resource "aws_iam_role" "kafka_task" {
  name               = "${local.name}-kafka-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy" "ecs_exec_extra" {
  for_each = {
    copilot    = aws_iam_role.copilot_task.id
    cad_worker = aws_iam_role.cad_worker_task.id
    kafka      = aws_iam_role.kafka_task.id
  }
  name   = "ecs-exec"
  role   = each.value
  policy = data.aws_iam_policy_document.ecs_exec.json
}

# ---------------------------------------------------------------------------------------------
# Container settings for the new services (task definitions and services live in ecs.tf)

locals {
  copilot_environment = [
    { name = "AWS_REGION", value = var.aws_region },
    { name = "BEDROCK_CHAT_MODEL", value = var.copilot_model_id },
    { name = "CATALOG_API_URL", value = "http://api.${local.internal_domain}:4000" },
  ]

  copilot_secrets = [
    { name = "COPILOT_TOKEN", valueFrom = aws_secretsmanager_secret.copilot_token.arn },
  ]

  cad_worker_environment = [
    { name = "AWS_REGION", value = var.aws_region },
    { name = "REDIS_URL", value = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379" },
    { name = "CELERY_CAD_QUEUE", value = "cad" },
    { name = "UPLOADS_BUCKET", value = aws_s3_bucket.uploads.bucket },
    { name = "DB_HOST", value = aws_db_instance.main.address },
    { name = "DB_PORT", value = tostring(aws_db_instance.main.port) },
    { name = "DB_NAME", value = aws_db_instance.main.db_name },
    { name = "DB_SSL", value = "require" },
    { name = "DB_SSL_CA_PATH", value = "/etc/ssl/certs/rds-global-bundle.pem" },
  ]

  cad_worker_secrets = [
    { name = "DB_USER", valueFrom = "${local.db_secret_arn}:username::" },
    { name = "DB_PASSWORD", valueFrom = "${local.db_secret_arn}:password::" },
  ]

  # Single KRaft node acting as broker and controller. The log lives on the task disk and is wiped when
  # the task is replaced. The relay marks an outbox row streamed once the broker acks it, so a wiped
  # broker loses analytics that had not been consumed yet. Checkout and payments do not use this log.
  # Consumers dedupe by event id, so a replayed event is applied once.
  kafka_environment = [
    { name = "CLUSTER_ID", value = "c3BhY2Vib3JuLWthZmthMQ" },
    { name = "KAFKA_NODE_ID", value = "1" },
    { name = "KAFKA_PROCESS_ROLES", value = "broker,controller" },
    { name = "KAFKA_LISTENERS", value = "PLAINTEXT://:9092,CONTROLLER://:9093" },
    { name = "KAFKA_ADVERTISED_LISTENERS", value = "PLAINTEXT://${local.kafka_bootstrap}" },
    { name = "KAFKA_CONTROLLER_LISTENER_NAMES", value = "CONTROLLER" },
    { name = "KAFKA_LISTENER_SECURITY_PROTOCOL_MAP", value = "CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT" },
    { name = "KAFKA_CONTROLLER_QUORUM_VOTERS", value = "1@localhost:9093" },
    { name = "KAFKA_INTER_BROKER_LISTENER_NAME", value = "PLAINTEXT" },
    { name = "KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR", value = "1" },
    { name = "KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR", value = "1" },
    { name = "KAFKA_TRANSACTION_STATE_LOG_MIN_ISR", value = "1" },
    { name = "KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS", value = "0" },
    { name = "KAFKA_NUM_PARTITIONS", value = "3" },
    { name = "KAFKA_LOG_RETENTION_HOURS", value = "168" },
    { name = "KAFKA_AUTO_CREATE_TOPICS_ENABLE", value = "true" },
    { name = "KAFKA_HEAP_OPTS", value = "-Xms512m -Xmx768m" },
  ]

  streams_backend_environment = [
    # CloudFront and the ALB each append to X-Forwarded-For; the API must skip both to see the viewer.
    { name = "TRUST_PROXY_HOPS", value = local.cloudfront_enabled ? "2" : "1" },
    { name = "COPILOT_URL", value = local.copilot_url },
    { name = "AI_MEMORY_TABLE", value = aws_dynamodb_table.ai_memory.name },
    { name = "KAFKA_BROKERS", value = local.kafka_bootstrap },
    { name = "KAFKA_TOPIC_PREFIX", value = "spaceborn" },
    { name = "CAD_ANALYSIS_ENABLED", value = "true" },
    { name = "CELERY_CAD_QUEUE", value = "cad" },
  ]

  streams_backend_secrets = [
    { name = "COPILOT_TOKEN", valueFrom = aws_secretsmanager_secret.copilot_token.arn },
  ]
}
