#!/usr/bin/env bash
set -euo pipefail

echo "=================================================="
echo "Spaceborn Complete Infrastructure Teardown"
echo "=================================================="

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$REPO_ROOT/terraform"

cd "$TERRAFORM_DIR"

# Detach the CloudFront distributions so destroy leaves them running and the URLs never change.
# `ops/spaceborn.ps1 up` re-imports them by comment (see terraform/cloudfront.tf).
echo "Keeping the CloudFront distributions so the URLs stay the same next time..."
for addr in 'aws_cloudfront_distribution.main[0]' 'aws_cloudfront_distribution.vendor[0]'; do
  if terraform state list 2>/dev/null | grep -qxF "$addr"; then
    terraform state rm -no-color "$addr" >/dev/null
    echo "  kept $addr"
  fi
done

echo "Tearing down all other AWS resources via Terraform destroy..."
terraform destroy -auto-approve -input=false

echo "=================================================="
echo "Infrastructure torn down. Only the two idle CloudFront distributions remain (no monthly fee)."
echo "Bring it back with the same URLs: ./ops/spaceborn.ps1 up"
echo "=================================================="
