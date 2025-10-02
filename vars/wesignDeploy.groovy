#!/usr/bin/env groovy
/**
 * WeSign Deployment Pipeline Library
 *
 * This library provides reusable functions for WeSign deployment pipeline
 * with integrated QA Intelligence backend reporting and Windows-specific operations.
 *
 * Functions:
 * - initializeDeployment: Register deployment with QA Intelligence
 * - reportStatus: Report pipeline status to backend API
 * - executeDeployment: Execute deployment to Windows IIS server
 * - runSmokeTests: Execute health checks and smoke tests
 * - executeRollback: Rollback to previous deployment
 * - sendNotifications: Send email/Teams notifications
 * - generateDeploymentReport: Create comprehensive deployment report
 * - findMatchingBranches: Find git branches matching patterns
 *
 * Version: 2.0
 * Last Updated: 2025-09-26
 */

def initializeDeployment(Map config) {
    echo "🚀 Initializing deployment with QA Intelligence backend..."

    try {
        def payload = [
            deploymentId: config.deploymentId,
            branch: config.branch,
            buildNumber: config.buildNumber,
            triggeredBy: config.triggeredBy,
            dryRun: config.dryRun,
            timestamp: new Date().format('yyyy-MM-dd HH:mm:ss'),
            environment: 'devtest',
            application: 'wesign'
        ]

        def response = httpRequest(
            acceptType: 'APPLICATION_JSON',
            contentType: 'APPLICATION_JSON',
            httpMode: 'POST',
            url: "${env.QA_BACKEND_URL}/api/wesign/unified/execute",
            requestBody: groovy.json.JsonOutput.toJson([
                framework: 'wesign',
                mode: 'deployment',
                deploymentConfig: payload,
                aiEnabled: true,
                realTimeMonitoring: true,
                requestedBy: config.triggeredBy
            ]),
            customHeaders: [
                [name: 'Authorization', value: "Bearer ${env.QA_BACKEND_TOKEN}"],
                [name: 'Content-Type', value: 'application/json']
            ],
            timeout: 30
        )

        if (response.status == 200) {
            def responseData = readJSON text: response.content
            echo "✅ Deployment registered successfully"
            echo "   Execution ID: ${responseData.executionId}"
            echo "   Queue Position: ${responseData.queuePosition}"

            return [
                success: true,
                executionId: responseData.executionId,
                queuePosition: responseData.queuePosition,
                estimatedStartTime: responseData.estimatedStartTime
            ]
        } else {
            throw new Exception("HTTP ${response.status}: ${response.content}")
        }

    } catch (Exception e) {
        echo "⚠️ Failed to initialize with QA Intelligence: ${e.message}"
        echo "⚠️ Continuing without backend integration..."

        // Return fallback execution ID
        return [
            success: false,
            executionId: "fallback-${config.deploymentId}",
            error: e.message
        ]
    }
}

def reportStatus(Map config) {
    echo "📊 Reporting status to QA Intelligence: ${config.stage} - ${config.status}"

    try {
        def payload = [
            executionId: config.executionId,
            stage: config.stage,
            status: config.status,
            message: config.message,
            timestamp: new Date().format('yyyy-MM-dd HH:mm:ss'),
            metadata: config.metadata ?: [:]
        ]

        def response = httpRequest(
            acceptType: 'APPLICATION_JSON',
            contentType: 'APPLICATION_JSON',
            httpMode: 'PUT',
            url: "${env.QA_BACKEND_URL}/api/wesign/unified/execute/${config.executionId}/status",
            requestBody: groovy.json.JsonOutput.toJson(payload),
            customHeaders: [
                [name: 'Authorization', value: "Bearer ${env.QA_BACKEND_TOKEN}"],
                [name: 'Content-Type', value: 'application/json']
            ],
            timeout: 15,
            validResponseCodes: '200:299,404' // 404 is acceptable if execution not found
        )

        if (response.status >= 200 && response.status < 300) {
            echo "✅ Status reported successfully"
        } else if (response.status == 404) {
            echo "⚠️ Execution not found in backend (acceptable for fallback mode)"
        } else {
            echo "⚠️ Failed to report status: HTTP ${response.status}"
        }

    } catch (Exception e) {
        echo "⚠️ Status reporting failed: ${e.message}"
        // Don't fail the pipeline for reporting issues
    }
}

