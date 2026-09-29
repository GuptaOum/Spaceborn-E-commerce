# Security Group for Public App (Open to the world on port 3000)
resource "aws_security_group" "public_sg" {
  name        = "spaceborn-public-sg"
  description = "Allow HTTP access from anywhere for Customers and Vendors"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Public HTTP"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Security Group for Private Admin App (Completely isolated)
resource "aws_security_group" "admin_sg" {
  name        = "spaceborn-admin-sg"
  description = "Strict private access for Admin Panel"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Allow access ONLY from within the VPC (e.g. via VPN or Bastion tunnel)"
    from_port   = 4000
    to_port     = 4000
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"] # Needed so the Admin panel can query Supabase/Stripe via NAT
  }
}

# Security Group for RDS
resource "aws_security_group" "rds_sg" {
  name        = "spaceborn-rds-sg"
  description = "Allow access to RDS from within the private subnet"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Allow PostgreSQL traffic from private subnet"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.admin_sg.id] # Allowing admin and other private apps
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
