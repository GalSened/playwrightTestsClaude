#!/bin/bash
# QA Intelligence Platform - Quick Verification Script
# Usage: ./verify-system.sh

set -e

echo "🚀 QA Intelligence Platform - System Verification"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is running
echo "🔍 Checking if backend is running..."
if curl -s http://localhost:8082/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running${NC}"
    BACKEND_RUNNING=true
else
    echo -e "${RED}❌ Backend is not running${NC}"
    echo ""
    echo "To start the backend:"
    echo "  cd backend"
    echo "  npm run dev"
    echo ""
    BACKEND_RUNNING=false
    exit 1
fi

echo ""

# Phase 1: Backend Health
echo "📋 Phase 1: Backend API Health Verification"
echo "-------------------------------------------"

echo -n "Testing /health endpoint... "
HEALTH=$(curl -s http://localhost:8082/health)
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✅ PASS${NC}"
    PHASE1_SCORE=$((PHASE1_SCORE + 1))
else
    echo -e "${RED}❌ FAIL${NC}"
    echo "Response: $HEALTH"
fi

echo -n "Testing /api/health endpoint... "
API_HEALTH=$(curl -s http://localhost:8082/api/health)
if echo "$API_HEALTH" | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}✅ PASS${NC}"
    PHASE1_SCORE=$((PHASE1_SCORE + 1))
else
    echo -e "${RED}❌ FAIL${NC}"
fi

echo -n "Testing /api/wesign/health endpoint... "
WESIGN_HEALTH=$(curl -s http://localhost:8082/api/wesign/health)
if echo "$WESIGN_HEALTH" | grep -q '"healthy":true'; then
    echo -e "${GREEN}✅ PASS${NC}"
    PHASE1_SCORE=$((PHASE1_SCORE + 1))

    # Show details
    echo ""
    echo "  WeSign Health Details:"
    echo "$WESIGN_HEALTH" | python3 -m json.tool 2>/dev/null | grep -E '(pythonAvailable|pythonVersion|wesignTestsExists|pythonPath|testBasePath)' | sed 's/^/    /'
else
    echo -e "${RED}❌ FAIL${NC}"
    echo "Response: $WESIGN_HEALTH"
fi

echo ""
echo "Phase 1 Score: ${PHASE1_SCORE}/3"

# Phase 2: WeSign Integration
echo ""
echo "📋 Phase 2: WeSign Integration Testing"
echo "--------------------------------------"

PHASE2_SCORE=0

echo -n "Testing test discovery... "
TESTS=$(curl -s http://localhost:8082/api/wesign/tests)
TEST_COUNT=$(echo "$TESTS" | grep -o '"totalCount":[0-9]*' | grep -o '[0-9]*')
if [ ! -z "$TEST_COUNT" ] && [ "$TEST_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS${NC} (Found $TEST_COUNT tests)"
    PHASE2_SCORE=$((PHASE2_SCORE + 1))
else
    echo -e "${RED}❌ FAIL${NC} (No tests found)"
fi

echo -n "Testing test suites endpoint... "
SUITES=$(curl -s http://localhost:8082/api/wesign/suites)
if echo "$SUITES" | grep -q '"success":true'; then
    SUITE_COUNT=$(echo "$SUITES" | grep -o '"name":' | wc -l)
    echo -e "${GREEN}✅ PASS${NC} (Found $SUITE_COUNT suites)"
    PHASE2_SCORE=$((PHASE2_SCORE + 1))
else
    echo -e "${RED}❌ FAIL${NC}"
fi

echo ""
echo "Phase 2 Score: ${PHASE2_SCORE}/2"

# Phase 3: Database Check
echo ""
echo "📋 Phase 3: Database Operations"
echo "--------------------------------"

PHASE3_SCORE=0

echo -n "Checking database file... "
if [ -f "backend/scheduler.db" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    PHASE3_SCORE=$((PHASE3_SCORE + 1))
else
    echo -e "${YELLOW}⚠️  Database file not found${NC}"
fi

echo ""
echo "Phase 3 Score: ${PHASE3_SCORE}/1"

# Summary
echo ""
echo "========================================"
echo "📊 Verification Summary"
echo "========================================"

TOTAL_SCORE=$((PHASE1_SCORE + PHASE2_SCORE + PHASE3_SCORE))
TOTAL_TESTS=6

echo "Total Score: ${TOTAL_SCORE}/${TOTAL_TESTS}"
PERCENTAGE=$((TOTAL_SCORE * 100 / TOTAL_TESTS))
echo "Success Rate: ${PERCENTAGE}%"
echo ""

if [ "$PERCENTAGE" -ge 90 ]; then
    echo -e "${GREEN}✅ System is healthy and ready!${NC}"
    exit 0
elif [ "$PERCENTAGE" -ge 70 ]; then
    echo -e "${YELLOW}⚠️  System is mostly functional but has issues${NC}"
    exit 1
else
    echo -e "${RED}❌ System has significant issues${NC}"
    exit 1
fi
