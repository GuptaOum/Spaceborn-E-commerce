resource "aws_ecr_repository" "spaceborn" {
  name                 = "spaceborn-frontend"
  image_tag_mutability = "MUTABLE"
  force_delete         = true
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "spaceborn_celery" {
  name                 = "spaceborn-celery"
  image_tag_mutability = "MUTABLE"
  force_delete         = true
  image_scanning_configuration {
    scan_on_push = true
  }
}