def executeDeployment(Map config) {
    echo "🚀 Starting deployment execution..."

    def startTime = System.currentTimeMillis()
    def timestamp = new Date().format('yyyy-MM-dd_HH-mm-ss')
    def backupLocation = null

    try {
        // Step 1: Create backup (unless skipped)
        if (!config.skipBackup) {
            echo "💾 Creating backup..."
            backupLocation = createBackup([
                targetServer: config.targetServer,
                sourcePath: config.targetPath,
                backupName: "wesign-backup-${timestamp}"
            ])
        }

        // Step 2: Stop IIS application pool
        echo "⏹️ Stopping IIS application pool..."
        executeRemoteCommand([
            server: config.targetServer,
            command: "Import-Module WebAdministration; Stop-WebAppPool -Name '${config.iisAppPool}'; " +
                    "do { Start-Sleep -Seconds 2; \$state = Get-WebAppPoolState -Name '${config.iisAppPool}' } " +
                    "while (\$state.Value -ne 'Stopped' -and (Get-Date) -lt (Get-Date).AddSeconds(30))"
        ])

        // Step 3: Transfer files via SMB
        echo "📁 Transferring deployment package..."
        transferDeploymentFiles([
            packageFile: config.packageFile,
            checksumFile: config.checksumFile,
            targetServer: config.targetServer,
            targetPath: config.targetPath,
            smbShare: config.smbShare
        ])

        // Step 4: Extract and deploy
        echo "📦 Extracting deployment package..."
        executeRemoteCommand([
            server: config.targetServer,
            command: "Add-Type -AssemblyName System.IO.Compression.FileSystem; " +
                    "[System.IO.Compression.ZipFile]::ExtractToDirectory('${config.targetPath}\\${config.packageFile}', '${config.targetPath}', \$true)"
        ])

        // Step 5: Update configuration
        echo "⚙️ Updating application configuration..."
        updateApplicationConfiguration([
            targetServer: config.targetServer,
            targetPath: config.targetPath,
            environment: 'devtest'
        ])

        // Step 6: Start IIS application pool
        echo "▶️ Starting IIS application pool..."
        executeRemoteCommand([
            server: config.targetServer,
            command: "Import-Module WebAdministration; Start-WebAppPool -Name '${config.iisAppPool}'; " +
                    "do { Start-Sleep -Seconds 2; \$state = Get-WebAppPoolState -Name '${config.iisAppPool}' } " +
                    "while (\$state.Value -ne 'Started' -and (Get-Date) -lt (Get-Date).AddSeconds(60))"
        ])

        // Step 7: Warm up application
        echo "🔥 Warming up application..."
        warmupApplication([
            targetServer: config.targetServer,
            healthEndpoint: '/health',
            maxAttempts: 10,
            delaySeconds: 10
        ])

        def duration = System.currentTimeMillis() - startTime
        echo "✅ Deployment completed successfully in ${duration}ms"

        return [
            success: true,
            timestamp: timestamp,
            backupLocation: backupLocation,
            duration: duration
        ]

    } catch (Exception e) {
        echo "❌ Deployment failed: ${e.message}"

        // Attempt automatic rollback if backup exists
        if (backupLocation && !config.skipBackup) {
            try {
                echo "🔄 Attempting automatic rollback..."
                executeRollback([
                    targetServer: config.targetServer,
                    backupLocation: backupLocation,
                    iisSite: config.iisSite,
                    iisAppPool: config.iisAppPool
                ])
                echo "✅ Automatic rollback completed"
            } catch (Exception rollbackError) {
                echo "❌ Automatic rollback failed: ${rollbackError.message}"
            }
        }

        throw e
    }
}

