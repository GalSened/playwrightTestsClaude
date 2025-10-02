#!/bin/bash

# AI Infrastructure Deployment Script
# This script deploys the complete AI infrastructure for the QA Intelligence Platform

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_ENV=${1:-production}
PROJECT_NAME="qa-ai-infrastructure"
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"

echo -e "${BLUE}🤖 QA Intelligence Platform - AI Infrastructure Deployment${NC}"
echo -e "${BLUE}===============================================================${NC}"
echo -e "${YELLOW}Environment: ${DEPLOY_ENV}${NC}"
echo -e "${YELLOW}Timestamp: $(date)${NC}"
echo ""

# Function to log messages
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker is not running. Please start Docker first."
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not available. Please install Docker Compose."
    fi
    
    # Check if Node.js is installed (for testing)
    if ! command -v node &> /dev/null; then
        warning "Node.js is not installed. Testing scripts may not work."
    fi
    
    # Check available disk space (need at least 10GB)
    available_space=$(df . | awk 'NR==2 {print $4}')
    if [ "$available_space" -lt 10485760 ]; then  # 10GB in KB
        warning "Less than 10GB disk space available. Deployment may fail."
    fi
    
    log "✅ Prerequisites check completed"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p nginx/ssl
    mkdir -p monitoring
    mkdir -p ml-trainer
    mkdir -p mongodb-init
    mkdir -p backups
    mkdir -p logs
    
    log "✅ Directories created"
}

