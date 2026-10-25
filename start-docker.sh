#!/bin/bash
# =============================================================================
# Rock-On Docker Startup Script
# =============================================================================
# Starts the full development stack:
# 1. Starts Supabase via the host CLI (creates DB, roles, runs migrations/seed)
#    and serves edge functions
# 2. Starts the Rock-On app container. In dev the app calls Supabase on
#    whatever host it was opened from (port 54321), so it also works from other
#    machines on the LAN and phones at http://<this-machine's-ip>:5173.
#
# Usage:
#   ./start-docker.sh
# =============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=============================================="
echo "Rock-On Docker Development Stack"
echo -e "==============================================${NC}"

# Step 1: Start Supabase with the host CLI (it runs its services in Docker).
# Current CLI releases are glibc-linked, so they can't run in an alpine init
# container — and the edge functions below need the host CLI anyway.
echo -e "${GREEN}[1/2] Starting Supabase...${NC}"
if ! command -v supabase >/dev/null 2>&1; then
    echo "Supabase CLI not found — install it: brew install supabase/tap/supabase" >&2
    exit 1
fi
if supabase status >/dev/null 2>&1; then
    echo "  ✓ Supabase is already running"
else
    supabase start
fi

# Edge functions (jam-view, Spotify search) aren't part of the app container;
# serve them with the host's Supabase CLI against the same local stack.
echo ""
echo -e "${GREEN}Starting edge functions...${NC}"
supabase functions serve --no-verify-jwt > /tmp/edge-functions.log 2>&1 &
echo "  Edge functions running (PID $!) → logs: /tmp/edge-functions.log"

# Step 2: Start the app
echo ""
echo -e "${GREEN}[2/2] Starting Rock-On app...${NC}"
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
echo -e "${YELLOW}  App: http://localhost:5173${LAN_IP:+  ·  LAN/phone: http://$LAN_IP:5173}${NC}"

docker compose up --build rock-on-dev
