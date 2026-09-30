# CDN in front of the public load balancer. Two jobs:
#   1. Cache Next.js build assets at the edge so a task never serves the same chunk twice.
#   2. Give the storefront HTTPS on a *.cloudfront.net name, before a real domain exists.
# The vendor hub is not fronted here: it is a separate app served on the ALB's port 8080 at the
# same root path, so CloudFront cannot tell it apart from the storefront by path alone.

locals {
  cloudfront_enabled = var.enable_cloudfront && !local.https_enabled
  alb_origin_id      = "alb-public"
}

# AWS-managed policies, referenced by ID so no custom policy has to be maintained.
locals {
  cache_optimized_id  = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
  cache_disabled_id   = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # CachingDisabled
  forward_all_id      = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # AllViewerExceptHostHeader
}

resource "aws_cloudfront_distribution" "main" {
  count = local.cloudfront_enabled ? 1 : 0

  enabled         = true
  comment         = "${local.name} storefront and API"
  # PriceClass_100 has no Indian edge locations; 200 adds Mumbai/Chennai/Hyderabad.
  price_class     = "PriceClass_200"
  http_version    = "http2and3"
  is_ipv6_enabled = true

  origin {
    origin_id   = local.alb_origin_id
    domain_name = aws_lb.public.dns_name

    custom_origin_config {
      http_port  = 80
      https_port = 443
      # The ALB has no certificate yet, so this hop is plain HTTP across the public internet to an
      # internet-facing ALB. Bearer tokens ride it in cleartext; replace once a domain is attached.
      origin_protocol_policy   = "http-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 30
      origin_keepalive_timeout = 5
    }
  }

  # Everything not matched below: HTML, server actions and the whole API. Never cached, and the
  # Authorization header must survive or every authenticated request would fail.
  default_cache_behavior {
    target_origin_id         = local.alb_origin_id
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = local.cache_disabled_id
    origin_request_policy_id = local.forward_all_id
  }

  # Next.js fingerprints these filenames, so they can be cached hard and forever.
  ordered_cache_behavior {
    path_pattern           = "/_next/static/*"
    target_origin_id       = local.alb_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = local.cache_optimized_id
  }

  ordered_cache_behavior {
    path_pattern           = "/spaceborn-logo.*"
    target_origin_id       = local.alb_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = local.cache_optimized_id
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}
