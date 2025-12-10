#!/bin/bash

# WebSocket Production Setup Verification Script
# Run this script to verify your WebSocket setup is ready for production

echo "=========================================="
echo "WebSocket Production Setup Verification"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're on Heroku
if [ -z "$DYNO" ]; then
    echo -e "${YELLOW}Note: Not running on Heroku. Some checks may not apply.${NC}"
    echo ""
fi

# 1. Check Procfile
echo "1. Checking Procfile..."
if [ -f "Procfile" ]; then
    if grep -q "daphne" Procfile; then
        echo -e "${GREEN}✓ Root Procfile uses daphne${NC}"
    else
        echo -e "${RED}✗ Root Procfile does NOT use daphne${NC}"
        echo "  Procfile should contain: web: cd backend && daphne -b 0.0.0.0 -p \$PORT backend.asgi:application"
    fi
else
    echo -e "${RED}✗ Procfile not found in root directory${NC}"
fi
echo ""

# 2. Check requirements.txt
echo "2. Checking requirements.txt..."
if [ -f "backend/requirements.txt" ]; then
    if grep -q "channels==" backend/requirements.txt; then
        echo -e "${GREEN}✓ channels found in requirements.txt${NC}"
    else
        echo -e "${RED}✗ channels not found in requirements.txt${NC}"
    fi
    
    if grep -q "channels-redis==" backend/requirements.txt; then
        echo -e "${GREEN}✓ channels-redis found in requirements.txt${NC}"
    else
        echo -e "${RED}✗ channels-redis not found in requirements.txt${NC}"
    fi
    
    if grep -q "daphne==" backend/requirements.txt; then
        echo -e "${GREEN}✓ daphne found in requirements.txt${NC}"
    else
        echo -e "${RED}✗ daphne not found in requirements.txt${NC}"
    fi
    
    if grep -q "redis==" backend/requirements.txt; then
        echo -e "${GREEN}✓ redis found in requirements.txt${NC}"
    else
        echo -e "${RED}✗ redis not found in requirements.txt${NC}"
    fi
else
    echo -e "${RED}✗ backend/requirements.txt not found${NC}"
fi
echo ""

# 3. Check ASGI configuration
echo "3. Checking ASGI configuration..."
if [ -f "backend/backend/asgi.py" ]; then
    if grep -q "ProtocolTypeRouter" backend/backend/asgi.py; then
        echo -e "${GREEN}✓ ASGI application configured${NC}"
    else
        echo -e "${RED}✗ ASGI application not properly configured${NC}"
    fi
else
    echo -e "${RED}✗ backend/backend/asgi.py not found${NC}"
fi
echo ""

# 4. Check settings.py
echo "4. Checking Django settings..."
if [ -f "backend/backend/settings.py" ]; then
    if grep -q "ASGI_APPLICATION" backend/backend/settings.py; then
        echo -e "${GREEN}✓ ASGI_APPLICATION configured in settings${NC}"
    else
        echo -e "${RED}✗ ASGI_APPLICATION not configured${NC}"
    fi
    
    if grep -q "CHANNEL_LAYERS" backend/backend/settings.py; then
        echo -e "${GREEN}✓ CHANNEL_LAYERS configured${NC}"
    else
        echo -e "${RED}✗ CHANNEL_LAYERS not configured${NC}"
    fi
else
    echo -e "${RED}✗ backend/backend/settings.py not found${NC}"
fi
echo ""

# 5. Check Redis URL (if on Heroku)
if [ ! -z "$REDIS_URL" ]; then
    echo "5. Checking Redis configuration..."
    echo -e "${GREEN}✓ REDIS_URL environment variable is set${NC}"
    echo "  REDIS_URL: ${REDIS_URL:0:20}..."
else
    echo "5. Checking Redis configuration..."
    echo -e "${YELLOW}⚠ REDIS_URL not set (this is OK if not on Heroku)${NC}"
    echo "  On Heroku, run: heroku addons:create heroku-redis:premium-0 -a your-app-name"
fi
echo ""

# 6. Check WebSocket routing
echo "6. Checking WebSocket routing..."
if [ -f "backend/api/routing.py" ]; then
    if grep -q "websocket_urlpatterns" backend/api/routing.py; then
        echo -e "${GREEN}✓ WebSocket URL patterns configured${NC}"
    else
        echo -e "${RED}✗ WebSocket URL patterns not configured${NC}"
    fi
else
    echo -e "${RED}✗ backend/api/routing.py not found${NC}"
fi
echo ""

# 7. Check consumers
echo "7. Checking WebSocket consumers..."
if [ -f "backend/api/consumers.py" ]; then
    if grep -q "NotificationConsumer" backend/api/consumers.py; then
        echo -e "${GREEN}✓ NotificationConsumer found${NC}"
    else
        echo -e "${RED}✗ NotificationConsumer not found${NC}"
    fi
else
    echo -e "${RED}✗ backend/api/consumers.py not found${NC}"
fi
echo ""

echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. If any checks failed, fix the issues above"
echo "2. On Heroku, ensure Redis addon is installed:"
echo "   heroku addons:create heroku-redis:premium-0 -a your-app-name"
echo "3. Deploy to Heroku: git push heroku main"
echo "4. Check logs: heroku logs --tail -a your-app-name"
echo "5. Test WebSocket connection in browser console"

