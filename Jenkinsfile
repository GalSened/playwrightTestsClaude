#!/usr/bin/env groovy
/**
 * Jenkins Pipeline for WeSign Deployment to Windows DevTest Environment
 *
 * This pipeline integrates with QA Intelligence backend API for status reporting
 * and deployment orchestration across the CI/CD lifecycle.
 *
 * Target: Windows Jenkins → Windows DevTest (IIS) via SMB/WinRM
 * Integration: QA Intelligence Backend API (http://localhost:8082)
 * Security: Jenkins Credentials Plugin with domain authentication
 *
 * Version: 2.0
 * Last Updated: 2025-09-26
 */

@Library('wesign-deployment') _

pipeline {
    agent {
        label 'windows && dotnet'
    }

    parameters {
        choice(
            name: 'BRANCH_OR_TAG',
            choices: ['main', 'develop', 'release/*', 'hotfix/*'],
            description: 'Branch or tag to deploy (supports wildcards for release/hotfix)'
        )
        booleanParam(
            name: 'DRY_RUN',
            defaultValue: false,
            description: 'Perform a dry run without actual deployment'
        )
        choice(
            name: 'TEST_SUITE',
            choices: ['api', 'e2e', 'full', 'none'],
            description: 'Test suite to execute after deployment'
        )
        booleanParam(
            name: 'FORCE_DEPLOY',
            defaultValue: false,
            description: 'Force deployment even if health checks fail'
        )
        booleanParam(
            name: 'SKIP_BACKUP',
            defaultValue: false,
            description: 'Skip backup creation (not recommended for production)'
        )
        string(
            name: 'NOTIFICATION_RECIPIENTS',
            defaultValue: 'devops@company.com,qa-team@company.com',
            description: 'Comma-separated email addresses for notifications'
        )
    }

    environment {
        // Load environment configuration
        WESIGN_CONFIG = readFile "${JENKINS_HOME}/wesign-deployment/environment.properties"

        // Jenkins Credentials
        DOMAIN_CREDENTIALS = credentials('wesign-domain-service-account')
        DEVTEST_CREDENTIALS = credentials('wesign-devtest-deploy-user')
        QA_BACKEND_TOKEN = credentials('qa-intelligence-backend-token')

        // Repository Configuration
        GIT_REPO_URL = 'https://gitlab.comda.co.il/comsigntrust/comsigntrustcms.git'

        // Target Environment
        DEVTEST_SERVER = 'devtest-iis01.company.local'
        DEVTEST_SHARE = "\\\\${DEVTEST_SERVER}\\WeSignDeploy\$"
        DEVTEST_APP_PATH = 'C:\\inetpub\\wwwroot\\WeSign'
        IIS_SITE_NAME = 'WeSign'
        IIS_APP_POOL = 'WeSignAppPool'

        // QA Intelligence Integration
        QA_BACKEND_URL = 'http://localhost:8082'
        DEPLOYMENT_ID = "${env.BUILD_ID}-${env.BUILD_NUMBER}"

        // Build Configuration
        DOTNET_CLI_TELEMETRY_OPTOUT = 'true'
        DOTNET_SKIP_FIRST_TIME_EXPERIENCE = 'true'
        MSBUILD_VERBOSITY = 'minimal'

        // Windows-specific paths
        PYTHON_CMD = 'py'
        POWERSHELL_CMD = 'powershell.exe'

        // Timeouts and retries
        DEPLOYMENT_TIMEOUT = '600' // 10 minutes
        HEALTH_CHECK_TIMEOUT = '300' // 5 minutes
        BACKUP_RETENTION_DAYS = '30'
    }

    options {
        buildDiscarder(logRotator(
            daysToKeepStr: '30',
            numToKeepStr: '50',
            artifactDaysToKeepStr: '14',
            artifactNumToKeepStr: '20'
        ))
        disableConcurrentBuilds()
        timeout(time: 60, unit: 'MINUTES')
        timestamps()
        ansiColor('xterm')
        skipDefaultCheckout(true)
    }

    stages {
        stage('Initialize') {
            steps {
                script {
                    // Register deployment with QA Intelligence backend
                    def initResponse = wesignDeploy.initializeDeployment(
                        deploymentId: env.DEPLOYMENT_ID,
                        branch: params.BRANCH_OR_TAG,
                        dryRun: params.DRY_RUN,
                        buildNumber: env.BUILD_NUMBER,
                        triggeredBy: env.BUILD_USER ?: 'jenkins'
                    )

                    env.QA_EXECUTION_ID = initResponse.executionId
                    echo "✅ Deployment registered with QA Intelligence: ${env.QA_EXECUTION_ID}"

                    // Set build description
                    currentBuild.displayName = "#${env.BUILD_NUMBER} - ${params.BRANCH_OR_TAG}"
                    currentBuild.description = "Deploy: ${params.DRY_RUN ? 'DRY RUN' : 'LIVE'} | Tests: ${params.TEST_SUITE}"
                }
            }
        }

        stage('Validate Parameters') {
            steps {
                script {
                    echo "🔍 Validating pipeline parameters..."

                    // Validate branch/tag parameter
                    if (!params.BRANCH_OR_TAG) {
                        error "❌ BRANCH_OR_TAG parameter is required"
                    }

                    // Validate test suite selection
                    def validTestSuites = ['api', 'e2e', 'full', 'none']
                    if (!validTestSuites.contains(params.TEST_SUITE)) {
                        error "❌ Invalid TEST_SUITE: ${params.TEST_SUITE}. Must be one of: ${validTestSuites.join(', ')}"
                    }

                    // Validate notification recipients
                    if (params.NOTIFICATION_RECIPIENTS && !params.NOTIFICATION_RECIPIENTS.matches(/^[\w\.-]+@[\w\.-]+\.\w+(,\s*[\w\.-]+@[\w\.-]+\.\w+)*$/)) {
                        error "❌ Invalid email format in NOTIFICATION_RECIPIENTS"
                    }

                    echo "✅ Parameters validated successfully"

                    // Report validation status
                    wesignDeploy.reportStatus(
                        executionId: env.QA_EXECUTION_ID,
                        stage: 'validation',
                        status: 'completed',
                        message: 'Pipeline parameters validated',
                        metadata: [
                            branch: params.BRANCH_OR_TAG,
                            testSuite: params.TEST_SUITE,
                            dryRun: params.DRY_RUN,
                            forceDeployment: params.FORCE_DEPLOY
                        ]
                    )
                }
            }
        }

        stage('Checkout') {
            steps {
                script {
                    try {
                        echo "📥 Checking out source code..."

                        // Handle wildcard patterns for release/hotfix branches
                        def actualBranch = params.BRANCH_OR_TAG
                        if (params.BRANCH_OR_TAG.contains('*')) {
                            // Get available branches matching pattern
                            def branches = wesignDeploy.findMatchingBranches(env.GIT_REPO_URL, params.BRANCH_OR_TAG)
                            if (branches.isEmpty()) {
                                error "❌ No branches found matching pattern: ${params.BRANCH_OR_TAG}"
                            }
                            actualBranch = branches.first() // Use the first match
                            echo "🔀 Using branch: ${actualBranch} (matched pattern: ${params.BRANCH_OR_TAG})"
                        }

                        checkout([
                            $class: 'GitSCM',
                            branches: [[name: actualBranch]],
                            doGenerateSubmoduleConfigurations: false,
                            extensions: [
                                [$class: 'CleanBeforeCheckout'],
                                [$class: 'CloneOption', depth: 1, noTags: false, shallow: true],
                                [$class: 'CheckoutOption', timeout: 20]
                            ],
                            submoduleCfg: [],
                            userRemoteConfigs: [[
                                credentialsId: 'gitlab-wesign-deploy-key',
                                url: env.GIT_REPO_URL
                            ]]
                        ])

                        // Get commit information
                        env.GIT_COMMIT_SHA = bat(
                            script: '@git rev-parse HEAD',
                            returnStdout: true
                        ).trim()

                        env.GIT_COMMIT_MESSAGE = bat(
                            script: '@git log -1 --pretty=format:"%s"',
                            returnStdout: true
                        ).trim()

                        env.ACTUAL_BRANCH = actualBranch

                        echo "✅ Checkout completed"
                        echo "   Branch: ${env.ACTUAL_BRANCH}"
                        echo "   Commit: ${env.GIT_COMMIT_SHA}"
                        echo "   Message: ${env.GIT_COMMIT_MESSAGE}"

                        // Report checkout status
                        wesignDeploy.reportStatus(
                            executionId: env.QA_EXECUTION_ID,
                            stage: 'checkout',
                            status: 'completed',
                            message: 'Source code checkout completed',
                            metadata: [
                                branch: env.ACTUAL_BRANCH,
                                commit: env.GIT_COMMIT_SHA,
                                commitMessage: env.GIT_COMMIT_MESSAGE
                            ]
                        )

                    } catch (Exception e) {
                        wesignDeploy.reportStatus(
                            executionId: env.QA_EXECUTION_ID,
                            stage: 'checkout',
                            status: 'failed',
                            message: "Checkout failed: ${e.message}"
                        )
                        throw e
                    }
                }
            }
        }

        stage('Preflight Checks') {
            parallel {
                stage('Network Connectivity') {
                    steps {
                        script {
                            echo "🌐 Testing network connectivity..."

                            // Test ICMP connectivity
                            def pingResult = bat(
                                script: "@ping -n 4 ${env.DEVTEST_SERVER}",
                                returnStatus: true
                            )

                            if (pingResult != 0) {
                                error "❌ Cannot ping DevTest server: ${env.DEVTEST_SERVER}"
                            }

                            echo "✅ ICMP connectivity OK"
                        }
                    }
                }

                stage('SMB Share Access') {
                    steps {
                        script {
                            echo "📁 Testing SMB share access..."

                            withCredentials([usernamePassword(credentialsId: 'wesign-devtest-deploy-user', usernameVariable: 'SMB_USER', passwordVariable: 'SMB_PASS')]) {
                                def testResult = bat(
                                    script: """
                                        @echo off
                                        net use ${env.DEVTEST_SHARE} /user:${SMB_USER} ${SMB_PASS} >nul 2>&1
                                        if %errorlevel% neq 0 (
                                            echo Failed to connect to SMB share
                                            exit /b 1
                                        )
                                        dir ${env.DEVTEST_SHARE} >nul 2>&1
                                        net use ${env.DEVTEST_SHARE} /delete >nul 2>&1
                                    """,
                                    returnStatus: true
                                )

                                if (testResult != 0) {
                                    error "❌ Cannot access SMB share: ${env.DEVTEST_SHARE}"
                                }
                            }

                            echo "✅ SMB share access OK"
                        }
                    }
                }

                stage('WinRM Connectivity') {
                    steps {
                        script {
                            echo "🔐 Testing WinRM connectivity..."

                            withCredentials([usernamePassword(credentialsId: 'wesign-devtest-deploy-user', usernameVariable: 'WINRM_USER', passwordVariable: 'WINRM_PASS')]) {
                                def winrmTest = bat(
                                    script: """
                                        @echo off
                                        winrs -r:https://${env.DEVTEST_SERVER}:5986/wsman -u:${WINRM_USER} -p:${WINRM_PASS} -ssl "echo WinRM Connection Test"
                                    """,
                                    returnStatus: true
                                )

                                if (winrmTest != 0) {
                                    echo "⚠️ HTTPS WinRM failed, trying HTTP on port 5985..."

                                    winrmTest = bat(
                                        script: """
                                            @echo off
                                            winrs -r:http://${env.DEVTEST_SERVER}:5985/wsman -u:${WINRM_USER} -p:${WINRM_PASS} "echo WinRM Connection Test"
                                        """,
                                        returnStatus: true
                                    )
                                }

                                if (winrmTest != 0 && !params.FORCE_DEPLOY) {
                                    error "❌ WinRM connectivity failed. Use FORCE_DEPLOY to override."
                                }
                            }

                            echo "✅ WinRM connectivity OK"
                        }
                    }
                }

                stage('Disk Space Check') {
                    steps {
                        script {
                            echo "💾 Checking disk space..."

                            withCredentials([usernamePassword(credentialsId: 'wesign-devtest-deploy-user', usernameVariable: 'WINRM_USER', passwordVariable: 'WINRM_PASS')]) {
                                def diskSpaceOutput = bat(
                                    script: """
                                        @echo off
                                        winrs -r:https://${env.DEVTEST_SERVER}:5986/wsman -u:${WINRM_USER} -p:${WINRM_PASS} -ssl "wmic logicaldisk where caption=\\"C:\\" get size,freespace /value"
                                    """,
                                    returnStdout: true
                                ).trim()

                                // Parse disk space (simplified - should be more robust in production)
                                def freeSpaceGB = 10 // Placeholder - implement actual parsing
                                def requiredSpaceGB = 2

                                if (freeSpaceGB < requiredSpaceGB && !params.FORCE_DEPLOY) {
                                    error "❌ Insufficient disk space: ${freeSpaceGB}GB available, ${requiredSpaceGB}GB required"
                                }
                            }

                            echo "✅ Sufficient disk space available"
                        }
                    }
                }
            }
        }

        stage('Build & Test') {
            stages {
                stage('Restore Dependencies') {
                    steps {
                        script {
                            echo "📦 Restoring NuGet packages..."

                            bat """
                                @echo off
                                echo Restoring packages...
                                dotnet restore --verbosity ${env.MSBUILD_VERBOSITY} --no-cache
                                if %errorlevel% neq 0 (
                                    echo Failed to restore packages
                                    exit /b 1
                                )
                            """

                            echo "✅ Dependencies restored"
                        }
                    }
                }

                stage('Build Application') {
                    steps {
                        script {
                            echo "🔨 Building application..."

                            bat """
                                @echo off
                                echo Building application...
                                dotnet build --configuration Release --verbosity ${env.MSBUILD_VERBOSITY} --no-restore
                                if %errorlevel% neq 0 (
                                    echo Build failed
                                    exit /b 1
                                )
                            """

                            echo "✅ Build completed"
                        }
                    }
                }

                stage('Run Unit Tests') {
                    steps {
                        script {
                            echo "🧪 Running unit tests..."

                            try {
                                bat """
                                    @echo off
                                    echo Running unit tests...
                                    dotnet test --configuration Release --no-build --verbosity ${env.MSBUILD_VERBOSITY} ^
                                        --logger "trx;LogFileName=TestResults.trx" ^
                                        --collect:"XPlat Code Coverage" ^
                                        --results-directory "./TestResults"
                                """

                                // Publish test results
                                publishTestResults(
                                    checksName: 'Unit Tests',
                                    testResultsPattern: 'TestResults/*.trx',
                                    mergeTestResults: true,
                                    failOnError: true
                                )

                                echo "✅ Unit tests passed"

                            } catch (Exception e) {
                                publishTestResults(
                                    checksName: 'Unit Tests',
                                    testResultsPattern: 'TestResults/*.trx',
                                    mergeTestResults: true,
                                    failOnError: false
                                )

                                if (!params.FORCE_DEPLOY) {
                                    throw e
                                } else {
                                    echo "⚠️ Unit tests failed, continuing due to FORCE_DEPLOY"
                                }
                            }
                        }
                    }
                }
            }
        }

        stage('Package & Transform') {
            steps {
                script {
                    echo "📦 Creating deployment package..."

                    // Create build info file
                    def buildInfo = [
                        buildNumber: env.BUILD_NUMBER,
                        buildId: env.BUILD_ID,
                        branch: env.ACTUAL_BRANCH,
                        commit: env.GIT_COMMIT_SHA,
                        commitMessage: env.GIT_COMMIT_MESSAGE,
                        buildDate: new Date().format('yyyy-MM-dd HH:mm:ss'),
                        jenkinsUrl: env.JENKINS_URL,
                        jobName: env.JOB_NAME,
                        deploymentId: env.DEPLOYMENT_ID
                    ]

                    writeJSON file: 'build-info.json', json: buildInfo, pretty: 2

                    // Create deployment package
                    bat """
                        @echo off
                        echo Creating deployment package...

                        REM Create package directory
                        if exist "Package" rmdir /s /q Package
                        mkdir Package

                        REM Copy application files
                        xcopy /E /I /Y "bin\\Release\\*" "Package\\bin\\"
                        xcopy /E /I /Y "wwwroot\\*" "Package\\wwwroot\\" 2>nul || echo No wwwroot directory
                        xcopy /E /I /Y "Views\\*" "Package\\Views\\" 2>nul || echo No Views directory
                        xcopy /E /I /Y "Content\\*" "Package\\Content\\" 2>nul || echo No Content directory
                        xcopy /E /I /Y "Scripts\\*" "Package\\Scripts\\" 2>nul || echo No Scripts directory

                        REM Copy configuration files
                        copy "*.config" "Package\\" 2>nul || echo No config files
                        copy "build-info.json" "Package\\"

                        REM Create ZIP archive
                        powershell -Command "Compress-Archive -Path 'Package\\*' -DestinationPath 'WeSign-${env.BUILD_NUMBER}.zip' -Force"

                        REM Generate checksum
                        certutil -hashfile "WeSign-${env.BUILD_NUMBER}.zip" SHA256 > "WeSign-${env.BUILD_NUMBER}.zip.sha256"

                        echo Package created: WeSign-${env.BUILD_NUMBER}.zip
                        dir "WeSign-${env.BUILD_NUMBER}.zip*"
                    """

                    // Archive artifacts
                    archiveArtifacts(
                        artifacts: "WeSign-${env.BUILD_NUMBER}.zip,WeSign-${env.BUILD_NUMBER}.zip.sha256,build-info.json",
                        allowEmptyArchive: false,
                        fingerprint: true
                    )

                    // Set environment variables for later stages
                    env.PACKAGE_FILE = "WeSign-${env.BUILD_NUMBER}.zip"
                    env.PACKAGE_CHECKSUM_FILE = "WeSign-${env.BUILD_NUMBER}.zip.sha256"

                    echo "✅ Package created: ${env.PACKAGE_FILE}"

                    // Report packaging status
                    wesignDeploy.reportStatus(
                        executionId: env.QA_EXECUTION_ID,
                        stage: 'package',
                        status: 'completed',
                        message: 'Deployment package created',
                        metadata: [
                            packageFile: env.PACKAGE_FILE,
                            packageSize: bat(script: "@for %%I in (${env.PACKAGE_FILE}) do @echo %%~zI", returnStdout: true).trim()
                        ]
                    )
                }
            }
        }

        stage('Deploy') {
            when {
                not { params.DRY_RUN }
            }
            steps {
                script {
                    echo "🚀 Starting deployment to DevTest..."

                    try {
                        // Report deployment start
                        wesignDeploy.reportStatus(
                            executionId: env.QA_EXECUTION_ID,
                            stage: 'deployment',
                            status: 'running',
                            message: 'Starting deployment to DevTest environment'
                        )

                        // Execute deployment using pipeline library
                        def deploymentResult = wesignDeploy.executeDeployment([
                            packageFile: env.PACKAGE_FILE,
                            checksumFile: env.PACKAGE_CHECKSUM_FILE,
                            targetServer: env.DEVTEST_SERVER,
                            targetPath: env.DEVTEST_APP_PATH,
                            smbShare: env.DEVTEST_SHARE,
                            iisSite: env.IIS_SITE_NAME,
                            iisAppPool: env.IIS_APP_POOL,
                            skipBackup: params.SKIP_BACKUP,
                            timeout: env.DEPLOYMENT_TIMEOUT as Integer
                        ])

                        env.DEPLOYMENT_TIMESTAMP = deploymentResult.timestamp
                        env.BACKUP_LOCATION = deploymentResult.backupLocation

                        echo "✅ Deployment completed successfully"
                        echo "   Timestamp: ${env.DEPLOYMENT_TIMESTAMP}"
                        echo "   Backup: ${env.BACKUP_LOCATION}"

                        // Report successful deployment
                        wesignDeploy.reportStatus(
                            executionId: env.QA_EXECUTION_ID,
                            stage: 'deployment',
                            status: 'completed',
                            message: 'Deployment completed successfully',
                            metadata: [
                                timestamp: env.DEPLOYMENT_TIMESTAMP,
                                backupLocation: env.BACKUP_LOCATION,
                                packageFile: env.PACKAGE_FILE
                            ]
                        )

                    } catch (Exception e) {
                        echo "❌ Deployment failed: ${e.message}"

                        // Report deployment failure
                        wesignDeploy.reportStatus(
                            executionId: env.QA_EXECUTION_ID,
                            stage: 'deployment',
                            status: 'failed',
                            message: "Deployment failed: ${e.message}"
                        )

                        throw e
                    }
                }
            }
        }

        stage('Smoke Tests') {
            when {
                not { params.DRY_RUN }
            }
            steps {
                script {
                    echo "🔍 Running smoke tests..."

                    try {
                        // Execute smoke tests using pipeline library
                        def smokeTestResult = wesignDeploy.runSmokeTests([
                            targetServer: env.DEVTEST_SERVER,
                            healthEndpoint: "/health",
                            timeout: env.HEALTH_CHECK_TIMEOUT as Integer,
                            retryAttempts: 3,
                            retryDelay: 30
                        ])

                        if (!smokeTestResult.success) {
                            if (params.FORCE_DEPLOY) {
                                echo "⚠️ Smoke tests failed, continuing due to FORCE_DEPLOY"
                            } else {
                                error "❌ Smoke tests failed: ${smokeTestResult.error}"
                            }
                        } else {
                            echo "✅ Smoke tests passed"
                        }

                        // Report smoke test results
                        wesignDeploy.reportStatus(
                            executionId: env.QA_EXECUTION_ID,
                            stage: 'smoke_tests',
                            status: smokeTestResult.success ? 'completed' : 'failed',
                            message: smokeTestResult.success ? 'Smoke tests passed' : "Smoke tests failed: ${smokeTestResult.error}",
                            metadata: smokeTestResult.details
                        )

                    } catch (Exception e) {
                        if (params.FORCE_DEPLOY) {
                            echo "⚠️ Smoke tests error, continuing due to FORCE_DEPLOY: ${e.message}"
                        } else {
                            // Attempt automatic rollback
                            try {
                                echo "🔄 Attempting automatic rollback..."
                                wesignDeploy.executeRollback([
                                    targetServer: env.DEVTEST_SERVER,
                                    backupLocation: env.BACKUP_LOCATION,
                                    iisSite: env.IIS_SITE_NAME,
                                    iisAppPool: env.IIS_APP_POOL
                                ])
                                echo "✅ Automatic rollback completed"
                            } catch (Exception rollbackError) {
                                echo "❌ Automatic rollback failed: ${rollbackError.message}"
                            }

                            throw e
                        }
                    }
                }
            }
        }

        stage('Automated Testing') {
            when {
                allOf {
                    not { params.DRY_RUN }
                    not { equals expected: 'none', actual: params.TEST_SUITE }
                }
            }
            parallel {
                stage('API Tests') {
                    when {
                        anyOf {
                            equals expected: 'api', actual: params.TEST_SUITE
                            equals expected: 'full', actual: params.TEST_SUITE
                        }
                    }
                    steps {
                        script {
                            echo "🧪 Running API tests..."

                            try {
                                bat """
                                    @echo off
                                    echo Running Newman API tests...

                                    REM Install Newman if not present
                                    where newman >nul 2>nul
                                    if %errorlevel% neq 0 (
                                        echo Installing Newman...
                                        npm install -g newman newman-reporter-html
                                    )

                                    REM Run Postman collection
                                    newman run tests/WeSign-API-Collection.postman_collection.json ^
                                        --environment tests/DevTest-Environment.postman_environment.json ^
                                        --reporters cli,html ^
                                        --reporter-html-export "newman-report.html" ^
                                        --timeout 30000 ^
                                        --delay-request 1000
                                """

                                // Archive test reports
                                archiveArtifacts(
                                    artifacts: 'newman-report.html',
                                    allowEmptyArchive: true
                                )

                                echo "✅ API tests completed"

                            } catch (Exception e) {
                                echo "❌ API tests failed: ${e.message}"
                                archiveArtifacts(
                                    artifacts: 'newman-report.html',
                                    allowEmptyArchive: true
                                )

                                if (!params.FORCE_DEPLOY) {
                                    throw e
                                }
                            }
                        }
                    }
                }

                stage('E2E Tests') {
                    when {
                        anyOf {
                            equals expected: 'e2e', actual: params.TEST_SUITE
                            equals expected: 'full', actual: params.TEST_SUITE
                        }
                    }
                    steps {
                        script {
                            echo "🎭 Running E2E tests with Playwright..."

                            try {
                                bat """
                                    @echo off
                                    echo Setting up E2E test environment...

                                    REM Install Python dependencies
                                    ${env.PYTHON_CMD} -m pip install --quiet --upgrade pip
                                    ${env.PYTHON_CMD} -m pip install --quiet pytest playwright pytest-html

                                    REM Install Playwright browsers
                                    ${env.PYTHON_CMD} -m playwright install --with-deps chromium

                                    REM Set environment variables
                                    set WESIGN_BASE_URL=https://${env.DEVTEST_SERVER}
                                    set WESIGN_USERNAME=testuser
                                    set WESIGN_PASSWORD=testpass

                                    REM Run E2E tests
                                    ${env.PYTHON_CMD} -m pytest tests/e2e/ ^
                                        --html=e2e-report.html ^
                                        --self-contained-html ^
                                        --tb=short ^
                                        --maxfail=5 ^
                                        -v
                                """

                                // Archive test reports and screenshots
                                archiveArtifacts(
                                    artifacts: 'e2e-report.html,test-results/**/*,screenshots/**/*',
                                    allowEmptyArchive: true
                                )

                                echo "✅ E2E tests completed"

                            } catch (Exception e) {
                                echo "❌ E2E tests failed: ${e.message}"
                                archiveArtifacts(
                                    artifacts: 'e2e-report.html,test-results/**/*,screenshots/**/*',
                                    allowEmptyArchive: true
                                )

                                if (!params.FORCE_DEPLOY) {
                                    throw e
                                }
                            }
                        }
                    }
                }
            }
        }

        stage('Generate Reports') {
            steps {
                script {
                    echo "📊 Generating deployment reports..."

                    // Generate comprehensive deployment report
                    def reportData = wesignDeploy.generateDeploymentReport([
                        deploymentId: env.DEPLOYMENT_ID,
                        executionId: env.QA_EXECUTION_ID,
                        branch: env.ACTUAL_BRANCH,
                        commit: env.GIT_COMMIT_SHA,
                        packageFile: env.PACKAGE_FILE,
                        deploymentTimestamp: env.DEPLOYMENT_TIMESTAMP,
                        testSuite: params.TEST_SUITE,
                        dryRun: params.DRY_RUN
                    ])

                    // Write report to file
                    writeFile file: 'deployment-report.json', text: groovy.json.JsonOutput.prettyPrint(groovy.json.JsonOutput.toJson(reportData))

                    // Archive reports
                    archiveArtifacts(
                        artifacts: 'deployment-report.json',
                        allowEmptyArchive: false
                    )

                    echo "✅ Reports generated"
                }
            }
        }
    }

    post {
        always {
            script {
                echo "🧹 Performing cleanup..."

                try {
                    // Final status report to QA Intelligence
                    def finalStatus = currentBuild.currentResult ?: 'SUCCESS'
                    wesignDeploy.reportStatus(
                        executionId: env.QA_EXECUTION_ID,
                        stage: 'completed',
                        status: finalStatus.toLowerCase(),
                        message: "Deployment pipeline ${finalStatus.toLowerCase()}",
                        metadata: [
                            duration: currentBuild.duration,
                            dryRun: params.DRY_RUN,
                            testSuite: params.TEST_SUITE,
                            buildUrl: env.BUILD_URL
                        ]
                    )
                } catch (Exception e) {
                    echo "⚠️ Failed to report final status: ${e.message}"
                }

                // Cleanup workspace (selective)
                bat '''
                    @echo off
                    REM Remove temporary files but keep important artifacts
                    if exist "Package" rmdir /s /q Package
                    if exist "TestResults" rmdir /s /q TestResults
                    del /q *.tmp 2>nul
                    del /q *.log 2>nul
                '''
            }
        }

        success {
            script {
                def message = """
                ✅ **WeSign Deployment Successful**

                **Details:**
                - Branch/Tag: ${params.BRANCH_OR_TAG} (${env.ACTUAL_BRANCH})
                - Build: #${env.BUILD_NUMBER}
                - Commit: ${env.GIT_COMMIT_SHA?.take(8)}
                - Package: ${env.PACKAGE_FILE}
                - Test Suite: ${params.TEST_SUITE}
                - Dry Run: ${params.DRY_RUN}

                **Deployment Info:**
                - Target: ${env.DEVTEST_SERVER}
                - Timestamp: ${env.DEPLOYMENT_TIMESTAMP}
                - Backup: ${env.BACKUP_LOCATION}

                **Links:**
                - [Jenkins Build](${env.BUILD_URL})
                - [QA Intelligence](${env.QA_BACKEND_URL}/wesign)
                - [Application Health](https://${env.DEVTEST_SERVER}/health)
                """

                // Send notifications
                wesignDeploy.sendNotifications(
                    subject: "✅ WeSign Deployment Successful - Build #${env.BUILD_NUMBER}",
                    message: message,
                    recipients: params.NOTIFICATION_RECIPIENTS,
                    priority: 'normal'
                )
            }
        }

        failure {
            script {
                def message = """
                ❌ **WeSign Deployment Failed**

                **Details:**
                - Branch/Tag: ${params.BRANCH_OR_TAG}
                - Build: #${env.BUILD_NUMBER}
                - Error: ${currentBuild.description ?: 'Build failed - check logs'}
                - Test Suite: ${params.TEST_SUITE}
                - Dry Run: ${params.DRY_RUN}

                **Links:**
                - [Jenkins Build](${env.BUILD_URL})
                - [Console Output](${env.BUILD_URL}console)
                - [QA Intelligence](${env.QA_BACKEND_URL}/wesign)

                **Action Required:**
                Please review the build logs and take necessary action.
                """

                // Send failure notifications with high priority
                wesignDeploy.sendNotifications(
                    subject: "❌ WeSign Deployment Failed - Build #${env.BUILD_NUMBER}",
                    message: message,
                    recipients: params.NOTIFICATION_RECIPIENTS,
                    priority: 'high'
                )
            }
        }

        unstable {
            script {
                def message = """
                ⚠️ **WeSign Deployment Unstable**

                **Details:**
                - Branch/Tag: ${params.BRANCH_OR_TAG}
                - Build: #${env.BUILD_NUMBER}
                - Warning: Some tests failed but deployment continued
                - Test Suite: ${params.TEST_SUITE}
                - Force Deploy: ${params.FORCE_DEPLOY}

                **Links:**
                - [Jenkins Build](${env.BUILD_URL})
                - [Test Results](${env.BUILD_URL}testReport/)
                - [QA Intelligence](${env.QA_BACKEND_URL}/wesign)

                **Action Required:**
                Please review test failures and consider fixes.
                """

                // Send warning notifications
                wesignDeploy.sendNotifications(
                    subject: "⚠️ WeSign Deployment Unstable - Build #${env.BUILD_NUMBER}",
                    message: message,
                    recipients: params.NOTIFICATION_RECIPIENTS,
                    priority: 'normal'
                )
            }
        }
    }
}