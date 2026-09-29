#!/bin/bash
set -e

echo "Starting Spaceborn Infrastructure Deployment..."

# Change to terraform directory
cd terraform

echo "Initializing Terraform..."
terraform init

echo "Step 1: Creating ECR Repositories..."
terraform apply -target=aws_ecr_repository.spaceborn -target=aws_ecr_repository.spaceborn_celery -auto-approve

# Get AWS Account ID and Region
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"
REPO_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/spaceborn-frontend"
CELERY_REPO_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/spaceborn-celery"

echo "Logging into AWS ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

echo "Building Spaceborn Next.js image..."
cd ..
docker build -t spaceborn-frontend -f shoppingwebsite-frontend/Dockerfile ./shoppingwebsite-frontend
echo "Tagging and pushing Next.js image to ECR..."
docker tag spaceborn-frontend:latest $REPO_URI:latest
docker push $REPO_URI:latest

echo "Building Spaceborn Celery Worker image..."
docker build -t spaceborn-celery -f backend-workers/Dockerfile ./backend-workers
echo "Tagging and pushing Celery image to ECR..."
docker tag spaceborn-celery:latest $CELERY_REPO_URI:latest
docker push $CELERY_REPO_URI:latest

echo "Step 2: Deploying remaining ECS Infrastructure (VPC, CloudMap, RabbitMQ, Redis, Frontend)..."
cd terraform
terraform apply -auto-approve \
  -var="supabase_url=$NEXT_PUBLIC_SUPABASE_URL" \
  -var="supabase_anon_key=$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -var="firebase_api_key=$NEXT_PUBLIC_FIREBASE_API_KEY" \
  -var="ecr_image_uri=$REPO_URI:latest" \
  -var="ecr_celery_image_uri=$CELERY_REPO_URI:latest"

echo "======================================"
echo "Infrastructure deployment complete!"
echo "Public App is exposed on port 3000."
echo "Admin App is strictly isolated on port 4000."
echo "Redis, RabbitMQ, and Celery are deployed via ECS AWS CloudMap (Service Discovery)."
echo "======================================"
