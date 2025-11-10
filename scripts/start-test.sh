#!/bin/bash
# Test environment startup script
# For CI/CD and integration tests

set -e

echo "🧪 Starting Rock-On Test Environment"
echo ""

# Check if Supabase is running (for integration tests)
if ! supabase status &> /dev/null; then
    echo "📦 Starting Supabase for integration tests..."
    supabase start
    echo ""
fi

# Set test environment
./scripts/env-setup.sh test

echo ""
echo "🧪 Running tests..."
npm run test:all