def createBackup(Map config) {
    echo "💾 Creating backup: ${config.backupName}"

    def backupPath = "C:\\Backups\\WeSign\\${config.backupName}"

    executeRemoteCommand([
        server: config.targetServer,
        command: "if (!(Test-Path 'C:\\Backups\\WeSign')) { New-Item -ItemType Directory -Path 'C:\\Backups\\WeSign' -Force }; " +
                "Copy-Item -Path '${config.sourcePath}' -Destination '${backupPath}' -Recurse -Force; " +
                "Compress-Archive -Path '${backupPath}' -DestinationPath '${backupPath}.zip' -Force; " +
                "Remove-Item -Path '${backupPath}' -Recurse -Force"
    ])

    echo "✅ Backup created: ${backupPath}.zip"
    return "${backupPath}.zip"
}

def transferDeploymentFiles(Map config) {
    echo "📁 Transferring files to ${config.targetServer}..."

    withCredentials([usernamePassword(credentialsId: 'wesign-devtest-deploy-user', usernameVariable: 'SMB_USER', passwordVariable: 'SMB_PASS')]) {
        bat """
            @echo off
            echo Connecting to SMB share...
            net use ${config.smbShare} /user:${SMB_USER} ${SMB_PASS} /persistent:no

            echo Verifying checksum...
            certutil -hashfile "${config.packageFile}" SHA256 > temp_checksum.txt
            fc /b "${config.checksumFile}" temp_checksum.txt
            if %errorlevel% neq 0 (
                echo Checksum verification failed
                net use ${config.smbShare} /delete
                exit /b 1
            )

            echo Copying package file...
            copy "${config.packageFile}" "${config.smbShare}\\"
            if %errorlevel% neq 0 (
                echo File copy failed
                net use ${config.smbShare} /delete
                exit /b 1
            )

            echo Disconnecting from SMB share...
            net use ${config.smbShare} /delete

            echo File transfer completed successfully
        """
    }
}

def executeRemoteCommand(Map config) {
    withCredentials([usernamePassword(credentialsId: 'wesign-devtest-deploy-user', usernameVariable: 'WINRM_USER', passwordVariable: 'WINRM_PASS')]) {
        def result = bat(
            script: """
                @echo off
                winrs -r:https://${config.server}:5986/wsman -u:${WINRM_USER} -p:${WINRM_PASS} -ssl "${config.command}"
            """,
            returnStatus: true
        )

        if (result != 0) {
            // Try HTTP WinRM as fallback
            echo "⚠️ HTTPS WinRM failed, trying HTTP..."
            result = bat(
                script: """
                    @echo off
                    winrs -r:http://${config.server}:5985/wsman -u:${WINRM_USER} -p:${WINRM_PASS} "${config.command}"
                """,
                returnStatus: true
            )

            if (result != 0) {
                throw new Exception("Remote command execution failed on ${config.server}")
            }
        }
    }
}

def updateApplicationConfiguration(Map config) {
    echo "⚙️ Updating application configuration for ${config.environment}..."

    // Transform web.config for target environment
    def transformCommand = """
        \$configPath = '${config.targetPath}\\web.config';
        \$transformPath = '${config.targetPath}\\web.${config.environment}.config';

        if (Test-Path \$transformPath) {
            # Apply XDT transformation
            Add-Type -Path 'C:\\Program Files (x86)\\Microsoft SDKs\\Windows\\v10.0A\\bin\\NETFX 4.8 Tools\\Microsoft.Web.XmlTransform.dll' -ErrorAction SilentlyContinue;
            \$transform = New-Object Microsoft.Web.XmlTransform.XmlTransformation(\$transformPath);
            \$doc = New-Object System.Xml.XmlDocument;
            \$doc.Load(\$configPath);
            \$transform.Apply(\$doc);
            \$doc.Save(\$configPath);
            Write-Host 'Configuration transformed successfully';
        } else {
            Write-Host 'No transformation file found, using default configuration';
        }

        # Update connection strings and app settings for DevTest
        \$config = [xml](Get-Content \$configPath);

        # Update connection string if needed
        if (\$config.configuration.connectionStrings.add | Where-Object { \$_.name -eq 'WeSignDB' }) {
            (\$config.configuration.connectionStrings.add | Where-Object { \$_.name -eq 'WeSignDB' }).connectionString = 'Data Source=devtest-sql01;Initial Catalog=WeSignDevTest;Integrated Security=true';
        }

        # Update app settings
        if (\$config.configuration.appSettings.add | Where-Object { \$_.key -eq 'Environment' }) {
            (\$config.configuration.appSettings.add | Where-Object { \$_.key -eq 'Environment' }).value = '${config.environment}';
        }

        \$config.Save(\$configPath);
        Write-Host 'Configuration updated for ${config.environment} environment';
    """

    executeRemoteCommand([
        server: config.targetServer,
        command: transformCommand
    ])
}

