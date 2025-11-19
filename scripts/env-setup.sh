#!/bin/bash
# Environment setup script for Rock-On
# Usage: ./scripts/env-setup.sh [development|staging|test|production]

set -e

ENV=${1:-development}
ENV_FILE=".env.${ENV}"

echo "🔧 Setting up environment: $ENV"

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: Environment file $ENV_FILE not found"
    echo "Available environments:"
    ls -1 .env.* | sed 's/\.env\./  - /'
    exit 1
fi

# Copy to .env.local (Vite's default)
cp "$ENV_FILE" .env.local

echo "✅ Copied $ENV_FILE to .env.local"
echo ""
echo "Current environment configuration:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep "^VITE_" .env.local | while IFS= read -r line; do
    key=$(echo "$line" | cut -d'=' -f1)
    value=$(echo "$line" | cut -d'=' -f2)

    # Mask sensitive values
    if [[ $key == *"KEY"* ]] || [[ $key == *"TOKEN"* ]]; then
        echo "$key=***masked***"
    else
        echo "$line"
    fi
done
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Environment-specific setup
case $ENV in
    development)
        echo "📦 Development mode selected"
        echo "   - Using local Supabase (http://127.0.0.1:54321)"
        echo "   - Email confirmations disabled"
        echo "   - Run: supabase start (if not already running)"
        ;;
    staging)
        echo "🚀 Staging mode selected"
        echo "   - Using remote Supabase"
        echo "   - Production-like configuration"
        echo "   - Email confirmations enabled"
        ;;
    test)
        echo "🧪 Test mode selected"
        echo "   - Mock auth enabled"
        echo "   - For CI/CD and integration tests"
        ;;
    production)
        echo "🏭 Production mode selected"
        echo "   - Using production Supabase"
        echo "   - ⚠️  Use with caution!"
        ;;
esac

echo ""
echo "✨ Environment setup complete!"
echo "   Run 'npm run dev' to start the development server"
