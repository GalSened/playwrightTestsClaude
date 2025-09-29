# Production Deployment Guide

This guide covers deploying the Playwright Test Management Platform in production.

## 🏗️ Architecture Overview

The production deployment includes:

- **Frontend**: React SPA served by Nginx
- **Backend**: Node.js API server with JWT authentication
- **Database**: PostgreSQL with row-level security and partitioning
- **Cache**: Redis for sessions and background jobs
- **Reverse Proxy**: Nginx with rate limiting and security headers
- **Monitoring**: Prometheus + Grafana dashboards
- **Background Jobs**: Worker processes for async tasks
- **Backup**: Automated PostgreSQL backups

## 🚀 Quick Start

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM available
- 20GB disk space minimum

### 1. Clone and Configure

```bash
# Clone repository
git clone <your-repo-url>
cd playwright-test-management

# Copy and edit environment variables
cp .env.production.example .env.production
nano .env.production
```

### 2. Update Environment Variables

**Critical settings to change:**

```bash
# Database passwords
POSTGRES_PASSWORD=your-secure-db-password

# JWT secrets (minimum 32 characters)
JWT_SECRET=your-very-secure-jwt-secret-at-least-32-chars
SESSION_SECRET=your-secure-session-secret

# Grafana admin credentials
GRAFANA_ADMIN_PASSWORD=your-grafana-password

# External services
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

### 3. Deploy

**Linux/macOS:**
```bash
chmod +x deploy-production.sh
./deploy-production.sh
```

**Windows:**
```cmd
deploy-production.bat
```

### 4. Verify Deployment

- Frontend: http://localhost
- API Health: http://localhost/api/health
- Grafana: http://localhost:3000 (admin/your-password)
- Prometheus: http://localhost:9090

## 📋 Service Configuration

### Services Overview

| Service | Port | Purpose | Replicas |
|---------|------|---------|----------|
| nginx | 80, 443 | Reverse proxy & load balancer | 1 |
| frontend | - | React SPA (internal) | 1 |
| backend | - | API server (internal) | 3 |
| postgres | 5432 | Primary database | 1 |
| redis | 6379 | Cache & job queue | 1 |
| worker | - | Background job processor | 2 |
| prometheus | 9090 | Metrics collection | 1 |
| grafana | 3000 | Monitoring dashboards | 1 |
| backup | - | Automated DB backups | 1 |

### Resource Allocation

**Backend Services:**
- CPU: 0.5-1.0 cores per instance
- Memory: 1-2GB per instance
- Replicas: 3 (load balanced)

**Database:**
- CPU: 2+ cores recommended
- Memory: 2-4GB recommended
- Storage: 20GB minimum, 100GB+ recommended

## 🔒 Security Features

### Network Security
- Internal Docker network isolation
- Rate limiting on all endpoints
- CORS protection
- Security headers (HSTS, CSP, etc.)

### Authentication
- JWT token-based authentication
- Multi-tenant row-level security
- API key management
- Password hashing with bcrypt

### Data Protection
- Database encryption at rest
- SSL/TLS encryption in transit
- Automated security updates
- Non-root container execution

## 📊 Monitoring & Observability

### Metrics Collection
- Application metrics (Prometheus)
- System metrics (Node exporter)
- Database metrics (PostgreSQL exporter)
- Custom business metrics

### Dashboards
- System overview dashboard
- Application performance metrics
- Database performance monitoring
- Error rate and latency tracking

### Alerting
Configure alerts in Grafana for:
- High error rates (>5%)
- Response time degradation
- Database connection issues
- Disk space usage (>80%)
- Memory usage (>90%)

## 🔧 Maintenance

### Daily Operations

**View logs:**
```bash
docker-compose -f docker-compose.prod.yml logs -f [service]
```

**Scale services:**
```bash
docker-compose -f docker-compose.prod.yml up -d --scale backend=5
```

**Update services:**
```bash
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### Database Management

**Manual backup:**
```bash
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U playwright_user playwright_enterprise_prod > backup.sql
```

**Restore from backup:**
```bash
docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U playwright_user playwright_enterprise_prod < backup.sql
```

### SSL Certificate Setup

1. Obtain SSL certificates from Let's Encrypt or your CA
2. Place certificates in `./ssl/` directory:
   - `fullchain.pem` (certificate + chain)
   - `privkey.pem` (private key)
3. Update nginx configuration for HTTPS
4. Restart nginx service

## 📈 Performance Tuning

### Database Optimization

**Connection pooling:**
- Default: 200 max connections
- Adjust based on load: `max_connections` in docker-compose.yml

**Memory settings:**
- `shared_buffers`: 25% of RAM
- `effective_cache_size`: 75% of RAM
- `work_mem`: Total RAM / max_connections / 4

### Application Tuning

**Node.js optimization:**
- Set `NODE_ENV=production`
- Enable cluster mode for CPU-intensive workloads
- Configure memory limits appropriately

**Redis optimization:**
- Enable persistence with AOF
- Set appropriate memory limits
- Configure eviction policies

## 🚨 Troubleshooting

### Common Issues

**Services not starting:**
```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# View service logs
docker-compose -f docker-compose.prod.yml logs [service]

# Restart specific service
docker-compose -f docker-compose.prod.yml restart [service]
```

**Database connection errors:**
```bash
# Check database health
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_isready -U playwright_user -d playwright_enterprise_prod

# View PostgreSQL logs
docker-compose -f docker-compose.prod.yml logs postgres
```

**Performance issues:**
```bash
# Monitor resource usage
docker stats

# Check application metrics
curl http://localhost/api/metrics
```

### Health Checks

All services include health checks that verify:
- Service responsiveness
- Database connectivity
- External service availability
- Critical functionality

## 🔄 Backup & Recovery

### Automated Backups

Backups run daily and include:
- Full database dump
- Compressed with gzip
- Retention: 30 days daily, 4 weeks weekly, 12 months monthly

**Backup location:** `./volumes/backups/`

### Disaster Recovery

1. **Database Recovery:**
   ```bash
   # Stop services
   docker-compose -f docker-compose.prod.yml down
   
   # Restore from backup
   docker-compose -f docker-compose.prod.yml up -d postgres
   # Wait for PostgreSQL to be ready
   gunzip -c backup.sql.gz | docker-compose -f docker-compose.prod.yml exec -T postgres \
     psql -U playwright_user playwright_enterprise_prod
   
   # Restart all services
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. **Complete System Recovery:**
   ```bash
   # Restore volumes from backup
   cp -r backup/volumes/* ./volumes/
   
   # Deploy system
   ./deploy-production.sh
   ```

## 📝 Next Steps

1. **DNS Setup:** Configure your domain to point to the server
2. **SSL Certificates:** Set up HTTPS with proper certificates
3. **Monitoring:** Configure alerting rules in Grafana
4. **Backups:** Test backup and recovery procedures
5. **Performance:** Run load tests and optimize as needed
6. **Security:** Regular security audits and updates

## 🆘 Support

- **Logs Location:** `./volumes/logs/`
- **Configuration:** `./docker-compose.prod.yml`
- **Monitoring:** http://localhost:3000 (Grafana)
- **Metrics:** http://localhost:9090 (Prometheus)

For issues, check the troubleshooting section and service logs first.