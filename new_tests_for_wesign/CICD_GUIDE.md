# WeSign Tests - CI/CD Guide (Jenkins)

**Date:** 2025-11-05
**Status:** ✅ PRODUCTION READY
**Purpose:** Complete guide for running WeSign E2E tests in Jenkins with Allure reporting

---

## 🎯 Quick Reference

**IMPORTANT**: This guide is for **WeSign Application Tests** only.

- **Directory:** `new_tests_for_wesign/`
- **Technology:** Python 3.12 + Pytest + Playwright
- **Target:** WeSign application at `https://devtest.comda.co.il`
- **CI/CD:** Jenkins
- **Reporting:** HTML, JUnit XML, Allure

**For QA Intelligence Platform tests**, see: [../tests/e2e/README.md](../tests/e2e/README.md)

**For test directory mapping**, see: [../TEST_DIRECTORIES_MAPPING.md](../TEST_DIRECTORIES_MAPPING.md)

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Jenkins Setup](#jenkins-setup)
3. [Test Commands Reference](#test-commands-reference)
4. [Allure Reporting](#allure-reporting)
5. [Jenkins Pipeline Examples](#jenkins-pipeline-examples)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **Python:** 3.12 or higher
- **Node.js:** 18+ (for Newman/API tests)
- **Java:** JDK 11+ (for Allure)
- **Playwright Browsers:** Chromium
- **Jenkins Plugins:**
  - HTML Publisher Plugin
  - Allure Plugin
  - JUnit Plugin
  - Workspace Cleanup Plugin

### Environment Variables

```bash
# Python version
PYTHON_VERSION=3.12

# WeSign target URL
BASE_URL=https://devtest.comda.co.il

# Playwright cache (optional)
PLAYWRIGHT_BROWSERS_PATH=/path/to/cache/playwright
```

---

## Jenkins Setup

### 1. Install Required Plugins

Navigate to **Manage Jenkins → Plugin Manager** and install:

- ✅ HTML Publisher Plugin
- ✅ Allure Plugin
- ✅ JUnit Plugin
- ✅ Workspace Cleanup Plugin

### 2. Configure Allure

1. Go to **Manage Jenkins → Global Tool Configuration**
2. Scroll to **Allure Commandline**
3. Click **Add Allure Commandline**
4. Name: `Allure`
5. Install from: `allure-2.24.0`
6. Save

### 3. Configure Python

Ensure Python 3.12+ is installed on Jenkins agent:

```bash
python --version  # Should show 3.12 or higher
pip --version
```

---

## Test Commands Reference

### Setup Commands (Run Once)

```bash
# Navigate to WeSign tests directory
cd new_tests_for_wesign

# Install Python dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium --with-deps
```

### Individual Module Tests

#### Contacts Module
```bash
cd new_tests_for_wesign

pytest tests/contacts/ \
  -v \
  --maxfail=999 \
  --tb=short \
  --junit-xml=reports/junit/contacts.xml \
  --html=reports/html/contacts.html \
  --self-contained-html \
  --alluredir=allure-results
```

#### Documents Module
```bash
cd new_tests_for_wesign

pytest tests/documents/ \
  -v \
  --maxfail=999 \
  --tb=short \
  --junit-xml=reports/junit/documents.xml \
  --html=reports/html/documents.html \
  --self-contained-html \
  --alluredir=allure-results
```

#### Templates Module (STRONG Assertions)
```bash
cd new_tests_for_wesign

pytest tests/templates/test_templates_real_validation.py \
  -v \
  --maxfail=999 \
  --tb=short \
  --junit-xml=reports/junit/templates.xml \
  --html=reports/html/templates.html \
  --self-contained-html \
  --alluredir=allure-results
```

#### Self-Signing Module
```bash
cd new_tests_for_wesign

pytest tests/self_signing/ \
  -v \
  --maxfail=999 \
  --tb=short \
  --junit-xml=reports/junit/self-signing.xml \
  --html=reports/html/self-signing.html \
  --self-contained-html \
  --alluredir=allure-results
```

### Run All E2E Tests
```bash
cd new_tests_for_wesign

pytest tests/ \
  -v \
  --maxfail=999 \
  --tb=short \
  --junit-xml=reports/junit/all-tests.xml \
  --html=reports/html/all-tests.html \
  --self-contained-html \
  --alluredir=allure-results
```

### API Tests (Postman/Newman)

```bash
cd new_tests_for_wesign/api_tests

# Install Newman if not already installed
npm install -g newman newman-reporter-htmlextra

# Run all Postman collections
for collection in *.postman_collection.json; do
  echo "Testing: $collection"
  newman run "$collection" \
    -e WeSign_Unified_Environment.postman_environment.json \
    -r cli,htmlextra \
    --reporter-htmlextra-export ../reports/api/${collection%.postman_collection.json}.html
done
```

---

## Allure Reporting

### Generate Allure Report

After running tests with `--alluredir=allure-results`, generate the Allure report:

```bash
cd new_tests_for_wesign

# Generate Allure report
allure generate allure-results --clean -o reports/allure-report

# Serve report locally (for testing)
allure open reports/allure-report
```

### View Allure Report in Jenkins

Allure reports are automatically published by Jenkins when using the Allure Plugin.

**Access reports at:**
```
http://jenkins-server/job/WeSign-Tests/allure
```

---

## Jenkins Pipeline Examples

### Example 1: Declarative Pipeline (Recommended)

Create a file named `Jenkinsfile` in `new_tests_for_wesign/`:

```groovy
pipeline {
    agent any

    environment {
        PYTHON_VERSION = '3.12'
        BASE_URL = 'https://devtest.comda.co.il'
        WORKSPACE_DIR = "${WORKSPACE}/new_tests_for_wesign"
    }

    stages {
        stage('Setup') {
            steps {
                echo '========================================='
                echo 'Setting up WeSign Application Tests'
                echo '========================================='
                echo "Directory: new_tests_for_wesign/"
                echo "Technology: Python ${PYTHON_VERSION} + Pytest + Playwright"
                echo "Target: WeSign application at ${BASE_URL}"
                echo '========================================='

                dir("${WORKSPACE_DIR}") {
                    sh '''
                        python --version
                        pip install --upgrade pip
                        pip install -r requirements.txt
                        playwright install chromium --with-deps
                    '''
                }
            }
        }

        stage('Lint') {
            steps {
                echo 'Running Python linters...'
                dir("${WORKSPACE_DIR}") {
                    sh '''
                        pip install flake8 black
                        flake8 tests/ --max-line-length=120 --exclude=__pycache__ || true
                        black --check tests/ || true
                    '''
                }
            }
        }

        stage('API Tests') {
            steps {
                echo 'Running WeSign API tests (Postman/Newman)...'
                dir("${WORKSPACE_DIR}/api_tests") {
                    sh '''
                        npm install -g newman newman-reporter-htmlextra
                        mkdir -p ../reports/api

                        for collection in *.postman_collection.json; do
                            echo "Testing: $collection"
                            newman run "$collection" \
                                -e WeSign_Unified_Environment.postman_environment.json \
                                -r cli,htmlextra \
                                --reporter-htmlextra-export ../reports/api/${collection%.postman_collection.json}.html || true
                        done
                    '''
                }
            }
        }

        stage('E2E Tests - Contacts') {
            steps {
                echo 'Running WeSign Contacts module E2E tests...'
                dir("${WORKSPACE_DIR}") {
                    sh '''
                        pytest tests/contacts/ \
                            -v \
                            --maxfail=999 \
                            --tb=short \
                            --junit-xml=reports/junit/contacts.xml \
                            --html=reports/html/contacts.html \
                            --self-contained-html \
                            --alluredir=allure-results
                    '''
                }
            }
        }

        stage('E2E Tests - Documents') {
            steps {
                echo 'Running WeSign Documents module E2E tests...'
                dir("${WORKSPACE_DIR}") {
                    sh '''
                        pytest tests/documents/ \
                            -v \
                            --maxfail=999 \
                            --tb=short \
                            --junit-xml=reports/junit/documents.xml \
                            --html=reports/html/documents.html \
                            --self-contained-html \
                            --alluredir=allure-results
                    '''
                }
            }
        }

        stage('E2E Tests - Templates') {
            steps {
                echo 'Running WeSign Templates module E2E tests (STRONG assertions)...'
                dir("${WORKSPACE_DIR}") {
                    sh '''
                        pytest tests/templates/test_templates_real_validation.py \
                            -v \
                            --maxfail=999 \
                            --tb=short \
                            --junit-xml=reports/junit/templates.xml \
                            --html=reports/html/templates.html \
                            --self-contained-html \
                            --alluredir=allure-results
                    '''
                }
            }
        }

        stage('E2E Tests - Self-Signing') {
            steps {
                echo 'Running WeSign Self-Signing module E2E tests...'
                dir("${WORKSPACE_DIR}") {
                    sh '''
                        pytest tests/self_signing/ \
                            -v \
                            --maxfail=999 \
                            --tb=short \
                            --junit-xml=reports/junit/self-signing.xml \
                            --html=reports/html/self-signing.html \
                            --self-contained-html \
                            --alluredir=allure-results
                    '''
                }
            }
        }

        stage('Generate Reports') {
            steps {
                echo 'Generating comprehensive test reports...'
                dir("${WORKSPACE_DIR}") {
                    sh '''
                        # Generate Allure report
                        if [ -d "allure-results" ]; then
                            allure generate allure-results --clean -o reports/allure-report
                            echo "✅ Allure report generated at reports/allure-report"
                        else
                            echo "⚠️ No allure-results directory found"
                        fi
                    '''
                }
            }
        }
    }

    post {
        always {
            echo 'Publishing test reports...'

            // Publish JUnit test results
            junit allowEmptyResults: true, testResults: 'new_tests_for_wesign/reports/junit/*.xml'

            // Publish Allure report
            allure includeProperties: false,
                   jdk: '',
                   results: [[path: 'new_tests_for_wesign/allure-results']]

            // Publish HTML reports
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'new_tests_for_wesign/reports/html',
                reportFiles: '*.html',
                reportName: 'WeSign E2E Test Reports',
                reportTitles: ''
            ])

            // Archive all artifacts
            archiveArtifacts artifacts: 'new_tests_for_wesign/reports/**/*',
                             allowEmptyArchive: true
            archiveArtifacts artifacts: 'new_tests_for_wesign/screenshots/**/*',
                             allowEmptyArchive: true
            archiveArtifacts artifacts: 'new_tests_for_wesign/videos/**/*',
                             allowEmptyArchive: true
            archiveArtifacts artifacts: 'new_tests_for_wesign/traces/**/*',
                             allowEmptyArchive: true
        }

        success {
            echo '✅ WeSign tests completed successfully!'
        }

        failure {
            echo '❌ WeSign tests failed. Check reports for details.'
        }
    }
}
```

### Example 2: Scripted Pipeline

```groovy
node {
    def workspaceDir = "${WORKSPACE}/new_tests_for_wesign"

    stage('Setup') {
        echo 'Setting up WeSign tests...'
        dir(workspaceDir) {
            sh 'pip install -r requirements.txt'
            sh 'playwright install chromium --with-deps'
        }
    }

    stage('Run Tests') {
        dir(workspaceDir) {
            sh '''
                pytest tests/ \
                    -v \
                    --junit-xml=reports/junit/all-tests.xml \
                    --html=reports/html/all-tests.html \
                    --self-contained-html \
                    --alluredir=allure-results
            '''
        }
    }

    stage('Reports') {
        dir(workspaceDir) {
            // Generate Allure report
            sh 'allure generate allure-results --clean -o reports/allure-report'

            // Publish reports
            junit 'reports/junit/*.xml'
            allure results: [[path: 'allure-results']]
            publishHTML([
                reportDir: 'reports/html',
                reportFiles: '*.html',
                reportName: 'WeSign Tests'
            ])
        }
    }
}
```

### Example 3: Parallel Execution

```groovy
pipeline {
    agent any

    stages {
        stage('Setup') {
            steps {
                dir('new_tests_for_wesign') {
                    sh 'pip install -r requirements.txt'
                    sh 'playwright install chromium --with-deps'
                }
            }
        }

        stage('Run Tests in Parallel') {
            parallel {
                stage('Contacts') {
                    steps {
                        dir('new_tests_for_wesign') {
                            sh '''
                                pytest tests/contacts/ \
                                    -v \
                                    --junit-xml=reports/junit/contacts.xml \
                                    --alluredir=allure-results
                            '''
                        }
                    }
                }

                stage('Documents') {
                    steps {
                        dir('new_tests_for_wesign') {
                            sh '''
                                pytest tests/documents/ \
                                    -v \
                                    --junit-xml=reports/junit/documents.xml \
                                    --alluredir=allure-results
                            '''
                        }
                    }
                }

                stage('Templates') {
                    steps {
                        dir('new_tests_for_wesign') {
                            sh '''
                                pytest tests/templates/test_templates_real_validation.py \
                                    -v \
                                    --junit-xml=reports/junit/templates.xml \
                                    --alluredir=allure-results
                            '''
                        }
                    }
                }

                stage('Self-Signing') {
                    steps {
                        dir('new_tests_for_wesign') {
                            sh '''
                                pytest tests/self_signing/ \
                                    -v \
                                    --junit-xml=reports/junit/self-signing.xml \
                                    --alluredir=allure-results
                            '''
                        }
                    }
                }
            }
        }

        stage('Generate Reports') {
            steps {
                dir('new_tests_for_wesign') {
                    sh 'allure generate allure-results --clean -o reports/allure-report'
                }
            }
        }
    }

    post {
        always {
            junit 'new_tests_for_wesign/reports/junit/*.xml'
            allure results: [[path: 'new_tests_for_wesign/allure-results']]
            publishHTML([
                reportDir: 'new_tests_for_wesign/reports/html',
                reportFiles: '*.html',
                reportName: 'WeSign Tests'
            ])
        }
    }
}
```

---

## Troubleshooting

### Issue 1: Playwright Browsers Not Found

**Error:**
```
playwright._impl._api_types.Error: Executable doesn't exist
```

**Solution:**
```bash
playwright install chromium --with-deps
```

### Issue 2: Allure Command Not Found

**Error:**
```
allure: command not found
```

**Solution:**

Install Allure on Jenkins agent:

```bash
# Download and install Allure
wget https://github.com/allure-framework/allure2/releases/download/2.24.0/allure-2.24.0.tgz
tar -zxvf allure-2.24.0.tgz -C /opt/
ln -s /opt/allure-2.24.0/bin/allure /usr/bin/allure

# Verify installation
allure --version
```

Or configure in Jenkins Global Tool Configuration (see [Jenkins Setup](#jenkins-setup)).

### Issue 3: Python Module Not Found

**Error:**
```
ModuleNotFoundError: No module named 'pytest'
```

**Solution:**
```bash
cd new_tests_for_wesign
pip install -r requirements.txt
```

### Issue 4: Permission Denied on Linux

**Error:**
```
Permission denied: '/root/.cache/ms-playwright'
```

**Solution:**
```bash
# Set Playwright cache directory
export PLAYWRIGHT_BROWSERS_PATH=/tmp/playwright
playwright install chromium --with-deps
```

### Issue 5: Tests Running Wrong Directory

**Error:**
Tests from `tests/` (QA Intelligence platform) running instead of `new_tests_for_wesign/`

**Solution:**

Always specify full path in Jenkins:

```groovy
dir("${WORKSPACE}/new_tests_for_wesign") {
    sh 'pytest tests/ -v'
}
```

**Reference:** [TEST_DIRECTORIES_MAPPING.md](../TEST_DIRECTORIES_MAPPING.md)

---

## Report Locations

After pipeline execution, reports are available at:

### JUnit XML Reports
```
new_tests_for_wesign/reports/junit/
├── contacts.xml
├── documents.xml
├── templates.xml
└── self-signing.xml
```

### HTML Reports
```
new_tests_for_wesign/reports/html/
├── contacts.html
├── documents.html
├── templates.html
└── self-signing.html
```

### Allure Report
```
new_tests_for_wesign/reports/allure-report/index.html
```

**Access in Jenkins:**
- **Allure:** `http://jenkins-server/job/WeSign-Tests/allure`
- **HTML:** `http://jenkins-server/job/WeSign-Tests/HTML_20Report/`
- **JUnit:** Built-in test results view

### API Test Reports (Newman)
```
new_tests_for_wesign/reports/api/
├── contacts.html
├── templates.html
└── documents.html
```

---

## Quick Command Reference

### Local Testing
```bash
# Quick test of one module
cd new_tests_for_wesign
pytest tests/documents/test_documents_send_happy_path.py -v

# Run all tests with HTML report
pytest tests/ --html=reports/test-report.html --self-contained-html
```

### Jenkins Commands (Copy-Paste Ready)

**Setup:**
```bash
cd new_tests_for_wesign && pip install -r requirements.txt && playwright install chromium --with-deps
```

**Run All E2E Tests:**
```bash
cd new_tests_for_wesign && pytest tests/ -v --junit-xml=reports/junit/all.xml --html=reports/html/all.html --self-contained-html --alluredir=allure-results
```

**Generate Allure Report:**
```bash
cd new_tests_for_wesign && allure generate allure-results --clean -o reports/allure-report
```

**Run API Tests:**
```bash
cd new_tests_for_wesign/api_tests && npm install -g newman newman-reporter-htmlextra && for collection in *.postman_collection.json; do newman run "$collection" -e WeSign_Unified_Environment.postman_environment.json -r htmlextra --reporter-htmlextra-export ../reports/api/${collection%.postman_collection.json}.html; done
```

---

## Best Practices

### 1. Always Use Correct Directory

✅ **CORRECT:**
```groovy
dir("${WORKSPACE}/new_tests_for_wesign") {
    sh 'pytest tests/ -v'
}
```

❌ **WRONG:**
```groovy
// This runs QA Intelligence platform tests, not WeSign tests!
sh 'pytest tests/ -v'
```

### 2. Include All Report Types

Always generate:
- ✅ JUnit XML (for Jenkins test results)
- ✅ HTML (for human-readable reports)
- ✅ Allure (for comprehensive dashboard)

### 3. Archive Artifacts

```groovy
post {
    always {
        archiveArtifacts artifacts: 'new_tests_for_wesign/reports/**/*'
        archiveArtifacts artifacts: 'new_tests_for_wesign/screenshots/**/*'
        archiveArtifacts artifacts: 'new_tests_for_wesign/videos/**/*'
    }
}
```

### 4. Clean Workspace Before Build

```groovy
stage('Cleanup') {
    steps {
        cleanWs()
    }
}
```

---

## Related Documentation

- **Test Directory Mapping:** [../TEST_DIRECTORIES_MAPPING.md](../TEST_DIRECTORIES_MAPPING.md)
- **Test Execution Guide:** [HOW_TO_USE_TESTS.md](HOW_TO_USE_TESTS.md)
- **STRONG Assertions Methodology:** [TEMPLATES_STRONG_ASSERTIONS_FINAL_PROOF.md](TEMPLATES_STRONG_ASSERTIONS_FINAL_PROOF.md)
- **Documents Test Plan:** [DOCUMENTS_SEND_COMPLETE_TEST_PLAN.md](DOCUMENTS_SEND_COMPLETE_TEST_PLAN.md)

---

**Maintained By:** DevTools/QA Intelligence Team
**Last Updated:** 2025-11-05
**Status:** ✅ PRODUCTION READY - Jenkins Optimized