def warmupApplication(Map config) {
    echo "🔥 Warming up application on ${config.targetServer}..."

    def warmupCommand = """
        \$uri = 'https://${config.targetServer}${config.healthEndpoint}';
        \$maxAttempts = ${config.maxAttempts};
        \$delaySeconds = ${config.delaySeconds};
        \$attempt = 1;

        do {
            try {
                Write-Host "Warmup attempt \$attempt of \$maxAttempts...";
                \$response = Invoke-WebRequest -Uri \$uri -TimeoutSec 30 -UseBasicParsing;
                if (\$response.StatusCode -eq 200) {
                    Write-Host 'Application is responding correctly';
                    exit 0;
                }
            } catch {
                Write-Host "Attempt \$attempt failed: \$(\$_.Exception.Message)";
            }

            if (\$attempt -lt \$maxAttempts) {
                Start-Sleep -Seconds \$delaySeconds;
            }
            \$attempt++;
        } while (\$attempt -le \$maxAttempts);

        Write-Host 'Application warmup failed after \$maxAttempts attempts';
        exit 1;
    """

    executeRemoteCommand([
        server: config.targetServer,
        command: warmupCommand
    ])
}

def runSmokeTests(Map config) {
    echo "🔍 Running smoke tests against ${config.targetServer}..."

    def testResults = []

    try {
        // Test 1: Health endpoint
        echo "Testing health endpoint..."
        def healthTest = testEndpoint([
            server: config.targetServer,
            endpoint: config.healthEndpoint,
            expectedStatus: 200,
            timeout: 30
        ])
        testResults << healthTest

        // Test 2: Application main page
        echo "Testing main application..."
        def mainPageTest = testEndpoint([
            server: config.targetServer,
            endpoint: '/',
            expectedStatus: 200,
            timeout: 30
        ])
        testResults << mainPageTest

        // Test 3: API availability
        echo "Testing API availability..."
        def apiTest = testEndpoint([
            server: config.targetServer,
            endpoint: '/api/health',
            expectedStatus: 200,
            timeout: 30
        ])
        testResults << apiTest

        // Test 4: Database connectivity
        echo "Testing database connectivity..."
        def dbTest = testEndpoint([
            server: config.targetServer,
            endpoint: '/api/health/database',
            expectedStatus: 200,
            timeout: 30,
            allowedStatuses: [200, 503] // Allow degraded state
        ])
        testResults << dbTest

        def allPassed = testResults.every { it.success }
        def criticalPassed = testResults.findAll { it.critical }.every { it.success }

        return [
            success: criticalPassed, // Only fail if critical tests fail
            allPassed: allPassed,
            details: [
                totalTests: testResults.size(),
                passed: testResults.count { it.success },
                failed: testResults.count { !it.success },
                results: testResults
            ],
            error: allPassed ? null : "Some smoke tests failed - see details"
        ]

    } catch (Exception e) {
        return [
            success: false,
            allPassed: false,
            error: e.message,
            details: [
                totalTests: testResults.size(),
                results: testResults
            ]
        ]
    }
}

