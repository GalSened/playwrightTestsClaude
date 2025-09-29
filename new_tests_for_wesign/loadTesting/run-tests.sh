#!/bin/bash
# WeSign K6 Load Testing - Comprehensive Test Runner
# Author: WeSign QA Team
# Usage: ./run-tests.sh [test-type] [environment] [options]

echo "========================================"
echo "WeSign K6 Load Testing Suite"
echo "========================================"
echo

# Set default values
TEST_TYPE=${1:-smoke}
ENVIRONMENT=${2:-dev}
REPORT_FORMAT=${3:-html}
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

# Environment URLs
case $ENVIRONMENT in
    "dev"|"development")
        BASE_URL="https://devtest.comda.co.il/userapi/ui/v3"
        ;;
    "staging")
        BASE_URL="https://staging.comda.co.il/userapi/ui/v3"
        ;;
    "prod"|"production")
        BASE_URL="https://app.comda.co.il/userapi/ui/v3"
        ;;
    *)
        echo "❌ Unknown environment: $ENVIRONMENT"
        echo "Valid environments: dev, staging, prod"
        exit 1
        ;;
esac

# Create required directories
mkdir -p reports data logs

# Check if K6 is installed
if ! command -v k6 &> /dev/null; then
    echo "❌ K6 is not installed or not in PATH"
    echo "Please install K6: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

echo "🎯 Test Configuration:"
echo "  Type: $TEST_TYPE"
echo "  Environment: $ENVIRONMENT"
echo "  Base URL: $BASE_URL"
echo "  Timestamp: $TIMESTAMP"
echo

# Function to run smoke tests
run_smoke_tests() {
    echo "🚬 Running Smoke Tests"
    echo "======================"

    echo "🔹 Running Basic Functionality Smoke Test..."
    k6 run \
        --env BASE_URL="$BASE_URL" \
        --out json=./reports/smoke-basic-$TIMESTAMP.json \
        --summary-export=./reports/smoke-basic-summary-$TIMESTAMP.json \
        scenarios/smoke/smoke-basic.js

    echo
    echo "🔹 Running Authentication Smoke Test..."
    k6 run \
        --env BASE_URL="$BASE_URL" \
        --out json=./reports/smoke-auth-$TIMESTAMP.json \
        --summary-export=./reports/smoke-auth-summary-$TIMESTAMP.json \
        scenarios/smoke/smoke-auth.js

    echo "✅ Smoke tests completed"
}

# Function to run load tests
run_load_tests() {
    echo "📊 Running Load Tests"
    echo "===================="

    echo "🔹 Running User Journey Load Test..."
    k6 run \
        --env BASE_URL="$BASE_URL" \
        --out json=./reports/load-journey-$TIMESTAMP.json \
        --summary-export=./reports/load-journey-summary-$TIMESTAMP.json \
        scenarios/load/load-user-journey.js

    echo
    echo "🔹 Running Document Operations Load Test..."
    k6 run \
        --env BASE_URL="$BASE_URL" \
        --out json=./reports/load-documents-$TIMESTAMP.json \
        --summary-export=./reports/load-documents-summary-$TIMESTAMP.json \
        scenarios/load/load-documents.js

    echo "✅ Load tests completed"
}

# Function to run stress tests
run_stress_tests() {
    echo "🔥 Running Stress Tests"
    echo "======================"

    echo "🔹 Running Authentication Stress Test..."
    k6 run \
        --env BASE_URL="$BASE_URL" \
        --out json=./reports/stress-auth-$TIMESTAMP.json \
        --summary-export=./reports/stress-auth-summary-$TIMESTAMP.json \
        scenarios/stress/stress-auth.js

    echo "✅ Stress tests completed"
}

# Function to run spike tests
run_spike_tests() {
    echo "⚡ Running Spike Tests"
    echo "===================="

    echo "🔹 Running Login Spike Test..."
    k6 run \
        --env BASE_URL="$BASE_URL" \
        --out json=./reports/spike-login-$TIMESTAMP.json \
        --summary-export=./reports/spike-login-summary-$TIMESTAMP.json \
        scenarios/spike/spike-login.js

    echo
    echo "🔹 Running Document Spike Test..."
    k6 run \
        --env BASE_URL="$BASE_URL" \
        --out json=./reports/spike-documents-$TIMESTAMP.json \
        --summary-export=./reports/spike-documents-summary-$TIMESTAMP.json \
        scenarios/spike/spike-documents.js

    echo "✅ Spike tests completed"
}

# Function to run soak tests
run_soak_tests() {
    echo "🕰️ Running Soak Tests"
    echo "===================="
    echo "⚠️ Warning: Soak tests run for 4+ hours"

    read -p "Are you sure you want to run soak tests? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Soak tests cancelled"
        return
    fi

    echo "🔹 Running Endurance Soak Test..."
    k6 run \
        --env BASE_URL="$BASE_URL" \
        --out json=./reports/soak-endurance-$TIMESTAMP.json \
        --summary-export=./reports/soak-endurance-summary-$TIMESTAMP.json \
        scenarios/soak/soak-endurance.js

    echo "✅ Soak tests completed"
}

