resource "aws_security_group" "public_alb" {
  name        = "${local.name}-public-alb"
  description = "Internet-facing load balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "To targets inside the VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }
}

resource "aws_security_group" "admin_alb" {
  name        = "${local.name}-admin-alb"
  description = "Internal load balancer for the admin panel"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from the VPC and VPN ranges"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = concat([var.vpc_cidr], var.admin_allowed_cidrs)
  }

  egress {
    description = "To targets inside the VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }
}

resource "aws_security_group" "web" {
  name        = "${local.name}-web"
  description = "Next.js frontends"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Next.js from load balancers"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.public_alb.id, aws_security_group.admin_alb.id]
  }

  egress {
    description = "Outbound (Firebase, API)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "api" {
  name        = "${local.name}-api"
  description = "Backend API"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "API from load balancers"
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.public_alb.id, aws_security_group.admin_alb.id]
  }

  egress {
    description = "Outbound (RDS, Firebase, Razorpay)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "worker" {
  name        = "${local.name}-worker"
  description = "Background worker, no inbound traffic"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "Outbound (RDS, Razorpay refunds)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "bastion" {
  name        = "${local.name}-bastion"
  description = "SSM-managed jump host, no inbound traffic"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "Outbound (SSM, RDS, admin ALB)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "db" {
  name        = "${local.name}-db"
  description = "PostgreSQL, reachable only from the API, worker and bastion"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "PostgreSQL"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [
      aws_security_group.api.id,
      aws_security_group.worker.id,
      aws_security_group.bastion.id,
    ]
  }
}
