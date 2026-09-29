#!/bin/bash

# Spaceborn AWS EC2 Deployment Script
# Run this on your EC2 instance to spin up the architecture.

echo "🚀 Starting Spaceborn Deployment on AWS EC2..."

# 1. Update and install Docker & Docker Compose (if not already installed)
if ! command -v docker &> /dev/null
then
    echo "Installing Docker..."
    sudo apt-get update
    sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
    sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-compose-plugin
fi

# 2. Set up environment variables
# Note: You should have a .env file on your EC2 instance containing Supabase & Firebase credentials.
if [ ! -f .env ]; then
    echo "⚠️ Warning: .env file not found. Creating a template..."
    cat <<EOT >> .env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id

# Stripe Payment Gateway API Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
EOT
    echo "Please edit the .env file with your actual keys before running docker-compose."
fi

# 3. Pull latest changes from GitHub (ensure you are logged into git)
echo "Pulling latest code from GitHub..."
git pull origin main

# 4. Build and start the containers in detached mode
echo "Spinning up Docker containers (Next.js, Celery, Redis, RabbitMQ)..."
sudo docker compose up --build -d

echo "✅ Deployment complete! Services are running in the background."
echo "View logs with: sudo docker compose logs -f"
