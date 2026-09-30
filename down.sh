#!/usr/bin/env bash
set -euo pipefail

echo "=================================================="
echo "Spaceborn Complete Infrastructure Teardown"
echo "=================================================="

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$REPO_ROOT/terraform"

echo "Tearing down all AWS resources via Terraform destroy..."
cd "$TERRAFORM_DIR"
terraform destroy -auto-approve -input=false

echo "=================================================="
echo "Infrastructure completely torn down! All AWS traces removed."
echo "=================================================="
