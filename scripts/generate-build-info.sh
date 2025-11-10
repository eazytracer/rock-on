#!/bin/bash
# Generate build info with git commit hash and timestamp
# This script should run before every build (prebuild step)

set -e

# Get git commit hash (short form)
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "local")

# Get current timestamp (YYYYMMDD-HHMMSS format)
TIMESTAMP=$(date -u +"%Y%m%d-%H%M%S")

# Check if we're in Vercel environment
if [ -n "$VERCEL_GIT_COMMIT_SHA" ]; then
  GIT_HASH="${VERCEL_GIT_COMMIT_SHA:0:7}"
  echo "📦 Vercel build detected - using commit: $GIT_HASH"
fi

# Generate BUILD_ID
BUILD_ID="${GIT_HASH}-${TIMESTAMP}"

# Write to buildInfo.ts
cat > src/config/buildInfo.ts <<EOF
export const BUILD_ID = '${BUILD_ID}';
EOF

echo "✅ Generated BUILD_ID: ${BUILD_ID}"
echo "   Location: src/config/buildInfo.ts"
