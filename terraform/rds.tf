# Subnet Group for RDS (RDS requires at least 2 subnets in different AZs normally, 
# but for a simple dev setup we can create a secondary private subnet if needed, 
# or force it into one if Multi-AZ is false)

# Create a second private subnet for RDS in a different AZ to satisfy RDS subnet group requirements
resource "aws_subnet" "private_db" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.3.0/24"
  map_public_ip_on_launch = false
  availability_zone       = "us-east-1b"
  tags                    = { Name = "spaceborn-private-db-subnet" }
}

resource "aws_db_subnet_group" "rds_subnet_group" {
  name       = "spaceborn-rds-subnet-group"
  subnet_ids = [aws_subnet.private.id, aws_subnet.private_db.id]

  tags = {
    Name = "Spaceborn DB subnet group"
  }
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "postgres" {
  identifier             = "spaceborn-db"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  engine                 = "postgres"
  engine_version         = "15.3"
  username               = "postgres"
  password               = var.db_password # Must be passed via variables or secrets
  db_subnet_group_name   = aws_db_subnet_group.rds_subnet_group.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  publicly_accessible    = false
  skip_final_snapshot    = true # Set to false for production

  tags = {
    Name = "spaceborn-postgres-rds"
  }
}
