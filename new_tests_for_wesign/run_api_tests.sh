#!/bin/bash
# WeSign API Testing with Newman - Comprehensive Test Runner
# Author: WeSign QA Team
# Usage: ./run_api_tests.sh [module|full|regression]

echo "========================================"
echo "WeSign API Testing Suite via Newman"
echo "========================================"
echo

# Create required directories
mkdir -p reports data logs

# Set timestamp for unique file names
timestamp=$(date +"%Y%m%d-%H%M%S")

# Check if Newman is installed
if ! command -v newman &> /dev/null; then
    echo "ERROR: Newman is not installed or not in PATH"
    echo "Please install Newman: npm install -g newman"
    echo "Also install HTML reporter: npm install -g newman-reporter-htmlextra"
    exit 1
fi

# Default to full regression if no parameter provided
test_type=${1:-full}

echo "Running WeSign API tests - Type: $test_type"
echo "Timestamp: $timestamp"
echo

# Function to run full regression
run_full_regression() {
    echo "=========================================="
    echo "Running FULL REGRESSION TEST SUITE"
    echo "=========================================="
    newman run "./api_tests/WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json" \
      -e "./api_tests/WeSign API Environment.postman_environment.json" \
      --env-var "baseUrl=https://devtest.comda.co.il/userapi/ui/v3" \
      --env-var "base_url=https://devtest.comda.co.il" \
      -r cli,json,htmlextra \
      --reporter-json-export "./reports/regression-full-$timestamp.json" \
      --reporter-htmlextra-export "./reports/regression-full-$timestamp.html" \
      --reporter-htmlextra-title "WeSign API Full Regression - $timestamp" \
      --reporter-htmlextra-showEnvironmentData \
      --export-environment "./data/env-state-$timestamp.json" \
      --export-globals "./data/global-state-$timestamp.json" \
      --export-collection "./data/collection-final-$timestamp.json" \
      --delay-request 150 \
      --timeout-request 20000 \
      --verbose
}

# Function to run module-specific tests
run_module_test() {
    local module_name=$1
    local folder_name=$2

    echo "=========================================="
    echo "Running $module_name MODULE TESTS"
    echo "=========================================="
    newman run "./api_tests/WeSign_ULTIMATE_COMPLETE_API_TESTING_SUITE.json" \
      -e "./api_tests/WeSign API Environment.postman_environment.json" \
      --env-var "baseUrl=https://devtest.comda.co.il/userapi/ui/v3" \
      --env-var "base_url=https://devtest.comda.co.il" \
      --folder "$folder_name" \
      -r cli,json,htmlextra \
      --reporter-json-export "./reports/${module_name,,}-module-$timestamp.json" \
      --reporter-htmlextra-export "./reports/${module_name,,}-module-$timestamp.html" \
      --reporter-htmlextra-title "WeSign API $module_name Module - $timestamp" \
      --export-environment "./data/${module_name,,}-env-$timestamp.json" \
      --delay-request 150 \
      --timeout-request 20000 \
      --verbose
}

# Route to appropriate test function
case $test_type in
    "full"|"regression")
        run_full_regression
        ;;
    "users")
        run_module_test "Users" "Users - Phase 1: Authentication Flow Tests"
        ;;
    "contacts")
        run_module_test "Contacts" "Contacts - Phase 1: Authentication Setup"
        ;;
    "templates")
        run_module_test "Templates" "Templates - Phase 1: Authentication Setup"
        ;;
    "documents")
        run_module_test "Documents" "Document Collections - Phase 1: Authentication Setup"
        ;;
    "distribution")
        run_module_test "Distribution" "Distribution - Phase 1: Authentication Flow Tests"
        ;;
    "links")
        run_module_test "Links" "Links - Phase 1: Authentication Setup"
        ;;
    "config")
        run_module_test "Configuration" "Configuration - Phase 1: Authentication Setup"
        ;;
    "files")
        run_module_test "Files" "Files - Phase 1: Authentication Setup"
        ;;
    "statistics")
        run_module_test "Statistics" "Statistics - Phase 1: Authentication Setup"
        ;;
    "tablets")
        run_module_test "Tablets" "Tablets - Phase 1: Authentication Setup"
        ;;
    *)
        echo "Invalid test type: $test_type"
        echo "Valid options: full, regression, users, contacts, templates, documents, distribution, links, config, files, statistics, tablets"
        exit 1
        ;;
esac

echo
echo "=========================================="
echo "TEST EXECUTION COMPLETED"
echo "=========================================="
echo "Reports available in: ./reports/"
echo "Raw data available in: ./data/"
echo "Timestamp: $timestamp"
echo