# Function to run volume tests
run_volume_tests() {
    echo "📈 Running Volume Tests"
    echo "======================"

    echo "🔹 Running Breakpoint Analysis..."
    k6 run \
        --env BASE_URL="$BASE_URL" \
        --out json=./reports/volume-breakpoint-$TIMESTAMP.json \
        --summary-export=./reports/volume-breakpoint-summary-$TIMESTAMP.json \
        scenarios/volume/breakpoint-analysis.js

    echo "✅ Volume tests completed"
}

# Function to run all tests
run_all_tests() {
    echo "🚀 Running Complete Test Suite"
    echo "=============================="

    run_smoke_tests
    echo
    run_load_tests
    echo
    run_stress_tests
    echo
    run_spike_tests
    echo

    echo "⚠️ Skipping soak tests in 'all' mode (too long)"
    echo "Run './run-tests.sh soak' separately for endurance testing"
    echo

    run_volume_tests
}

# Function to generate consolidated report
generate_report() {
    echo "📊 Generating Test Report"
    echo "========================"

    REPORT_FILE="./reports/wesign-load-test-report-$TIMESTAMP.html"

    cat > "$REPORT_FILE" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>WeSign Load Test Report - $TIMESTAMP</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; }
        .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .success { background: #d4edda; border-color: #c3e6cb; }
        .warning { background: #fff3cd; border-color: #ffeaa7; }
        .error { background: #f8d7da; border-color: #f5c6cb; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎯 WeSign K6 Load Test Report</h1>
        <p><strong>Test Run:</strong> $TIMESTAMP</p>
        <p><strong>Environment:</strong> $ENVIRONMENT</p>
        <p><strong>Base URL:</strong> $BASE_URL</p>
        <p><strong>Test Type:</strong> $TEST_TYPE</p>
    </div>

    <div class="test-section">
        <h2>📋 Test Summary</h2>
        <p>Load testing completed for WeSign API endpoints.</p>
        <p>Detailed JSON reports available in the reports/ directory.</p>
    </div>

    <div class="test-section">
        <h2>📁 Generated Files</h2>
        <ul>
EOF

    # List generated files
    for file in ./reports/*$TIMESTAMP*; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            echo "            <li>$filename</li>" >> "$REPORT_FILE"
        fi
    done

    cat >> "$REPORT_FILE" << EOF
        </ul>
    </div>

    <div class="test-section">
        <h2>📊 Quick Analysis</h2>
        <p>Use K6 summary reports and JSON files for detailed performance analysis.</p>
        <p>Key metrics to review:</p>
        <ul>
            <li>Response times (p95, p99)</li>
            <li>Error rates</li>
            <li>Throughput (requests/second)</li>
            <li>Authentication success rates</li>
        </ul>
    </div>

    <div class="test-section">
        <h2>🔍 Next Steps</h2>
        <ol>
            <li>Review JSON reports for detailed metrics</li>
            <li>Compare results against performance requirements</li>
            <li>Identify bottlenecks and optimization opportunities</li>
            <li>Schedule regular load testing</li>
        </ol>
    </div>

    <footer style="margin-top: 50px; text-align: center; color: #666;">
        <p>Generated by WeSign K6 Load Testing Suite - $(date)</p>
    </footer>
</body>
</html>
EOF

    echo "✅ Report generated: $REPORT_FILE"
}

# Main execution logic
case $TEST_TYPE in
    "smoke")
        run_smoke_tests
        ;;
    "load")
        run_load_tests
        ;;
    "stress")
        run_stress_tests
        ;;
    "spike")
        run_spike_tests
        ;;
    "soak")
        run_soak_tests
        ;;
    "volume")
        run_volume_tests
        ;;
    "all")
        run_all_tests
        ;;
    *)
        echo "❌ Invalid test type: $TEST_TYPE"
        echo "Valid options: smoke, load, stress, spike, soak, volume, all"
        echo
        echo "Usage examples:"
        echo "  ./run-tests.sh smoke dev"
        echo "  ./run-tests.sh load staging"
        echo "  ./run-tests.sh all prod"
        exit 1
        ;;
esac

# Generate report
if [ "$REPORT_FORMAT" = "html" ]; then
    generate_report
fi

echo
echo "========================================="
echo "🏁 WeSign K6 Load Testing Completed"
echo "========================================="
echo "📁 Reports saved to: ./reports/"
echo "📊 Raw data saved to: ./data/"
echo "📝 Logs saved to: ./logs/"
echo "⏱️ Timestamp: $TIMESTAMP"
echo

# Show file listing
echo "Generated files:"
ls -la ./reports/*$TIMESTAMP* 2>/dev/null || echo "No report files found"