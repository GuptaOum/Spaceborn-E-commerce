# Transactional email (order confirmations with the handover OTP, status updates, vendor alerts).
# The sender address must confirm the verification mail SES sends before anything is delivered.
# New accounts start in the SES sandbox: only verified recipients receive mail until production
# access is requested in the SES console.
resource "aws_sesv2_email_identity" "sender" {
  count          = var.mail_from == "" ? 0 : 1
  email_identity = var.mail_from
}

resource "aws_sesv2_configuration_set" "main" {
  configuration_set_name = "${local.name}-mail"

  reputation_options {
    reputation_metrics_enabled = true
  }
}

data "aws_iam_policy_document" "backend_ses" {
  statement {
    actions   = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "ses:FromAddress"
      values   = [var.mail_from]
    }
  }
}

resource "aws_iam_role_policy" "backend_ses" {
  count  = var.mail_from == "" ? 0 : 1
  name   = "ses-send"
  role   = aws_iam_role.backend_task.id
  policy = data.aws_iam_policy_document.backend_ses.json
}
