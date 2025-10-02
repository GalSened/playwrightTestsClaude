@echo off
setlocal enabledelayedexpansion

echo 🚀 Starting Playwright Test Management Platform Production Deployment

REM Configuration
set COMPOSE_FILE=docker-compose.prod.yml
set ENV_FILE=.env.production

echo [INFO] Running pre-deployment checks...

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker and try again.
    exit /b 1
)

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] docker-compose is not installed. Please install it and try again.
    exit /b 1
)

REM Check if environment file exists
if not exist "%ENV_FILE%" (
    echo [WARNING] Environment file %ENV_FILE% not found. Using default values.
    echo [WARNING] Please review and update environment variables before production use.
)

REM Create required directories
echo [INFO] Creating required directories...
if not exist "volumes" mkdir volumes
if not exist "volumes\postgres" mkdir volumes\postgres
if not exist "volumes\backups" mkdir volumes\backups
if not exist "volumes\redis" mkdir volumes\redis
if not exist "volumes\prometheus" mkdir volumes\prometheus
if not exist "volumes\grafana" mkdir volumes\grafana
if not exist "volumes\logs" mkdir volumes\logs
if not exist "volumes\worker-logs" mkdir volumes\worker-logs
if not exist "volumes\nginx-logs" mkdir volumes\nginx-logs
if not exist "volumes\artifacts" mkdir volumes\artifacts
if not exist "ssl" mkdir ssl
if not exist "nginx\conf.d" mkdir nginx\conf.d
if not exist "monitoring\grafana\provisioning" mkdir monitoring\grafana\provisioning
if not exist "monitoring\grafana\dashboards" mkdir monitoring\grafana\dashboards

echo [SUCCESS] Directory structure created successfully

REM Build images
echo [INFO] Building Docker images...
docker-compose -f %COMPOSE_FILE% build --no-cache

if errorlevel 1 (
    echo [ERROR] Failed to build Docker images
    exit /b 1
)

echo [SUCCESS] Docker images built successfully

REM Stop existing containers if running
echo [INFO] Stopping existing containers...
docker-compose -f %COMPOSE_FILE% down --remove-orphans

REM Start services in order
echo [INFO] Starting infrastructure services...
docker-compose -f %COMPOSE_FILE% up -d postgres redis

REM Wait for databases to be healthy
echo [INFO] Waiting for database services to be ready...
timeout /t 30 >nul

echo [INFO] Checking database health...
:wait_postgres
docker-compose -f %COMPOSE_FILE% exec postgres pg_isready -U playwright_user -d playwright_enterprise_prod >nul 2>&1
if errorlevel 1 (
    echo [INFO] Waiting for PostgreSQL to be ready...
    timeout /t 5 >nul
    goto wait_postgres
)

echo [SUCCESS] PostgreSQL is ready

:wait_redis
docker-compose -f %COMPOSE_FILE% exec redis redis-cli ping | findstr PONG >nul
if errorlevel 1 (
    echo [INFO] Waiting for Redis to be ready...
    timeout /t 5 >nul
    goto wait_redis
)

echo [SUCCESS] Redis is ready

REM Start application services
echo [INFO] Starting application services...
docker-compose -f %COMPOSE_FILE% up -d backend frontend

REM Wait for application to be ready
timeout /t 15 >nul

REM Start reverse proxy and monitoring
echo [INFO] Starting reverse proxy and monitoring services...
docker-compose -f %COMPOSE_FILE% up -d nginx prometheus grafana

REM Start background services
echo [INFO] Starting background services...
docker-compose -f %COMPOSE_FILE% up -d worker backup

REM Final health checks
echo [INFO] Running health checks...

set SERVICES=postgres redis backend frontend nginx prometheus grafana worker
set FAILED_COUNT=0

for %%s in (%SERVICES%) do (
    docker-compose -f %COMPOSE_FILE% ps %%s | findstr "Up" >nul
    if errorlevel 1 (
        echo [ERROR] %%s is not running
        set /a FAILED_COUNT+=1
    ) else (
        echo [SUCCESS] %%s is running
    )
)

if !FAILED_COUNT! equ 0 (
    echo.
    echo 🎉 Deployment completed successfully!
    echo.
    echo 📊 Service URLs:
    echo    • Frontend: http://localhost
    echo    • Backend API: http://localhost/api
    echo    • Grafana: http://localhost:3000 ^(admin/admin^)
    echo    • Prometheus: http://localhost:9090
    echo.
    echo 📝 Next steps:
    echo    1. Update environment variables in %ENV_FILE%
    echo    2. Configure SSL certificates in .\ssl\ directory
    echo    3. Set up domain name and DNS records
    echo    4. Review and update monitoring alerts
    echo    5. Set up automated backups
    echo.
    echo 📖 View logs: docker-compose -f %COMPOSE_FILE% logs -f [service]
    echo 🔄 Update services: docker-compose -f %COMPOSE_FILE% pull ^&^& docker-compose -f %COMPOSE_FILE% up -d
    echo 🛑 Stop services: docker-compose -f %COMPOSE_FILE% down
) else (
    echo [ERROR] Some services failed to start
    echo [INFO] Check logs with: docker-compose -f %COMPOSE_FILE% logs [service]
    exit /b 1
)

endlocal