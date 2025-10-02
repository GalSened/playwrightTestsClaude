#!/bin/bash
set -e

echo "🚀 Starting Playwright Test Management Platform Production Deployment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Pre-deployment checks
print_status "Running pre-deployment checks..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose is not installed. Please install it and try again."
    exit 1
fi

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    print_warning "Environment file $ENV_FILE not found. Using default values."
    print_warning "Please review and update environment variables before production use."
fi

# Check if required directories exist
print_status "Creating required directories..."
mkdir -p volumes/{postgres,backups,redis,prometheus,grafana,logs,worker-logs,nginx-logs,artifacts}
mkdir -p ssl nginx/conf.d monitoring/grafana/{provisioning,dashboards}

print_success "Directory structure created successfully"

# Build images
print_status "Building Docker images..."
docker-compose -f $COMPOSE_FILE build --no-cache

if [ $? -eq 0 ]; then
    print_success "Docker images built successfully"
else
    print_error "Failed to build Docker images"
    exit 1
fi

# Stop existing containers if running
print_status "Stopping existing containers..."
docker-compose -f $COMPOSE_FILE down --remove-orphans

# Start services in order
print_status "Starting infrastructure services..."
docker-compose -f $COMPOSE_FILE up -d postgres redis

# Wait for databases to be healthy
print_status "Waiting for database services to be ready..."
sleep 30

# Check database health
until docker-compose -f $COMPOSE_FILE exec postgres pg_isready -U playwright_user -d playwright_enterprise_prod; do
  print_status "Waiting for PostgreSQL to be ready..."
  sleep 5
done

print_success "PostgreSQL is ready"

# Check Redis health
until docker-compose -f $COMPOSE_FILE exec redis redis-cli ping | grep -q PONG; do
  print_status "Waiting for Redis to be ready..."
  sleep 5
done

print_success "Redis is ready"

# Start application services
print_status "Starting application services..."
docker-compose -f $COMPOSE_FILE up -d backend frontend

# Wait for application to be ready
sleep 15

# Start reverse proxy and monitoring
print_status "Starting reverse proxy and monitoring services..."
docker-compose -f $COMPOSE_FILE up -d nginx prometheus grafana

# Start background services
print_status "Starting background services..."
docker-compose -f $COMPOSE_FILE up -d worker backup

# Final health checks
print_status "Running health checks..."

# Check if all services are running
SERVICES=("postgres" "redis" "backend" "frontend" "nginx" "prometheus" "grafana" "worker")
FAILED_SERVICES=()

for service in "${SERVICES[@]}"; do
    if docker-compose -f $COMPOSE_FILE ps $service | grep -q "Up"; then
        print_success "$service is running"
    else
        print_error "$service is not running"
        FAILED_SERVICES+=($service)
    fi
done

if [ ${#FAILED_SERVICES[@]} -eq 0 ]; then
    print_success "All services are running successfully!"
    
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo ""
    echo "📊 Service URLs:"
    echo "   • Frontend: http://localhost"
    echo "   • Backend API: http://localhost/api"
    echo "   • Grafana: http://localhost:3000 (admin/admin)"
    echo "   • Prometheus: http://localhost:9090"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Update environment variables in $ENV_FILE"
    echo "   2. Configure SSL certificates in ./ssl/ directory"
    echo "   3. Set up domain name and DNS records"
    echo "   4. Review and update monitoring alerts"
    echo "   5. Set up automated backups"
    echo ""
    echo "📖 View logs: docker-compose -f $COMPOSE_FILE logs -f [service]"
    echo "🔄 Update services: docker-compose -f $COMPOSE_FILE pull && docker-compose -f $COMPOSE_FILE up -d"
    echo "🛑 Stop services: docker-compose -f $COMPOSE_FILE down"
    
else
    print_error "Some services failed to start: ${FAILED_SERVICES[*]}"
    print_status "Check logs with: docker-compose -f $COMPOSE_FILE logs [service]"
    exit 1
fi