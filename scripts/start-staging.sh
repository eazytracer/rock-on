#!/bin/bash
# Staging environment startup script
# Uses remote Supabase for testing production-like setup

set -e

echo "🎸 Starting Rock-On Staging Environment"
echo ""

# Set staging environment
./scripts/env-setup.sh staging

echo ""
echo "🚀 Starting Vite development server in staging mode..."
npm run dev