# Generate configuration files
generate_configs() {
    log "Generating configuration files..."
    
    # Nginx configuration
    cat > nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream ai_backend {
        server ai-backend:3000;
        keepalive 32;
    }
    
    server {
        listen 80;
        server_name localhost;
        
        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
        
        # AI API routes
        location /api/ai/ {
            proxy_pass http://ai_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeout settings for AI operations
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
            
            # Buffer settings
            proxy_buffering on;
            proxy_buffer_size 8k;
            proxy_buffers 8 8k;
        }
        
        # Static files and frontend
        location / {
            root /usr/share/nginx/html;
            index index.html;
            try_files $uri $uri/ /index.html;
        }
    }
}
EOF

    # Prometheus configuration
    cat > monitoring/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'ai-backend'
    static_configs:
      - targets: ['ai-backend:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'mongodb'
    static_configs:
      - targets: ['mongodb:27017']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
EOF

    # MongoDB initialization script
    cat > mongodb-init/init.js << 'EOF'
// Initialize QA Intelligence database
db = db.getSiblingDB('qa_intelligence');

// Create collections
db.createCollection('test_executions');
db.createCollection('healing_sessions');
db.createCollection('performance_metrics');
db.createCollection('quality_assessments');
db.createCollection('conversation_history');
db.createCollection('model_metrics');

// Create indexes for better performance
db.test_executions.createIndex({ "testId": 1, "timestamp": -1 });
db.healing_sessions.createIndex({ "testId": 1, "createdAt": -1 });
db.performance_metrics.createIndex({ "testId": 1, "timestamp": -1 });
db.quality_assessments.createIndex({ "testId": 1, "generatedAt": -1 });
db.conversation_history.createIndex({ "sessionId": 1, "timestamp": -1 });
db.model_metrics.createIndex({ "modelType": 1, "timestamp": -1 });

print('QA Intelligence database initialized successfully');
EOF

    # Logstash configuration
    mkdir -p monitoring/logstash
    cat > monitoring/logstash/logstash.conf << 'EOF'
input {
  beats {
    port => 5044
  }
  tcp {
    port => 5000
    codec => json_lines
  }
}

filter {
  if [source] =~ /ai-backend/ {
    mutate {
      add_field => { "service" => "ai-backend" }
    }
  }
  
  if [level] {
    mutate {
      lowercase => [ "level" ]
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "qa-ai-logs-%{+YYYY.MM.dd}"
  }
  
  stdout {
    codec => rubydebug
  }
}
EOF

    log "✅ Configuration files generated"
}

# Create environment file
create_env_file() {
    log "Creating environment configuration..."
    
    if [ ! -f .env ]; then
        cat > .env << EOF
# AI Infrastructure Environment Configuration
NODE_ENV=${DEPLOY_ENV}
PORT=3000

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Database Configuration
MONGODB_CONNECTION_STRING=mongodb://qa_user:qa_password@mongodb:27017/qa_intelligence
MONGO_USERNAME=qa_user
MONGO_PASSWORD=qa_password

# Redis Configuration
REDIS_URL=redis://redis:6379

# Monitoring Configuration
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin_password_here

# AI Model Configuration
AI_MODEL_CACHE_ENABLED=true
TENSORFLOW_CPU_THREADS=4
TENSORFLOW_MEMORY_LIMIT=2048

# Security Configuration
JWT_SECRET=your_jwt_secret_here
API_RATE_LIMIT=1000

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json
EOF
        
        warning "⚠️ Please update the .env file with your actual API keys and passwords!"
        warning "⚠️ Default passwords are NOT secure for production use!"
    else
        log "✅ Using existing .env file"
    fi
}

# Build Docker images
build_images() {
    log "Building Docker images..."
    
    # Create backend Dockerfile if it doesn't exist
    if [ ! -f backend/Dockerfile ]; then
        cat > backend/Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Install system dependencies for TensorFlow.js and image processing
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p models cache logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/ai/health || exit 1

# Start the application
CMD ["npm", "start"]
EOF
    fi
    
    # Create ML trainer Dockerfile
    if [ ! -f ml-trainer/Dockerfile ]; then
        mkdir -p ml-trainer
        cat > ml-trainer/Dockerfile << 'EOF'
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    cron \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy training scripts
COPY . .

# Setup cron job
RUN echo "$TRAINING_SCHEDULE root python /app/train_models.py" >> /etc/crontab

# Start cron daemon
CMD ["cron", "-f"]
EOF
        
        cat > ml-trainer/requirements.txt << 'EOF'
tensorflow==2.14.0
numpy==1.24.3
pandas==2.0.3
scikit-learn==1.3.0
pymongo==4.6.0
redis==5.0.1
requests==2.31.0
schedule==1.2.0
EOF
        
        cat > ml-trainer/train_models.py << 'EOF'
#!/usr/bin/env python3
"""
AI Model Training Pipeline
Continuously improves AI models based on new data
"""

import logging
import os
from datetime import datetime

def train_models():
    """Main training function"""
    logging.info("Starting AI model training pipeline")
    
    # Add your model training logic here
    # This would include:
    # 1. Data collection from MongoDB
    # 2. Data preprocessing
    # 3. Model training
    # 4. Model validation
    # 5. Model deployment
    
    logging.info("AI model training completed successfully")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    train_models()
EOF
    fi
    
    log "✅ Docker images configuration ready"
}

# Deploy the infrastructure
deploy_infrastructure() {
    log "Deploying AI infrastructure..."
    
    # Pull latest images
    docker-compose -f docker-compose.ai.yml pull
    
    # Build custom images
    docker-compose -f docker-compose.ai.yml build
    
    # Start the infrastructure
    docker-compose -f docker-compose.ai.yml up -d
    
    log "✅ Infrastructure deployed"
}

# Wait for services to be ready
wait_for_services() {
    log "Waiting for services to be ready..."
    
    # Wait for MongoDB
    log "Waiting for MongoDB..."
    until docker-compose -f docker-compose.ai.yml exec -T mongodb mongosh --eval "db.adminCommand('ping')" &> /dev/null; do
        sleep 2
    done
    
    # Wait for Redis
    log "Waiting for Redis..."
    until docker-compose -f docker-compose.ai.yml exec -T redis redis-cli ping &> /dev/null; do
        sleep 2
    done
    
    # Wait for AI Backend
    log "Waiting for AI Backend..."
    until curl -f http://localhost:3000/api/ai/health &> /dev/null; do
        sleep 5
    done
    
    log "✅ All services are ready"
}

# Run tests
run_tests() {
    log "Running AI infrastructure tests..."
    
    if command -v node &> /dev/null; then
        if [ -f test-ai-infrastructure.js ]; then
            node test-ai-infrastructure.js
            if [ $? -eq 0 ]; then
                log "✅ All tests passed"
            else
                error "❌ Some tests failed. Check the logs for details."
            fi
        else
            warning "Test script not found. Skipping automated tests."
        fi
    else
        warning "Node.js not available. Skipping automated tests."
    fi
}

# Create backup
create_backup() {
    if [ -d "$BACKUP_DIR" ]; then
        log "Creating backup..."
        
        mkdir -p "$BACKUP_DIR"
        
        # Backup MongoDB
        docker-compose -f docker-compose.ai.yml exec -T mongodb mongodump --archive > "$BACKUP_DIR/mongodb-backup.archive"
        
        # Backup Redis
        docker-compose -f docker-compose.ai.yml exec -T redis redis-cli --rdb /data/dump.rdb
        docker cp "$(docker-compose -f docker-compose.ai.yml ps -q redis)":/data/dump.rdb "$BACKUP_DIR/redis-backup.rdb"
        
        # Backup configuration files
        cp -r nginx monitoring .env "$BACKUP_DIR/"
        
        log "✅ Backup created at $BACKUP_DIR"
    fi
}

# Display deployment information
show_deployment_info() {
    log "Deployment completed successfully! 🎉"
    echo ""
    echo -e "${BLUE}=== AI Infrastructure Endpoints ===${NC}"
    echo -e "${GREEN}AI API:              http://localhost:3000/api/ai${NC}"
    echo -e "${GREEN}Health Check:        http://localhost:3000/api/ai/health${NC}"
    echo -e "${GREEN}Grafana Dashboard:   http://localhost:3001 (admin/admin)${NC}"
    echo -e "${GREEN}Prometheus:          http://localhost:9090${NC}"
    echo -e "${GREEN}Kibana Logs:         http://localhost:5601${NC}"
    echo -e "${GREEN}MongoDB:             mongodb://localhost:27017${NC}"
    echo -e "${GREEN}Redis:               redis://localhost:6379${NC}"
    echo ""
    echo -e "${BLUE}=== Management Commands ===${NC}"
    echo -e "${YELLOW}View logs:           docker-compose -f docker-compose.ai.yml logs -f${NC}"
    echo -e "${YELLOW}Stop services:       docker-compose -f docker-compose.ai.yml down${NC}"
    echo -e "${YELLOW}Restart services:    docker-compose -f docker-compose.ai.yml restart${NC}"
    echo -e "${YELLOW}Scale AI backend:    docker-compose -f docker-compose.ai.yml up -d --scale ai-backend=3${NC}"
    echo ""
    echo -e "${BLUE}=== Next Steps ===${NC}"
    echo -e "${YELLOW}1. Update .env file with your actual API keys${NC}"
    echo -e "${YELLOW}2. Configure SSL certificates in nginx/ssl/${NC}"
    echo -e "${YELLOW}3. Set up monitoring alerts in Grafana${NC}"
    echo -e "${YELLOW}4. Configure backup schedule${NC}"
    echo -e "${YELLOW}5. Review security settings${NC}"
    echo ""
}

# Cleanup function
cleanup() {
    if [ $? -ne 0 ]; then
        error "Deployment failed. Cleaning up..."
        docker-compose -f docker-compose.ai.yml down
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Main deployment flow
main() {
    log "Starting AI infrastructure deployment..."
    
    check_prerequisites
    create_directories
    generate_configs
    create_env_file
    build_images
    
    if [ "$DEPLOY_ENV" == "production" ]; then
        create_backup
    fi
    
    deploy_infrastructure
    wait_for_services
    run_tests
    show_deployment_info
    
    log "🚀 AI Infrastructure deployment completed successfully!"
}

# Execute main function
main "$@"