def testEndpoint(Map config) {
    try {
        def testCommand = """
            \$uri = 'https://${config.server}${config.endpoint}';
            \$allowedStatuses = @(${(config.allowedStatuses ?: [config.expectedStatus]).join(',')});

            try {
                \$response = Invoke-WebRequest -Uri \$uri -TimeoutSec ${config.timeout} -UseBasicParsing;
                if (\$allowedStatuses -contains \$response.StatusCode) {
                    Write-Host "SUCCESS: \$uri returned \$(\$response.StatusCode)";
                    exit 0;
                } else {
                    Write-Host "FAIL: \$uri returned \$(\$response.StatusCode), expected one of: \$(\$allowedStatuses -join ', ')";
                    exit 1;
                }
            } catch {
                Write-Host "ERROR: \$uri failed with: \$(\$_.Exception.Message)";
                exit 2;
            }
        """

        def result = bat(
            script: """
                @echo off
                powershell -Command "${testCommand}"
            """,
            returnStatus: true
        )

        return [
            success: result == 0,
            endpoint: config.endpoint,
            expectedStatus: config.expectedStatus,
            critical: config.critical ?: (config.endpoint == '/health' || config.endpoint == '/'),
            error: result != 0 ? "HTTP test failed with code ${result}" : null
        ]

    } catch (Exception e) {
        return [
            success: false,
            endpoint: config.endpoint,
            expectedStatus: config.expectedStatus,
            critical: config.critical ?: true,
            error: e.message
        ]
    }
}

def executeRollback(Map config) {
    echo "🔄 Executing rollback to previous deployment..."

    try {
        // Step 1: Stop application pool
        echo "⏹️ Stopping application pool..."
        executeRemoteCommand([
            server: config.targetServer,
            command: "Import-Module WebAdministration; Stop-WebAppPool -Name '${config.iisAppPool}'"
        ])

        // Step 2: Restore from backup
        echo "📦 Restoring from backup..."
        def restoreCommand = """
            \$backupFile = '${config.backupLocation}';
            \$targetPath = '${config.targetPath}';

            if (Test-Path \$backupFile) {
                # Remove current deployment
                if (Test-Path \$targetPath) {
                    Remove-Item -Path \$targetPath -Recurse -Force;
                }

                # Extract backup
                Add-Type -AssemblyName System.IO.Compression.FileSystem;
                [System.IO.Compression.ZipFile]::ExtractToDirectory(\$backupFile, (Split-Path \$targetPath -Parent), \$true);

                Write-Host 'Rollback completed successfully';
            } else {
                Write-Host 'Backup file not found: ' + \$backupFile;
                exit 1;
            }
        """

        executeRemoteCommand([
            server: config.targetServer,
            command: restoreCommand
        ])

        // Step 3: Start application pool
        echo "▶️ Starting application pool..."
        executeRemoteCommand([
            server: config.targetServer,
            command: "Import-Module WebAdministration; Start-WebAppPool -Name '${config.iisAppPool}'"
        ])

        // Step 4: Verify rollback
        echo "✅ Verifying rollback..."
        def verifyResult = runSmokeTests([
            targetServer: config.targetServer,
            healthEndpoint: "/health",
            timeout: 60,
            retryAttempts: 3,
            retryDelay: 15
        ])

        if (!verifyResult.success) {
            throw new Exception("Rollback verification failed: ${verifyResult.error}")
        }

        echo "✅ Rollback completed successfully"

        return [
            success: true,
            message: "Rollback completed and verified"
        ]

    } catch (Exception e) {
        echo "❌ Rollback failed: ${e.message}"
        throw e
    }
}

