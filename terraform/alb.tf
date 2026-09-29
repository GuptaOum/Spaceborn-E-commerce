locals {
  https_enabled = var.acm_certificate_arn != ""
}

# Public: storefront at the root domain, vendor hub at vendor.<domain>, API at /v1 on both.
resource "aws_lb" "public" {
  name                       = "${local.name}-public"
  load_balancer_type         = "application"
  internal                   = false
  security_groups            = [aws_security_group.public_alb.id]
  subnets                    = aws_subnet.public[*].id
  drop_invalid_header_fields = true
  enable_deletion_protection = var.environment == "prod"
}

resource "aws_lb_target_group" "storefront" {
  name                 = "${local.name}-storefront"
  port                 = 3000
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 30

  health_check {
    path    = "/"
    matcher = "200-399"
  }
}

resource "aws_lb_target_group" "vendor_hub" {
  name                 = "${local.name}-vendor"
  port                 = 3000
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 30

  health_check {
    path    = "/"
    matcher = "200-399"
  }
}

resource "aws_lb_target_group" "api_public" {
  name                 = "${local.name}-api-pub"
  port                 = 4000
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 30

  health_check {
    path    = "/health"
    matcher = "200"
  }
}

resource "aws_lb_listener" "public_http" {
  load_balancer_arn = aws_lb.public.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = local.https_enabled ? "redirect" : "forward"

    target_group_arn = local.https_enabled ? null : aws_lb_target_group.storefront.arn

    dynamic "redirect" {
      for_each = local.https_enabled ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }
}

resource "aws_lb_listener" "public_https" {
  count             = local.https_enabled ? 1 : 0
  load_balancer_arn = aws_lb.public.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.storefront.arn
  }
}

locals {
  public_listener_arn = local.https_enabled ? aws_lb_listener.public_https[0].arn : aws_lb_listener.public_http.arn
  public_origin       = local.https_enabled ? "https://${var.domain_name}" : "http://${aws_lb.public.dns_name}"
  vendor_origin       = local.https_enabled ? "https://vendor.${var.domain_name}" : "http://${aws_lb.public.dns_name}:8080"
}

# Without a real domain there is no host header to route on, so the vendor hub gets its own port.
resource "aws_lb_listener" "vendor_http" {
  count             = local.https_enabled ? 0 : 1
  load_balancer_arn = aws_lb.public.arn
  port              = 8080
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.vendor_hub.arn
  }
}

resource "aws_lb_listener_rule" "vendor_block_admin_api" {
  count        = local.https_enabled ? 0 : 1
  listener_arn = aws_lb_listener.vendor_http[0].arn
  priority     = 10

  action {
    type = "fixed-response"
    fixed_response {
      content_type = "application/json"
      message_body = "{\"error\":\"forbidden\"}"
      status_code  = "403"
    }
  }

  condition {
    path_pattern {
      values = ["/v1/admin", "/v1/admin/*"]
    }
  }
}

resource "aws_lb_listener_rule" "vendor_api" {
  count        = local.https_enabled ? 0 : 1
  listener_arn = aws_lb_listener.vendor_http[0].arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api_public.arn
  }

  condition {
    path_pattern {
      values = ["/v1/*"]
    }
  }
}

# Admin endpoints are only reachable through the internal load balancer.
resource "aws_lb_listener_rule" "block_admin_api" {
  listener_arn = local.public_listener_arn
  priority     = 10

  action {
    type = "fixed-response"
    fixed_response {
      content_type = "application/json"
      message_body = "{\"error\":\"forbidden\"}"
      status_code  = "403"
    }
  }

  condition {
    path_pattern {
      values = ["/v1/admin", "/v1/admin/*"]
    }
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = local.public_listener_arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api_public.arn
  }

  condition {
    path_pattern {
      values = ["/v1/*"]
    }
  }
}

resource "aws_lb_listener_rule" "vendor_hub" {
  listener_arn = local.public_listener_arn
  priority     = 30

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.vendor_hub.arn
  }

  condition {
    host_header {
      values = ["vendor.${var.domain_name}"]
    }
  }
}

# Internal: admin panel plus its API, reachable only from inside the VPC (SSM tunnel or VPN).
resource "aws_lb" "admin" {
  name                       = "${local.name}-admin"
  load_balancer_type         = "application"
  internal                   = true
  security_groups            = [aws_security_group.admin_alb.id]
  subnets                    = aws_subnet.app[*].id
  drop_invalid_header_fields = true
}

resource "aws_lb_target_group" "admin_panel" {
  name                 = "${local.name}-admin"
  port                 = 3000
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 30

  health_check {
    path    = "/"
    matcher = "200-399"
  }
}

resource "aws_lb_target_group" "api_internal" {
  name                 = "${local.name}-api-int"
  port                 = 4000
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 30

  health_check {
    path    = "/health"
    matcher = "200"
  }
}

resource "aws_lb_listener" "admin_http" {
  load_balancer_arn = aws_lb.admin.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.admin_panel.arn
  }
}

resource "aws_lb_listener_rule" "admin_api" {
  listener_arn = aws_lb_listener.admin_http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api_internal.arn
  }

  condition {
    path_pattern {
      values = ["/v1/*"]
    }
  }
}
