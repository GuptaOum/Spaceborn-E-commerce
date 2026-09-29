# Terraform only creates the container. Put the real values in once, outside Terraform:
#   aws secretsmanager put-secret-value --profile spaceborn --secret-id spaceborn-dev/app \
#     --secret-string file://app-secret.json
resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name}/app"
  description             = "Spaceborn application secrets (Firebase service account, Razorpay)"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    FIREBASE_SERVICE_ACCOUNT_JSON = "REPLACE_ME"
    RAZORPAY_KEY_ID               = "REPLACE_ME"
    RAZORPAY_KEY_SECRET           = "REPLACE_ME"
    RAZORPAY_WEBHOOK_SECRET       = "REPLACE_ME"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