def sendNotifications(Map config) {
    echo "📧 Sending notifications..."

    try {
        // Email notifications
        if (config.recipients) {
            emailext(
                subject: config.subject,
                body: config.message,
                recipientProviders: [
                    [$class: 'DevelopersRecipientProvider'],
                    [$class: 'RequesterRecipientProvider']
                ],
                to: config.recipients,
                mimeType: 'text/html',
                attachLog: config.priority == 'high',
                compressLog: true
            )

            echo "✅ Email notifications sent to: ${config.recipients}"
        }

        // Teams notifications (if configured)
        if (env.TEAMS_WEBHOOK_URL) {
            def teamsPayload = [
                "@type": "MessageCard",
                "@context": "http://schema.org/extensions",
                "summary": config.subject,
                "themeColor": config.priority == 'high' ? 'FF0000' : (config.priority == 'normal' ? '00FF00' : 'FFA500'),
                "sections": [
                    [
                        "activityTitle": config.subject,
                        "activitySubtitle": "WeSign Deployment Pipeline",
                        "text": config.message.replaceAll(/\*\*(.*?)\*\*/, '<strong>$1</strong>'),
                        "facts": [
                            [
                                "name": "Build Number",
                                "value": env.BUILD_NUMBER
                            ],
                            [
                                "name": "Environment",
                                "value": "DevTest"
                            ],
                            [
                                "name": "Timestamp",
                                "value": new Date().format('yyyy-MM-dd HH:mm:ss')
                            ]
                        ]
                    ]
                ],
                "potentialAction": [
                    [
                        "@type": "OpenUri",
                        "name": "View Build",
                        "targets": [
                            [
                                "os": "default",
                                "uri": env.BUILD_URL
                            ]
                        ]
                    ]
                ]
            ]

            httpRequest(
                acceptType: 'APPLICATION_JSON',
                contentType: 'APPLICATION_JSON',
                httpMode: 'POST',
                url: env.TEAMS_WEBHOOK_URL,
                requestBody: groovy.json.JsonOutput.toJson(teamsPayload),
                timeout: 30
            )

            echo "✅ Teams notification sent"
        }

    } catch (Exception e) {
        echo "⚠️ Failed to send notifications: ${e.message}"
        // Don't fail the pipeline for notification issues
    }
}

def generateDeploymentReport(Map config) {
    echo "📊 Generating deployment report..."

    def report = [
        deployment: [
            id: config.deploymentId,
            executionId: config.executionId,
            timestamp: new Date().format('yyyy-MM-dd HH:mm:ss'),
            duration: currentBuild.duration ?: 0,
            status: currentBuild.currentResult ?: 'SUCCESS'
        ],
        source: [
            branch: config.branch,
            commit: config.commit,
            repository: env.GIT_REPO_URL
        ],
        build: [
            number: env.BUILD_NUMBER,
            id: env.BUILD_ID,
            url: env.BUILD_URL,
            packageFile: config.packageFile
        ],
        environment: [
            target: 'devtest',
            server: env.DEVTEST_SERVER,
            deploymentPath: env.DEVTEST_APP_PATH
        ],
        testing: [
            suite: config.testSuite,
            dryRun: config.dryRun
        ],
        artifacts: [
            packageUrl: "${env.BUILD_URL}artifact/${config.packageFile}",
            reportsUrl: "${env.BUILD_URL}artifact/deployment-report.json",
            logsUrl: "${env.BUILD_URL}console"
        ],
        metadata: [
            jenkinsVersion: Jenkins.instance.version,
            nodeLabels: env.NODE_LABELS?.split(' ') ?: [],
            executor: env.EXECUTOR_NUMBER,
            workspace: env.WORKSPACE
        ]
    ]

    echo "✅ Deployment report generated"
    return report
}

def findMatchingBranches(String repoUrl, String pattern) {
    echo "🔍 Finding branches matching pattern: ${pattern}"

    try {
        // Convert glob pattern to regex
        def regex = pattern.replace('*', '.*').replace('?', '.')

        // List remote branches (simplified implementation)
        def branchOutput = bat(
            script: "@git ls-remote --heads ${repoUrl}",
            returnStdout: true
        ).trim()

        def branches = []
        branchOutput.split('\n').each { line ->
            def parts = line.split('\t')
            if (parts.length == 2) {
                def branchName = parts[1].replaceAll('refs/heads/', '')
                if (branchName.matches(regex)) {
                    branches << branchName
                }
            }
        }

        echo "✅ Found ${branches.size()} matching branches: ${branches.join(', ')}"
        return branches

    } catch (Exception e) {
        echo "⚠️ Failed to find matching branches: ${e.message}"
        return []
    }
}

// Export functions for global access
return this