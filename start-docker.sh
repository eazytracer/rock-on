#!/bin/bash
# =============================================================================
# Rock-On Docker Startup Script
# =============================================================================
# Starts the full development stack:
# 1. Initializes Supabase via CLI (creates DB, roles, runs migrations/seed)
# 2. Starts nginx proxy (if HOST_IP set, for phone testing)
# 3. Starts the Rock-On app container
#
# Usage:
#   ./start-docker.sh                           # Start with localhost
#   HOST_IP=192.168.1.100 ./start-docker.sh     # Start for phone testing
# =============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=============================================="
echo "Rock-On Docker Development Stack"
echo -e "==============================================${NC}"

HOST_IP="${HOST_IP:-localhost}"
export HOST_IP

echo -e "${YELLOW}Host IP: $HOST_IP${NC}"
echo ""

# Step 1: Initialize Supabase
echo -e "${GREEN}[1/2] Initializing Supabase...${NC}"
docker compose --profile init run --rm supabase-init

# Step 2: Start the app (and proxy if external access needed)
echo ""
echo -e "${GREEN}[2/2] Starting Rock-On app...${NC}"

if [ "$HOST_IP" != "localhost" ]; then
    echo -e "${YELLOW}External access enabled - starting nginx proxy${NC}"
    docker compose --profile proxy up --build -d supabase-proxy
    echo ""
    echo -e "${GREEN}Access from phone:${NC}"
    echo "  App:     http://$HOST_IP:5173"
    echo "  API:     http://$HOST_IP:54321"
    echo "  Studio:  http://$HOST_IP:54323"
    echo ""
fi

docker compose up --build rock-on-dev
