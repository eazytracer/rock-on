#!/bin/bash
# Complete development environment startup script
# Starts Supabase, edge functions, sets environment, and launches dev server

set -e

echo "🎸 Starting Rock-On Development Environment"
echo ""

# Check if Supabase is running
if ! supabase status &> /dev/null; then
    echo "📦 Starting Supabase..."
    supabase start
    echo ""
else
    echo "✅ Supabase is already running"
    echo ""
fi

# Generate .env.development if it doesn't exist (first time or after clean)
if [ ! -f ".env.development" ]; then
    echo "📝 .env.development not found — running setup:local to generate it..."
    ./scripts/setup-local-env.sh
    echo ""
fi

# Set development environment
./scripts/env-setup.sh development

# Start edge functions runtime in the background
echo ""
echo "⚡ Starting Edge Functions runtime..."
supabase functions serve --no-verify-jwt > /tmp/edge-functions.log 2>&1 &
EDGE_PID=$!
echo "   Edge functions running (PID $EDGE_PID) → logs: /tmp/edge-functions.log"
echo "   Functions available at: http://127.0.0.1:54321/functions/v1/<name>"

echo ""
echo "🚀 Starting Vite development server..."
npm run dev
