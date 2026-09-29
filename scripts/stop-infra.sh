#!/bin/bash
echo "Tearing down Spaceborn Infrastructure to save costs..."
cd terraform
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"
REPO_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/spaceborn-frontend"
CELERY_REPO_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/spaceborn-celery"

terraform destroy -auto-approve \
  -var="supabase_url=$NEXT_PUBLIC_SUPABASE_URL" \
  -var="supabase_anon_key=$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -var="firebase_api_key=$NEXT_PUBLIC_FIREBASE_API_KEY" \
  -var="ecr_image_uri=$REPO_URI:latest" \
  -var="ecr_celery_image_uri=$CELERY_REPO_URI:latest"

echo "Infrastructure completely destroyed!"
