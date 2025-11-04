#!/bin/bash

# WeSign API Test Runner
# Usage: ./run-tests.sh [smoke|regression|security|module]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

COLLECTION="WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json"
ENVIRONMENT="WeSign API Environment.postman_environment.json"
REPORT_DIR="reports"

# Create reports directory
mkdir -p "$REPORT_DIR"

echo -e "${GREEN}===================================${NC}"
echo -e "${GREEN}  WeSign API Test Execution${NC}"
echo -e "${GREEN}===================================${NC}"
echo ""

# Check if Newman is installed
if ! command -v newman &> /dev/null; then
    echo -e "${RED}Newman is not installed!${NC}"
    echo "Install with: npm install -g newman newman-reporter-htmlextra"
    exit 1
fi

# Parse test type
TEST_TYPE=${1:-regression}

case $TEST_TYPE in
    smoke)
        echo -e "${YELLOW}Running Smoke Tests...${NC}"
        newman run "$COLLECTION" \
            -e "$ENVIRONMENT" \
            --folder "Users - Phase 1: Authentication Flow Tests" \
            -r cli,htmlextra \
            --reporter-htmlextra-export "$REPORT_DIR/smoke-report.html"
        ;;

    regression)
        echo -e "${YELLOW}Running Full Regression Tests...${NC}"
        newman run "$COLLECTION" \
            -e "$ENVIRONMENT" \
            -r cli,htmlextra \
            --reporter-htmlextra-export "$REPORT_DIR/regression-report.html"
        ;;

    security)
        echo -e "${YELLOW}Running Security Tests...${NC}"
        newman run "$COLLECTION" \
            -e "$ENVIRONMENT" \
            --folder "Users - Phase 4: Security & Edge Case Tests" \
            -r cli,htmlextra \
            --reporter-htmlextra-export "$REPORT_DIR/security-report.html"
        ;;

    users)
        echo -e "${YELLOW}Running Users Module Tests...${NC}"
        newman run "$COLLECTION" \
            -e "$ENVIRONMENT" \
            --folder "Users - Phase 1: Authentication Flow Tests" \
            --folder "Users - Phase 2: Authenticated User Profile Tests" \
            --folder "Users - Phase 3: Token Management Tests" \
            --folder "Users - Phase 4: Security & Edge Case Tests" \
            -r cli,htmlextra \
            --reporter-htmlextra-export "$REPORT_DIR/users-report.html"
        ;;

    distribution)
        echo -e "${YELLOW}Running Distribution Module Tests...${NC}"
        for i in {1..8}; do
            newman run "$COLLECTION" \
                -e "$ENVIRONMENT" \
                --folder "Distribution - Phase $i" \
                -r cli
        done
        ;;

    *)
        echo -e "${RED}Invalid test type: $TEST_TYPE${NC}"
        echo ""
        echo "Usage: ./run-tests.sh [smoke|regression|security|users|distribution]"
        echo ""
        echo "  smoke       - Quick smoke tests (authentication only)"
        echo "  regression  - Full test suite (all 97 tests)"
        echo "  security    - Security tests only"
        echo "  users       - Users module tests only"
        echo "  distribution - Distribution module tests only"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}===================================${NC}"
echo -e "${GREEN}  Test Execution Complete!${NC}"
echo -e "${GREEN}===================================${NC}"
echo ""
echo "Report location: $REPORT_DIR/"
echo ""
