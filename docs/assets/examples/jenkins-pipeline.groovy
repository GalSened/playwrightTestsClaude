/**
 * Jenkins Pipeline for QA Intelligence CI/CD
 * Comprehensive build, test, and deployment pipeline
 */

pipeline {
    agent any

    // Environment variables
    environment {
        NODE_VERSION = '18'
        PYTHON_PATH = 'C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe'
        WESIGN_TESTS_PATH = 'C:/Users/gals/seleniumpythontests-1/playwright_tests/'

        // Deployment settings
        DEPLOY_TO_STAGING = "${env.BRANCH_NAME == 'develop'}"
        DEPLOY_TO_PRODUCTION = "${env.BRANCH_NAME == 'main'}"

        // Notification settings
        SLACK_CHANNEL = '#qa-intelligence-builds'
        EMAIL_RECIPIENTS = 'devops@company.com,qa@company.com'
    }

    // Build parameters
    parameters {
        choice(
            name: 'BUILD_TYPE',
            choices: ['full', 'quick', 'test-only'],
            description: 'Type of build to perform'
        )
        booleanParam(
            name: 'SKIP_TESTS',
            defaultValue: false,
            description: 'Skip test execution'
        )
        booleanParam(
            name: 'DEPLOY_FORCE',
            defaultValue: false,
            description: 'Force deployment even if tests fail'
        )
    }

    // Pipeline options
    options {
        // Keep builds for 30 days
        buildDiscarder(logRotator(daysToKeepStr: '30', numToKeepStr: '50'))

        // Timeout after 30 minutes
        timeout(time: 30, unit: 'MINUTES')

        // Skip default checkout
        skipDefaultCheckout(true)

        // Timestamps in logs
        timestamps()

        // Disable concurrent builds
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout & Environment Setup') {
            steps {
                // Clean workspace
                cleanWs()

                // Checkout code
                checkout scm

                // Setup environment
                script {
                    env.BUILD_NUMBER_DISPLAY = "#${env.BUILD_NUMBER}"
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                }

                // Display build information
                powershell '''
                    Write-Host "=== QA Intelligence CI/CD Pipeline ===" -ForegroundColor Cyan
                    Write-Host "Build Number: $env:BUILD_NUMBER" -ForegroundColor Green
                    Write-Host "Branch: $env:BRANCH_NAME" -ForegroundColor Green
                    Write-Host "Commit: $env:GIT_COMMIT_SHORT" -ForegroundColor Green
                    Write-Host "Build Type: $env:BUILD_TYPE" -ForegroundColor Green
                    Write-Host "=======================================" -ForegroundColor Cyan
                '''

                // Notify build start
                slackSend(
                    channel: env.SLACK_CHANNEL,
                    color: 'warning',
                    message: """
                        🚀 *QA Intelligence Build Started*
                        *Branch:* ${env.BRANCH_NAME}
                        *Build:* ${env.BUILD_NUMBER}
                        *Commit:* ${env.GIT_COMMIT_SHORT}
                        *Type:* ${params.BUILD_TYPE}
                    """
                )
            }
        }

        stage('Pre-build Diagnostics') {
            when {
                expression { params.BUILD_TYPE != 'quick' }
            }
            steps {
                powershell '''
                    Write-Host "Running pre-build diagnostics..." -ForegroundColor Yellow

                    # System information
                    Write-Host "System Information:" -ForegroundColor Cyan
                    Write-Host "OS: $(Get-WmiObject Win32_OperatingSystem | Select-Object -ExpandProperty Caption)"
                    Write-Host "CPU: $((Get-WmiObject Win32_Processor).Name)"
                    Write-Host "Memory: $([math]::Round((Get-WmiObject Win32_ComputerSystem).TotalPhysicalMemory/1GB, 2)) GB"

                    # Software versions
                    Write-Host "\\nSoftware Versions:" -ForegroundColor Cyan
                    Write-Host "Node.js: $(node --version)"
                    Write-Host "NPM: $(npm --version)"
                    Write-Host "Python: $(& "$env:PYTHON_PATH" --version)"
                    Write-Host "Git: $(git --version)"

                    # Disk space check
                    $DiskSpace = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'" | Select-Object Size, FreeSpace
                    $FreeSpaceGB = [math]::Round($DiskSpace.FreeSpace / 1GB, 2)
                    Write-Host "\\nDisk Space: $FreeSpaceGB GB free" -ForegroundColor $(if($FreeSpaceGB -lt 10) {"Red"} else {"Green"})

                    if ($FreeSpaceGB -lt 5) {
                        Write-Error "Insufficient disk space for build"
                        exit 1
                    }
                '''
            }
        }

        stage('Backend Build & Test') {
            parallel {
                stage('Backend Dependencies') {
                    steps {
                        dir('backend') {
                            powershell '''
                                Write-Host "Installing backend dependencies..." -ForegroundColor Yellow

                                # Clear npm cache if previous build failed
                                if ($env:BUILD_TYPE -eq "full") {
                                    npm cache clean --force
                                    Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
                                }

                                # Install dependencies
                                npm ci --prefer-offline --no-audit

                                Write-Host "Backend dependencies installed successfully" -ForegroundColor Green
                            '''
                        }
                    }
                }

                stage('Frontend Dependencies') {
                    steps {
                        dir('apps/frontend/dashboard') {
                            powershell '''
                                Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow

                                # Clear npm cache if previous build failed
                                if ($env:BUILD_TYPE -eq "full") {
                                    npm cache clean --force
                                    Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
                                }

                                # Install dependencies
                                npm ci --prefer-offline --no-audit

                                Write-Host "Frontend dependencies installed successfully" -ForegroundColor Green
                            '''
                        }
                    }
                }
            }
        }

        stage('Code Quality & Security') {
            parallel {
                stage('Backend Linting') {
                    steps {
                        dir('backend') {
                            powershell '''
                                Write-Host "Running backend linting..." -ForegroundColor Yellow
                                npm run lint
                                Write-Host "Backend linting passed" -ForegroundColor Green
                            '''
                        }
                    }
                }

                stage('Frontend Linting') {
                    steps {
                        dir('apps/frontend/dashboard') {
                            powershell '''
                                Write-Host "Running frontend linting..." -ForegroundColor Yellow
                                npm run lint
                                Write-Host "Frontend linting passed" -ForegroundColor Green
                            '''
                        }
                    }
                }

                stage('Security Audit') {
                    steps {
                        script {
                            def auditResults = [:]

                            // Backend security audit
                            dir('backend') {
                                try {
                                    powershell '''
                                        Write-Host "Running backend security audit..." -ForegroundColor Yellow
                                        $AuditOutput = npm audit --audit-level=moderate --json 2>$null | ConvertFrom-Json

                                        if ($AuditOutput.metadata.vulnerabilities.moderate -gt 0 -or
                                            $AuditOutput.metadata.vulnerabilities.high -gt 0 -or
                                            $AuditOutput.metadata.vulnerabilities.critical -gt 0) {

                                            Write-Warning "Security vulnerabilities found in backend"
                                            $AuditOutput.metadata.vulnerabilities | ConvertTo-Json
                                        } else {
                                            Write-Host "No significant security vulnerabilities found in backend" -ForegroundColor Green
                                        }
                                    '''
                                    auditResults.backend = 'passed'
                                } catch (Exception e) {
                                    auditResults.backend = 'failed'
                                    currentBuild.result = 'UNSTABLE'
                                }
                            }

                            // Frontend security audit
                            dir('apps/frontend/dashboard') {
                                try {
                                    powershell '''
                                        Write-Host "Running frontend security audit..." -ForegroundColor Yellow
                                        $AuditOutput = npm audit --audit-level=moderate --json 2>$null | ConvertFrom-Json

                                        if ($AuditOutput.metadata.vulnerabilities.moderate -gt 0 -or
                                            $AuditOutput.metadata.vulnerabilities.high -gt 0 -or
                                            $AuditOutput.metadata.vulnerabilities.critical -gt 0) {

                                            Write-Warning "Security vulnerabilities found in frontend"
                                            $AuditOutput.metadata.vulnerabilities | ConvertTo-Json
                                        } else {
                                            Write-Host "No significant security vulnerabilities found in frontend" -ForegroundColor Green
                                        }
                                    '''
                                    auditResults.frontend = 'passed'
                                } catch (Exception e) {
                                    auditResults.frontend = 'failed'
                                    currentBuild.result = 'UNSTABLE'
                                }
                            }
                        }
                    }
                }
            }
        }

        stage('Build Applications') {
            parallel {
                stage('Build Backend') {
                    steps {
                        dir('backend') {
                            powershell '''
                                Write-Host "Building backend application..." -ForegroundColor Yellow

                                # TypeScript compilation
                                npm run build

                                # Verify build output
                                if (-not (Test-Path "dist/server.js")) {
                                    Write-Error "Backend build failed - server.js not found"
                                    exit 1
                                }

                                Write-Host "Backend build completed successfully" -ForegroundColor Green
                            '''
                        }
                    }
                }

                stage('Build Frontend') {
                    steps {
                        dir('apps/frontend/dashboard') {
                            powershell '''
                                Write-Host "Building frontend application..." -ForegroundColor Yellow

                                # Next.js build
                                npm run build

                                # Verify build output
                                if (-not (Test-Path ".next")) {
                                    Write-Error "Frontend build failed - .next directory not found"
                                    exit 1
                                }

                                Write-Host "Frontend build completed successfully" -ForegroundColor Green
                            '''
                        }
                    }
                }
            }
        }

        stage('Unit Tests') {
            when {
                not { params.SKIP_TESTS }
            }
            parallel {
                stage('Backend Unit Tests') {
                    steps {
                        dir('backend') {
                            powershell '''
                                Write-Host "Running backend unit tests..." -ForegroundColor Yellow
                                npm run test:unit
                                Write-Host "Backend unit tests completed" -ForegroundColor Green
                            '''
                        }
                    }
                    post {
                        always {
                            // Publish test results
                            publishTestResults testResultsPattern: 'backend/test-results.xml'
                        }
                    }
                }

                stage('Frontend Unit Tests') {
                    steps {
                        dir('apps/frontend/dashboard') {
                            powershell '''
                                Write-Host "Running frontend unit tests..." -ForegroundColor Yellow
                                npm run test:unit
                                Write-Host "Frontend unit tests completed" -ForegroundColor Green
                            '''
                        }
                    }
                    post {
                        always {
                            // Publish test results
                            publishTestResults testResultsPattern: 'apps/frontend/dashboard/test-results.xml'
                        }
                    }
                }
            }
        }

        stage('Integration Tests') {
            when {
                allOf {
                    not { params.SKIP_TESTS }
                    expression { params.BUILD_TYPE != 'quick' }
                }
            }
            steps {
                powershell '''
                    Write-Host "Starting integration tests..." -ForegroundColor Yellow

                    # Start services for integration testing
                    cd backend
                    $BackendProcess = Start-Process -FilePath "node" -ArgumentList "dist/server.js" -PassThru -NoNewWindow

                    # Wait for services to start
                    Start-Sleep -Seconds 30

                    # Test backend API
                    try {
                        $HealthResponse = Invoke-RestMethod -Uri "http://localhost:8082/api/health" -TimeoutSec 30
                        if ($HealthResponse.status -eq "healthy") {
                            Write-Host "Backend API is healthy" -ForegroundColor Green
                        } else {
                            Write-Error "Backend API health check failed"
                        }
                    } catch {
                        Write-Error "Failed to connect to backend API: $($_.Exception.Message)"
                        throw
                    } finally {
                        # Stop services
                        Stop-Process -Id $BackendProcess.Id -Force -ErrorAction SilentlyContinue
                    }
                '''
            }
        }

        stage('WeSign E2E Tests') {
            when {
                allOf {
                    not { params.SKIP_TESTS }
                    expression { params.BUILD_TYPE == 'full' }
                }
            }
            steps {
                powershell '''
                    Write-Host "Running WeSign E2E tests..." -ForegroundColor Yellow

                    # Navigate to WeSign tests directory
                    cd "$env:WESIGN_TESTS_PATH"

                    # Run critical path tests
                    $TestResults = & "$env:PYTHON_PATH" -m pytest tests/auth/ tests/documents/ -v --html=reports/e2e_report.html --self-contained-html

                    Write-Host "WeSign E2E tests completed" -ForegroundColor Green
                '''
            }
            post {
                always {
                    // Archive test reports
                    archiveArtifacts artifacts: '**/reports/*.html', fingerprint: true

                    // Publish HTML reports
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: "${env.WESIGN_TESTS_PATH}/reports",
                        reportFiles: 'e2e_report.html',
                        reportName: 'WeSign E2E Test Report'
                    ])
                }
            }
        }

        stage('Performance Tests') {
            when {
                expression { params.BUILD_TYPE == 'full' }
            }
            steps {
                powershell '''
                    Write-Host "Running performance tests..." -ForegroundColor Yellow

                    # Start backend for performance testing
                    cd backend
                    $BackendProcess = Start-Process -FilePath "node" -ArgumentList "dist/server.js" -PassThru -NoNewWindow
                    Start-Sleep -Seconds 30

                    try {
                        # Run load tests with Apache Bench
                        $LoadTestResults = ab -n 100 -c 10 "http://localhost:8082/api/health"
                        Write-Host "Load test completed" -ForegroundColor Green

                        # Basic performance validation
                        $HealthResponse = Measure-Command { Invoke-RestMethod -Uri "http://localhost:8082/api/health" }
                        if ($HealthResponse.TotalMilliseconds -gt 1000) {
                            Write-Warning "API response time is slow: $($HealthResponse.TotalMilliseconds)ms"
                        } else {
                            Write-Host "API response time is good: $($HealthResponse.TotalMilliseconds)ms" -ForegroundColor Green
                        }

                    } finally {
                        Stop-Process -Id $BackendProcess.Id -Force -ErrorAction SilentlyContinue
                    }
                '''
            }
        }

        stage('Build Artifacts') {
            steps {
                powershell '''
                    Write-Host "Creating build artifacts..." -ForegroundColor Yellow

                    # Create artifacts directory
                    New-Item -ItemType Directory -Path "artifacts" -Force

                    # Package backend
                    Compress-Archive -Path "backend/dist", "backend/package.json", "backend/node_modules" -DestinationPath "artifacts/backend-${env:BUILD_NUMBER}.zip"

                    # Package frontend
                    Compress-Archive -Path "apps/frontend/dashboard/.next", "apps/frontend/dashboard/package.json" -DestinationPath "artifacts/frontend-${env:BUILD_NUMBER}.zip"

                    # Create deployment manifest
                    @{
                        buildNumber = $env:BUILD_NUMBER
                        gitCommit = $env:GIT_COMMIT
                        branch = $env:BRANCH_NAME
                        buildTimestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC"
                        artifacts = @(
                            "backend-${env:BUILD_NUMBER}.zip",
                            "frontend-${env:BUILD_NUMBER}.zip"
                        )
                    } | ConvertTo-Json | Out-File "artifacts/deployment-manifest.json" -Encoding UTF8

                    Write-Host "Build artifacts created successfully" -ForegroundColor Green
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'artifacts/*', fingerprint: true
                }
            }
        }

        stage('Deploy to Staging') {
            when {
                allOf {
                    expression { env.DEPLOY_TO_STAGING == 'true' }
                    anyOf {
                        expression { currentBuild.result == null }
                        expression { params.DEPLOY_FORCE == true }
                    }
                }
            }
            steps {
                powershell '''
                    Write-Host "Deploying to staging environment..." -ForegroundColor Yellow

                    # Deploy backend
                    Write-Host "Deploying backend to staging..."
                    # Add actual deployment commands here

                    # Deploy frontend
                    Write-Host "Deploying frontend to staging..."
                    # Add actual deployment commands here

                    # Health check staging deployment
                    Start-Sleep -Seconds 30

                    try {
                        $StagingHealth = Invoke-RestMethod -Uri "https://staging.qa-intelligence.company.com/api/health" -TimeoutSec 30
                        if ($StagingHealth.status -eq "healthy") {
                            Write-Host "Staging deployment successful!" -ForegroundColor Green
                        } else {
                            Write-Error "Staging deployment health check failed"
                        }
                    } catch {
                        Write-Error "Failed to verify staging deployment: $($_.Exception.Message)"
                        throw
                    }
                '''
            }
        }

        stage('Deploy to Production') {
            when {
                allOf {
                    expression { env.DEPLOY_TO_PRODUCTION == 'true' }
                    expression { currentBuild.result == null }
                }
            }
            steps {
                // Manual approval for production
                input message: 'Deploy to Production?', ok: 'Deploy',
                      submitterParameter: 'DEPLOYER'

                powershell '''
                    Write-Host "Deploying to production environment..." -ForegroundColor Yellow
                    Write-Host "Approved by: $env:DEPLOYER" -ForegroundColor Green

                    # Blue-Green deployment strategy
                    Write-Host "Executing blue-green deployment..."

                    # Deploy to green environment
                    # Add actual deployment commands here

                    # Health check before switching
                    Start-Sleep -Seconds 30

                    try {
                        $ProdHealth = Invoke-RestMethod -Uri "https://qa-intelligence.company.com/api/health" -TimeoutSec 30
                        if ($ProdHealth.status -eq "healthy") {
                            Write-Host "Production deployment successful!" -ForegroundColor Green
                        } else {
                            Write-Error "Production deployment health check failed"
                        }
                    } catch {
                        Write-Error "Failed to verify production deployment: $($_.Exception.Message)"
                        throw
                    }
                '''
            }
        }
    }

    post {
        always {
            // Clean up processes
            powershell '''
                # Kill any remaining Node.js processes from tests
                Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq "" } | Stop-Process -Force -ErrorAction SilentlyContinue
            '''

            // Archive logs
            archiveArtifacts artifacts: '**/logs/*.log', allowEmptyArchive: true

            // Cleanup workspace
            cleanWs(cleanWhenAborted: false, cleanWhenFailure: false, cleanWhenNotBuilt: false, cleanWhenSuccess: true, cleanWhenUnstable: false, deleteDirs: true)
        }

        success {
            slackSend(
                channel: env.SLACK_CHANNEL,
                color: 'good',
                message: """
                    ✅ *QA Intelligence Build Successful*
                    *Branch:* ${env.BRANCH_NAME}
                    *Build:* ${env.BUILD_NUMBER}
                    *Duration:* ${currentBuild.durationString}
                    *Deployed:* ${env.DEPLOY_TO_PRODUCTION == 'true' ? 'Production' : env.DEPLOY_TO_STAGING == 'true' ? 'Staging' : 'No deployment'}
                """
            )

            emailext(
                to: env.EMAIL_RECIPIENTS,
                subject: "✅ QA Intelligence Build ${env.BUILD_NUMBER} - SUCCESS",
                body: """
                    Build ${env.BUILD_NUMBER} completed successfully.

                    Branch: ${env.BRANCH_NAME}
                    Commit: ${env.GIT_COMMIT}
                    Duration: ${currentBuild.durationString}

                    Jenkins URL: ${env.BUILD_URL}
                """
            )
        }

        failure {
            slackSend(
                channel: env.SLACK_CHANNEL,
                color: 'danger',
                message: """
                    ❌ *QA Intelligence Build Failed*
                    *Branch:* ${env.BRANCH_NAME}
                    *Build:* ${env.BUILD_NUMBER}
                    *Stage:* ${env.STAGE_NAME}
                    *Duration:* ${currentBuild.durationString}
                    *Logs:* ${env.BUILD_URL}console
                """
            )

            emailext(
                to: env.EMAIL_RECIPIENTS,
                subject: "❌ QA Intelligence Build ${env.BUILD_NUMBER} - FAILED",
                body: """
                    Build ${env.BUILD_NUMBER} failed.

                    Branch: ${env.BRANCH_NAME}
                    Commit: ${env.GIT_COMMIT}
                    Failed Stage: ${env.STAGE_NAME}
                    Duration: ${currentBuild.durationString}

                    Jenkins URL: ${env.BUILD_URL}
                    Console Log: ${env.BUILD_URL}console

                    Please check the build logs for detailed error information.
                """,
                attachLog: true
            )
        }

        unstable {
            slackSend(
                channel: env.SLACK_CHANNEL,
                color: 'warning',
                message: """
                    ⚠️ *QA Intelligence Build Unstable*
                    *Branch:* ${env.BRANCH_NAME}
                    *Build:* ${env.BUILD_NUMBER}
                    *Duration:* ${currentBuild.durationString}
                    *Issues:* Some tests failed or warnings detected
                """
            )
        }
    }
}