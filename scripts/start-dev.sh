#!/bin/bash
# Complete development environment startup script
# Starts Supabase, sets environment, and launches dev server

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

# Set development environment
./scripts/env-setup.sh development

echo ""
echo "🚀 Starting Vite development server..."
npm run dev
