#!/bin/bash
set -e

echo "======================================"
echo "Spaceborn Automated Teardown Script"
echo "======================================"

cd "$(dirname "$0")/../terraform"

echo "Running terraform destroy to tear down all AWS resources..."
echo "Note: ECR Repositories are configured with force_delete = true,"
echo "so all Docker images will be completely removed as requested."

# We pass dummy variables because Terraform destroy still requires variable inputs
terraform destroy -auto-approve -var="ecr_image_uri=dummy" -var="ecr_celery_image_uri=dummy" -var="supabase_url=dummy" -var="supabase_anon_key=dummy" -var="firebase_api_key=dummy"

echo "======================================"
echo "Teardown complete! All AWS traces removed."
echo "======================================"
