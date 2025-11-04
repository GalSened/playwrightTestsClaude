#!/bin/bash
#
# Local CI/CD Test Execution Script
# Simulates CI/CD pipeline execution locally for validation before pushing
#
# Usage:
#   ./scripts/run-tests-local.sh [module]
#
# Examples:
#   ./scripts/run-tests-local.sh           # Run all tests (full pipeline)
#   ./scripts/run-tests-local.sh contacts  # Run only contacts module
#   ./scripts/run-tests-local.sh smoke     # Run smoke tests only
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-https://devtest.comda.co.il}"
REPORTS_DIR="reports"
ARTIFACTS_DIR="artifacts"
MODULE="${1:-all}"

# Functions
print_header() {
    echo -e "\n${BLUE}=====================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=====================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Cleanup previous test artifacts
cleanup_artifacts() {
    print_header "Cleaning up previous test artifacts"

    if [ -d "$REPORTS_DIR" ]; then
        rm -rf "$REPORTS_DIR"
        print_info "Removed old reports directory"
    fi

    if [ -d "$ARTIFACTS_DIR" ]; then
        rm -rf "$ARTIFACTS_DIR"
        print_info "Removed old artifacts directory"
    fi

    # Create fresh directories
    mkdir -p "$REPORTS_DIR"/{html,junit,json,api,coverage}
    mkdir -p "$ARTIFACTS_DIR"/{screenshots,videos,traces}

    print_success "Created fresh artifact directories"
}

# Check dependencies
check_dependencies() {
    print_header "Checking dependencies"

    # Check Python
    if ! command -v py &> /dev/null; then
        print_error "Python not found. Please install Python 3.12+"
        exit 1
    fi

    PYTHON_VERSION=$(py --version 2>&1 | awk '{print $2}')
    print_success "Python $PYTHON_VERSION found"

    # Check pip packages
    if ! py -m pip show pytest &> /dev/null; then
        print_error "pytest not installed. Run: pip install -r requirements.txt"
        exit 1
    fi
    print_success "pytest installed"

    if ! py -m pip show playwright &> /dev/null; then
        print_error "playwright not installed. Run: pip install -r requirements.txt"
        exit 1
    fi
    print_success "playwright installed"

    # Check Playwright browsers
    if ! py -m playwright --version &> /dev/null; then
        print_error "Playwright CLI not available"
        exit 1
    fi
    print_success "Playwright CLI available"

    # Check Newman (for API tests)
    if ! command -v newman &> /dev/null; then
        print_warning "Newman not found. API tests will be skipped. Install with: npm install -g newman newman-reporter-htmlextra"
    else
        NEWMAN_VERSION=$(newman --version 2>&1)
        print_success "Newman $NEWMAN_VERSION found"
    fi
}

# Run smoke tests
run_smoke_tests() {
    print_header "Running Smoke Tests"

    py -m pytest tests/ -m smoke -v \
        --maxfail=1 \
        --tb=short \
        --junit-xml="$REPORTS_DIR/junit/smoke.xml" \
        --html="$REPORTS_DIR/html/smoke.html" \
        --self-contained-html \
        || { print_error "Smoke tests failed"; return 1; }

    print_success "Smoke tests passed"
}

# Run contacts module tests
run_contacts_tests() {
    print_header "Running Contacts Module Tests"

    py -m pytest tests/contacts/ -v \
        --maxfail=999 \
        --tb=short \
        --junit-xml="$REPORTS_DIR/junit/contacts.xml" \
        --html="$REPORTS_DIR/html/contacts.html" \
        --self-contained-html \
        || { print_error "Contacts tests failed"; return 1; }

    print_success "Contacts tests passed"
}

# Run documents module tests
run_documents_tests() {
    print_header "Running Documents Module Tests"

    py -m pytest tests/documents/ -v \
        --maxfail=999 \
        --tb=short \
        --junit-xml="$REPORTS_DIR/junit/documents.xml" \
        --html="$REPORTS_DIR/html/documents.html" \
        --self-contained-html \
        || { print_error "Documents tests failed"; return 1; }

    print_success "Documents tests passed"
}

# Run templates module tests
run_templates_tests() {
    print_header "Running Templates Module Tests (STRONG Assertions)"

    py -m pytest tests/templates/test_templates_real_validation.py -v \
        --maxfail=999 \
        --tb=short \
        --junit-xml="$REPORTS_DIR/junit/templates.xml" \
        --html="$REPORTS_DIR/html/templates.html" \
        --self-contained-html \
        || { print_error "Templates tests failed"; return 1; }

    print_success "Templates tests passed"
}

# Run self-signing module tests
run_self_signing_tests() {
    print_header "Running Self-Signing Module Tests"

    py -m pytest tests/self_signing/ -v \
        --maxfail=999 \
        --tb=short \
        --junit-xml="$REPORTS_DIR/junit/self-signing.xml" \
        --html="$REPORTS_DIR/html/self-signing.html" \
        --self-contained-html \
        || { print_error "Self-signing tests failed"; return 1; }

    print_success "Self-signing tests passed"
}

# Run API tests with Newman
run_api_tests() {
    print_header "Running API Tests (Newman)"

    if ! command -v newman &> /dev/null; then
        print_warning "Newman not found. Skipping API tests."
        return 0
    fi

    cd api_tests

    # Get all Postman collections
    for collection in *.postman_collection.json; do
        [ -f "$collection" ] || continue

        collection_name=$(basename "$collection" .postman_collection.json)
        print_info "Running API collection: $collection_name"

        newman run "$collection" \
            -e WeSign_Unified_Environment.postman_environment.json \
            -r cli,htmlextra \
            --reporter-htmlextra-export "../$REPORTS_DIR/api/${collection_name}.html" \
            --reporter-htmlextra-title "WeSign API Tests - $collection_name" \
            || { print_warning "API collection $collection_name failed"; }
    done

    cd ..
    print_success "API tests completed"
}

# Generate test summary
generate_summary() {
    print_header "Generating Test Summary"

    TOTAL_TESTS=0
    PASSED_TESTS=0
    FAILED_TESTS=0

    # Parse JUnit XML files if they exist
    if ls "$REPORTS_DIR/junit/"*.xml 1> /dev/null 2>&1; then
        for xml in "$REPORTS_DIR/junit/"*.xml; do
            if command -v xmllint &> /dev/null; then
                tests=$(xmllint --xpath "string(//testsuite/@tests)" "$xml" 2>/dev/null || echo "0")
                failures=$(xmllint --xpath "string(//testsuite/@failures)" "$xml" 2>/dev/null || echo "0")

                TOTAL_TESTS=$((TOTAL_TESTS + tests))
                FAILED_TESTS=$((FAILED_TESTS + failures))
            fi
        done

        PASSED_TESTS=$((TOTAL_TESTS - FAILED_TESTS))
    fi

    echo ""
    echo "========================================="
    echo "           TEST SUMMARY                  "
    echo "========================================="
    echo ""
    echo "Total Tests:  $TOTAL_TESTS"
    echo "Passed:       $PASSED_TESTS"
    echo "Failed:       $FAILED_TESTS"
    echo ""

    if [ -d "$REPORTS_DIR/html" ]; then
        echo "HTML Reports: $REPORTS_DIR/html/"
        ls -1 "$REPORTS_DIR/html/"*.html 2>/dev/null || echo "  (none)"
    fi

    if [ -d "$REPORTS_DIR/api" ]; then
        echo ""
        echo "API Reports:  $REPORTS_DIR/api/"
        ls -1 "$REPORTS_DIR/api/"*.html 2>/dev/null || echo "  (none)"
    fi

    echo ""
    echo "========================================="

    if [ $FAILED_TESTS -eq 0 ]; then
        print_success "All tests passed! ✅"
        return 0
    else
        print_error "$FAILED_TESTS test(s) failed ❌"
        return 1
    fi
}

# Main execution
main() {
    print_header "WeSign CI/CD Local Test Execution"
    print_info "Module: $MODULE"
    print_info "Base URL: $BASE_URL"

    # Step 1: Check dependencies
    check_dependencies

    # Step 2: Cleanup
    cleanup_artifacts

    # Step 3: Run tests based on module
    TEST_RESULT=0

    case "$MODULE" in
        smoke)
            run_smoke_tests || TEST_RESULT=1
            ;;
        contacts)
            run_contacts_tests || TEST_RESULT=1
            ;;
        documents)
            run_documents_tests || TEST_RESULT=1
            ;;
        templates)
            run_templates_tests || TEST_RESULT=1
            ;;
        self-signing)
            run_self_signing_tests || TEST_RESULT=1
            ;;
        api)
            run_api_tests || TEST_RESULT=1
            ;;
        all)
            run_smoke_tests || TEST_RESULT=1
            run_api_tests || TEST_RESULT=1
            run_contacts_tests || TEST_RESULT=1
            run_documents_tests || TEST_RESULT=1
            run_templates_tests || TEST_RESULT=1
            run_self_signing_tests || TEST_RESULT=1
            ;;
        *)
            print_error "Unknown module: $MODULE"
            print_info "Valid modules: smoke, contacts, documents, templates, self-signing, api, all"
            exit 1
            ;;
    esac

    # Step 4: Generate summary
    generate_summary

    # Return overall result
    exit $TEST_RESULT
}

# Run main
main
