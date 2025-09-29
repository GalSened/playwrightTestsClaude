# QA Intelligence CI/CD Setup Guide

**Version:** 1.0
**Last Updated:** 2025-09-26
**Owner:** DevOps/QA Intelligence Team
**Target Audience:** DevOps Engineers, System Administrators, Developers

> **STATUS**: Production-Ready CI/CD Setup for WeSign Testing Platform

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Backend Infrastructure Setup](#backend-infrastructure-setup)
4. [Frontend Setup](#frontend-setup)
5. [Jenkins Configuration](#jenkins-configuration)
6. [PowerShell and WinRM Setup](#powershell-and-winrm-setup)
7. [Network Configuration](#network-configuration)
8. [Database Setup](#database-setup)
9. [Service Integration](#service-integration)
10. [Initial Testing](#initial-testing)
11. [Validation Procedures](#validation-procedures)
12. [Troubleshooting Common Setup Issues](#troubleshooting-common-setup-issues)

---

## Prerequisites

### System Requirements

**Development Environment**
- **OS**: Windows 11 (Primary), Windows 10 (Supported), Ubuntu 22.04+ (Docker)
- **CPU**: 8+ cores recommended (4 cores minimum)
- **RAM**: 16GB+ recommended (8GB minimum)
- **Storage**: 50GB+ free space (SSD recommended)
- **Network**: Stable internet connection (100Mbps+ recommended)

**Software Dependencies**
- **Node.js**: v18.x or v20.x LTS
- **Python**: 3.12.x (installed at `C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe`)
- **Git**: Latest stable version
- **Docker**: Desktop for Windows (optional, for containerized deployment)
- **PowerShell**: 7.x (Windows PowerShell 5.1 minimum)

### Required Accounts and Access
- GitHub account with repository access
- Jenkins server access (admin privileges)
- WeSign development environment access (`https://devtest.comda.co.il/`)
- Corporate network access for deployment targets

---

## Environment Setup

### 1. Create Environment Configuration

Create the primary environment file:

```bash
# Create .env file in project root
cp .env.example .env
```

**Required Environment Variables:**

```bash
# QA Intelligence Core Configuration
NODE_ENV=development
PORT=8082
DATABASE_URL=sqlite:./memory.sqlite
JWT_SECRET=your-super-secure-jwt-secret-key-here

# WeSign Integration
WESIGN_BASE_URL=https://devtest.comda.co.il
WESIGN_USERNAME=your-test-username
WESIGN_PASSWORD=your-test-password
WESIGN_API_KEY=your-api-key

# Python Configuration
PYTHON_PATH=C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe
PLAYWRIGHT_TESTS_PATH=C:/Users/gals/seleniumpythontests-1/playwright_tests/

# Performance Configuration
MAX_WORKERS=4
TIMEOUT_MS=30000
RETRY_ATTEMPTS=3

# Monitoring Configuration
LOG_LEVEL=info
ENABLE_MONITORING=true
METRICS_PORT=9090

# Jenkins Integration
JENKINS_URL=http://localhost:8080
JENKINS_USER=admin
JENKINS_TOKEN=your-jenkins-api-token

# Notifications
SLACK_WEBHOOK_URL=your-slack-webhook-url
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_USER=your-notifications-email
EMAIL_PASS=your-email-app-password
```

### 2. Validate Python Installation

```powershell
# Verify Python installation
& "C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe" --version

# Verify pip is working
& "C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe" -m pip --version

# Install required Python packages
& "C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe" -m pip install -r requirements.txt
```

### 3. Node.js Environment Setup

```bash
# Verify Node.js version
node --version  # Should be v18.x or v20.x

# Install global dependencies
npm install -g pm2 concurrently nodemon

# Install project dependencies
npm install
```

---

## Backend Infrastructure Setup

### 1. Database Initialization

```bash
# Navigate to backend directory
cd backend

# Install backend dependencies
npm install

# Initialize database schema
npm run db:init

# Run database migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

**Database Schema Verification:**

```bash
# Verify database tables
node check_schema.js

# Expected output: All required tables should be present
# - tests
# - executions
# - analytics
# - users
# - organizations
# - configurations
```

### 2. Backend Service Configuration

Create backend-specific environment file:

```bash
# backend/.env
cd backend
cp .env.example .env
```

**Backend Environment Variables:**

```bash
# Server Configuration
PORT=8082
NODE_ENV=development
API_PREFIX=/api

# Database Configuration
DATABASE_URL=sqlite:../memory.sqlite
DB_POOL_MAX=10
DB_POOL_MIN=2

# Authentication
JWT_SECRET=your-backend-jwt-secret
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# File Upload Configuration
UPLOAD_MAX_SIZE=50MB
UPLOAD_ALLOWED_TYPES=pdf,doc,docx,xls,xlsx,png,jpg,jpeg

# External Services
WESIGN_API_TIMEOUT=30000
WESIGN_RETRY_ATTEMPTS=3
WESIGN_RATE_LIMIT=100

# Monitoring & Logging
LOG_FILE=backend.log
LOG_MAX_SIZE=10MB
ENABLE_REQUEST_LOGGING=true
METRICS_ENABLED=true
```

### 3. Start Backend Services

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run start

# Using PM2 (recommended for production)
pm2 start ecosystem.config.js
```

**Verify Backend Service:**

```bash
# Health check
curl http://localhost:8082/api/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2025-09-26T...",
#   "uptime": "...",
#   "version": "1.0.0"
# }
```

---

## Frontend Setup

### 1. Frontend Configuration

```bash
# Navigate to frontend directory
cd apps/frontend/dashboard

# Install frontend dependencies
npm install

# Create frontend environment file
cp .env.example .env.local
```

**Frontend Environment Variables:**

```bash
# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:8082/api
NEXT_PUBLIC_WS_URL=ws://localhost:8082
NEXT_PUBLIC_APP_NAME=QA Intelligence
NEXT_PUBLIC_VERSION=2.0.0

# WeSign Integration
NEXT_PUBLIC_WESIGN_URL=https://devtest.comda.co.il
NEXT_PUBLIC_WESIGN_EMBED_MODE=true

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_REALTIME=true
NEXT_PUBLIC_ENABLE_WESIGN=true

# Development
NEXT_PUBLIC_DEBUG=false
NEXT_PUBLIC_LOG_LEVEL=info
```

### 2. Build and Start Frontend

```bash
# Development build
npm run dev

# Production build
npm run build
npm run start

# Verify frontend is accessible
curl http://localhost:3001/api/health
```

### 3. Frontend-Backend Integration Test

```bash
# Run integration test
node integration-test.js

# Expected output:
# ✓ Backend API accessible
# ✓ WebSocket connection established
# ✓ Authentication working
# ✓ WeSign integration active
```

---

## Jenkins Configuration

### 1. Jenkins Installation (Windows)

```powershell
# Download Jenkins WAR file
Invoke-WebRequest -Uri "https://get.jenkins.io/war-stable/latest/jenkins.war" -OutFile "jenkins.war"

# Create Jenkins home directory
New-Item -ItemType Directory -Path "C:\jenkins" -Force

# Set Jenkins home environment variable
[Environment]::SetEnvironmentVariable("JENKINS_HOME", "C:\jenkins", "Machine")

# Start Jenkins
java -jar jenkins.war --httpPort=8080
```

### 2. Jenkins Initial Setup

1. **Access Jenkins**: Navigate to `http://localhost:8080`
2. **Unlock Jenkins**: Use password from `C:\jenkins\secrets\initialAdminPassword`
3. **Install Plugins**: Choose "Install suggested plugins"
4. **Create Admin User**: Set up your administrator account

### 3. Required Jenkins Plugins

Install the following plugins via Jenkins Plugin Manager:

```
- Pipeline
- Git
- NodeJS
- PowerShell
- Workspace Cleanup
- Build Timeout
- Email Extension
- Slack Notification
- JUnit
- HTML Publisher
- Checkmarx
- SonarQube Scanner
```

### 4. Jenkins Global Configuration

**Configure Node.js:**
1. Go to "Manage Jenkins" → "Global Tool Configuration"
2. Add NodeJS installation:
   - Name: `NodeJS-18`
   - Version: `18.x LTS`
   - Global npm packages: `pm2 concurrently`

**Configure PowerShell:**
1. Go to "Manage Jenkins" → "Global Tool Configuration"
2. Configure PowerShell executable path:
   - PowerShell 7: `C:\Program Files\PowerShell\7\pwsh.exe`
   - Windows PowerShell: `%SystemRoot%\system32\WindowsPowerShell\v1.0\powershell.exe`

### 5. Create Jenkins Pipeline

Create a new Pipeline job with the following configuration:

```groovy
pipeline {
    agent any

    environment {
        NODE_VERSION = '18'
        PYTHON_PATH = 'C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe'
        WESIGN_TESTS_PATH = 'C:/Users/gals/seleniumpythontests-1/playwright_tests/'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                powershell 'Write-Host "Repository checked out successfully"'
            }
        }

        stage('Setup Environment') {
            parallel {
                stage('Backend Setup') {
                    steps {
                        dir('backend') {
                            powershell '''
                                npm install
                                npm run build:check
                                npm run db:migrate
                            '''
                        }
                    }
                }
                stage('Frontend Setup') {
                    steps {
                        dir('apps/frontend/dashboard') {
                            powershell '''
                                npm install
                                npm run build:check
                            '''
                        }
                    }
                }
            }
        }

        stage('Quality Checks') {
            parallel {
                stage('Backend Tests') {
                    steps {
                        dir('backend') {
                            powershell '''
                                npm run test:unit
                                npm run test:integration
                                npm run lint
                            '''
                        }
                    }
                }
                stage('Frontend Tests') {
                    steps {
                        dir('apps/frontend/dashboard') {
                            powershell '''
                                npm run test
                                npm run lint
                                npm run type-check
                            '''
                        }
                    }
                }
            }
        }

        stage('WeSign E2E Tests') {
            steps {
                powershell '''
                    cd "${env:WESIGN_TESTS_PATH}"
                    & "${env:PYTHON_PATH}" -m pytest tests/ -v --html=reports/pytest_report.html
                '''
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: "${env.WESIGN_TESTS_PATH}/reports",
                        reportFiles: 'pytest_report.html',
                        reportName: 'WeSign E2E Test Report'
                    ])
                }
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                powershell '''
                    # Start backend service
                    cd backend
                    pm2 stop qa-intelligence-backend || true
                    pm2 start ecosystem.config.js

                    # Start frontend service
                    cd ../apps/frontend/dashboard
                    pm2 stop qa-intelligence-frontend || true
                    npm run build
                    pm2 start ecosystem.config.js

                    # Health check
                    Start-Sleep -Seconds 10
                    Invoke-RestMethod -Uri "http://localhost:8082/api/health"
                    Invoke-RestMethod -Uri "http://localhost:3001/api/health"
                '''
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            slackSend(
                color: 'good',
                message: "✅ QA Intelligence CI/CD Pipeline Success - ${env.BUILD_URL}"
            )
        }
        failure {
            slackSend(
                color: 'danger',
                message: "❌ QA Intelligence CI/CD Pipeline Failed - ${env.BUILD_URL}"
            )
        }
    }
}
```

---

## PowerShell and WinRM Setup

### 1. PowerShell Execution Policy

```powershell
# Check current execution policy
Get-ExecutionPolicy

# Set execution policy for CI/CD (run as Administrator)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine

# Verify the change
Get-ExecutionPolicy -List
```

### 2. WinRM Configuration

```powershell
# Enable WinRM (run as Administrator)
Enable-PSRemoting -Force

# Configure WinRM service
winrm quickconfig -force

# Set WinRM service to automatic startup
Set-Service -Name WinRM -StartupType Automatic

# Configure WinRM for HTTP
winrm set winrm/config/service/auth '@{Basic="true"}'
winrm set winrm/config/service '@{AllowUnencrypted="true"}'
winrm set winrm/config/winrs '@{MaxMemoryPerShellMB="1024"}'

# Configure firewall (run as Administrator)
New-NetFirewallRule -DisplayName "WinRM-HTTP" -Direction Inbound -LocalPort 5985 -Protocol TCP -Action Allow
```

### 3. SMB Configuration (for file sharing)

```powershell
# Enable SMB features
Enable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol
Enable-WindowsOptionalFeature -Online -FeatureName "SMB1Protocol-Client"
Enable-WindowsOptionalFeature -Online -FeatureName "SMB1Protocol-Server"

# Configure SMB security
Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force
Set-SmbServerConfiguration -EnableSMB2Protocol $true -Force

# Create shared directory for CI/CD artifacts
New-Item -ItemType Directory -Path "C:\CIArtifacts" -Force
New-SmbShare -Name "CIArtifacts" -Path "C:\CIArtifacts" -FullAccess "Everyone"
```

---

## Network Configuration

### 1. Firewall Configuration

```powershell
# Create firewall rules for QA Intelligence services
New-NetFirewallRule -DisplayName "QA Intelligence Backend" -Direction Inbound -LocalPort 8082 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "QA Intelligence Frontend" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Jenkins" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow

# WebSocket support
New-NetFirewallRule -DisplayName "QA Intelligence WebSocket" -Direction Inbound -LocalPort 8082 -Protocol TCP -Action Allow
```

### 2. Network Testing

```powershell
# Test internal connectivity
Test-NetConnection -ComputerName localhost -Port 8082
Test-NetConnection -ComputerName localhost -Port 3001
Test-NetConnection -ComputerName localhost -Port 8080

# Test WeSign connectivity
Test-NetConnection -ComputerName devtest.comda.co.il -Port 443

# Test DNS resolution
Resolve-DnsName devtest.comda.co.il
```

### 3. Proxy Configuration (if required)

```powershell
# Configure proxy for npm
npm config set proxy http://your-proxy-server:port
npm config set https-proxy http://your-proxy-server:port

# Configure proxy for pip
& "${env:PYTHON_PATH}" -m pip config set global.proxy http://your-proxy-server:port

# Configure proxy for PowerShell
[System.Net.WebRequest]::DefaultWebProxy = New-Object System.Net.WebProxy('http://your-proxy-server:port')
```

---

## Database Setup

### 1. SQLite Configuration (Development)

```bash
# Initialize SQLite database
cd backend
npm run db:init

# Verify database creation
ls -la memory.sqlite

# Check database schema
sqlite3 memory.sqlite ".schema"
```

### 2. PostgreSQL Configuration (Production)

**Install PostgreSQL:**

```powershell
# Download PostgreSQL installer
# https://www.postgresql.org/download/windows/

# Create database and user
psql -U postgres
CREATE DATABASE qa_intelligence;
CREATE USER qa_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE qa_intelligence TO qa_user;
```

**Update environment for PostgreSQL:**

```bash
# Update .env file
DATABASE_URL=postgresql://qa_user:secure_password@localhost:5432/qa_intelligence
```

### 3. Database Migration and Seeding

```bash
# Run migrations
npm run db:migrate

# Verify tables
npm run db:verify

# Seed initial data
npm run db:seed

# Create admin user
npm run db:create-admin
```

---

## Service Integration

### 1. PM2 Process Management

Create PM2 ecosystem configuration:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'qa-intelligence-backend',
      script: './backend/dist/server.js',
      cwd: './',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8082
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 8082
      }
    },
    {
      name: 'qa-intelligence-frontend',
      script: './apps/frontend/dashboard/server.js',
      cwd: './',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};
```

**Start services:**

```bash
# Install PM2 globally
npm install -g pm2

# Start all services
pm2 start ecosystem.config.js

# Monitor services
pm2 monit

# View logs
pm2 logs qa-intelligence-backend
pm2 logs qa-intelligence-frontend
```

### 2. Windows Service Registration

```powershell
# Install PM2 as Windows service
npm install -g pm2-windows-service
pm2-service-install

# Configure service
pm2 set pm2-windows-service:PM2_HOME C:\ProgramData\pm2\home
pm2 set pm2-windows-service:PM2_SERVICE_PM2_DIR C:\Users\%USERNAME%\AppData\Roaming\npm\node_modules\pm2

# Start PM2 service
Start-Service PM2
```

---

## Initial Testing

### 1. Backend API Testing

```bash
# Test health endpoint
curl -X GET http://localhost:8082/api/health

# Test authentication
curl -X POST http://localhost:8082/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Test WeSign integration
curl -X GET http://localhost:8082/api/wesign/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. Frontend Testing

```bash
# Access frontend
curl -X GET http://localhost:3001/

# Test WebSocket connection
node test-websocket.js

# Test WeSign integration page
curl -X GET http://localhost:3001/wesign
```

### 3. E2E Testing

```bash
# Run WeSign test suite
cd "C:\Users\gals\seleniumpythontests-1\playwright_tests\"
& "C:\Users\gals\AppData\Local\Programs\Python\Python312\python.exe" -m pytest tests/auth/ -v

# Run full test suite (sample)
& "C:\Users\gals\AppData\Local\Programs\Python\Python312\python.exe" -m pytest tests/ -k "test_login" -v --html=reports/test_report.html
```

---

## Validation Procedures

### 1. System Health Validation

```powershell
# Create validation script
# validation-script.ps1

# Test all services
$services = @(
    @{ Name = "Backend"; Url = "http://localhost:8082/api/health" },
    @{ Name = "Frontend"; Url = "http://localhost:3001/api/health" },
    @{ Name = "WeSign"; Url = "https://devtest.comda.co.il" }
)

foreach ($service in $services) {
    try {
        $response = Invoke-RestMethod -Uri $service.Url -TimeoutSec 10
        Write-Host "✅ $($service.Name): OK" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ $($service.Name): FAILED - $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test database connectivity
try {
    node -e "require('./backend/src/database/connection').testConnection()"
    Write-Host "✅ Database: OK" -ForegroundColor Green
}
catch {
    Write-Host "❌ Database: FAILED" -ForegroundColor Red
}
```

### 2. Performance Validation

```bash
# Load testing with Apache Bench
ab -n 100 -c 10 http://localhost:8082/api/health

# Database performance test
node backend/scripts/performance-test.js

# WeSign integration performance
& "$env:PYTHON_PATH" performance_test.py
```

### 3. Security Validation

```powershell
# Test authentication
Invoke-RestMethod -Uri "http://localhost:8082/api/protected" -Headers @{"Authorization"="Bearer invalid-token"}

# Test CORS configuration
Invoke-RestMethod -Uri "http://localhost:8082/api/health" -Headers @{"Origin"="http://malicious-site.com"}

# Test rate limiting
for ($i = 1; $i -le 100; $i++) {
    Invoke-RestMethod -Uri "http://localhost:8082/api/health"
}
```

---

## Troubleshooting Common Setup Issues

### 1. Port Conflicts

```powershell
# Check which process is using a port
netstat -ano | findstr :8082
netstat -ano | findstr :3001

# Kill process using specific port
taskkill /PID <PID> /F
```

### 2. Node.js Module Issues

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Fix permissions (Linux/Mac)
sudo chown -R $(whoami) ~/.npm
```

### 3. Python Environment Issues

```powershell
# Verify Python path
where python
& "C:\Users\gals\AppData\Local\Programs\Python\Python312\python.exe" --version

# Reinstall pip packages
& "C:\Users\gals\AppData\Local\Programs\Python\Python312\python.exe" -m pip install --force-reinstall -r requirements.txt

# Virtual environment (if needed)
& "C:\Users\gals\AppData\Local\Programs\Python\Python312\python.exe" -m venv venv
.\venv\Scripts\Activate.ps1
```

### 4. Database Connection Issues

```bash
# Test SQLite permissions
ls -la memory.sqlite
chmod 666 memory.sqlite

# Test PostgreSQL connection
psql -h localhost -U qa_user -d qa_intelligence -c "SELECT 1;"

# Reset database
npm run db:reset
npm run db:migrate
```

### 5. WeSign Integration Issues

```bash
# Test WeSign connectivity
curl -I https://devtest.comda.co.il

# Verify credentials
node test-wesign-auth.js

# Check proxy settings
echo $HTTP_PROXY
echo $HTTPS_PROXY
```

### 6. Jenkins Configuration Issues

```powershell
# Check Jenkins logs
Get-Content C:\jenkins\logs\jenkins.log -Tail 50

# Reset Jenkins configuration
Stop-Service Jenkins
Remove-Item C:\jenkins\config.xml
Start-Service Jenkins

# Plugin issues
Remove-Item C:\jenkins\plugins\* -Recurse -Force
Restart-Service Jenkins
```

---

## Next Steps

After completing the setup:

1. **Review Operations Runbook**: Continue with `CICD_Operations_Runbook.md`
2. **Configure Monitoring**: Set up comprehensive monitoring and alerting
3. **Security Hardening**: Review and implement security best practices
4. **Performance Optimization**: Tune system performance for your environment
5. **Team Training**: Ensure team members are familiar with the system

---

## Support and Documentation

- **Internal Documentation**: `/docs` directory
- **API Documentation**: Available at `http://localhost:8082/api/docs`
- **Troubleshooting Guide**: `CICD_Troubleshooting_Guide.md`
- **Security Guidelines**: `CICD_Security_Guide.md`

---

**Document Version Control:**
- Version: 1.0
- Last Updated: 2025-09-26
- Next Review: 2025-12-26
- Maintainer: QA Intelligence Team