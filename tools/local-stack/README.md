# CMO/ELG Local Development Stack

This directory contains the Docker Compose stack for local development of the CMO/ELG (Context-Memory-Operations / Event Loop Graph) orchestration service.

## Stack Components

- **PostgreSQL 16** - Checkpoint storage and execution history
- **Redis 7** - Transport layer for A2A messaging
- **MinIO** - S3-compatible artifact storage

## Prerequisites

- Docker 20.10+ with Docker Compose
- At least 2GB free RAM
- Ports 5432, 6379, 9000, 9001 available

## Quick Start

### 1. Create Environment File

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env if you need to change defaults
# Default values work out-of-the-box
```

### 2. Start the Stack

```bash
# Start all services in detached mode
docker compose up -d

# View logs
docker compose logs -f

# Check status
docker compose ps
```

### 3. Verify Services

**PostgreSQL:**
```bash
# Connect via psql
docker exec -it cmo-postgres psql -U admin -d playwright_enterprise

# Or from host (if psql installed)
psql -h localhost -U admin -d playwright_enterprise

# Verify tables exist
\dt cmo_*

# Expected output:
#  cmo_runs
#  cmo_steps
#  cmo_activities
#  cmo_graphs
```

**Redis:**
```bash
# Test connection
docker exec -it cmo-redis redis-cli ping
# Expected: PONG

# If password is set
docker exec -it cmo-redis redis-cli -a <password> ping
```

**MinIO:**
```bash
# Access web console
open http://localhost:9001

# Login with credentials from .env:
#   Username: minioadmin (default)
#   Password: minioadmin123 (default)

# Verify bucket exists: cmo-artifacts

# Test S3 API via curl
curl http://localhost:9000/cmo-artifacts/
```

### 4. Stop the Stack

```bash
# Stop services (preserves data)
docker compose stop

# Stop and remove containers (preserves data in volumes)
docker compose down

# Stop and remove everything including data
docker compose down -v
```

## Service Endpoints

| Service | Endpoint | Credentials |
|---------|----------|-------------|
| **Postgres** | `localhost:5432` | `admin` / `secure123` |
| **Redis** | `localhost:6379` | No password (default) |
| **MinIO API** | `http://localhost:9000` | `minioadmin` / `minioadmin123` |
| **MinIO Console** | `http://localhost:9001` | `minioadmin` / `minioadmin123` |

## Database Schema

The PostgreSQL database is automatically initialized with the CMO/ELG checkpoint schema on first startup:

- `cmo_runs` - Execution run tracking
- `cmo_steps` - Individual node execution steps
- `cmo_activities` - I/O activity recording for replay
- `cmo_graphs` - Graph definitions and versions

Schema file: `sql/schema.sql`

## Data Persistence

Data is stored in named Docker volumes:

- `cmo-postgres-data` - PostgreSQL data
- `cmo-redis-data` - Redis persistence
- `cmo-minio-data` - MinIO object storage

### View Volumes

```bash
docker volume ls | grep cmo
```

### Backup Data

```bash
# PostgreSQL
docker exec cmo-postgres pg_dump -U admin playwright_enterprise > backup.sql

# MinIO (via mc client)
docker run --rm --network local-stack_default \
  minio/mc cp --recursive myminio/cmo-artifacts ./backup-artifacts
```

### Restore Data

```bash
# PostgreSQL
cat backup.sql | docker exec -i cmo-postgres psql -U admin -d playwright_enterprise

# MinIO
docker run --rm --network local-stack_default \
  -v $(pwd)/backup-artifacts:/backup \
  minio/mc cp --recursive /backup myminio/cmo-artifacts
```

## Troubleshooting

### Ports Already in Use

If you get port conflict errors:

1. Check what's using the ports:
   ```bash
   # Windows
   netstat -ano | findstr :5432
   netstat -ano | findstr :6379
   netstat -ano | findstr :9000

   # Linux/Mac
   lsof -i :5432
   lsof -i :6379
   lsof -i :9000
   ```

2. Change ports in `.env`:
   ```bash
   POSTGRES_PORT=5433
   REDIS_PORT=6380
   S3_PORT=9001
   ```

3. Restart the stack:
   ```bash
   docker compose down
   docker compose up -d
   ```

### PostgreSQL Won't Start

**Check logs:**
```bash
docker compose logs postgres
```

**Common issues:**
- Data directory permissions: `docker compose down -v` then restart
- Old container running: `docker ps -a | grep cmo-postgres` then `docker rm`

### MinIO Bucket Not Created

The `minio-init` service may have failed:

```bash
# Check init logs
docker compose logs minio-init

# Manually create bucket
docker exec cmo-minio mc alias set myminio http://localhost:9000 minioadmin minioadmin123
docker exec cmo-minio mc mb myminio/cmo-artifacts
```

### Reset Everything

```bash
# Stop and remove all containers, volumes, and networks
docker compose down -v

# Remove images (optional)
docker compose down --rmi all

# Restart clean
docker compose up -d
```

## Integration with CMO Service

From the `services/cmo` directory:

```bash
# Install dependencies
npm install

# Start local stack first
cd ../../tools/local-stack
docker compose up -d
cd ../../services/cmo

# Copy environment
cp .env.example .env

# Start CMO service
npm run dev

# Run tests
npm test

# Replay a trace
npm run replay -- --trace <trace-id>
```

## Health Checks

All services have health checks configured:

```bash
# View health status
docker compose ps

# Postgres health
docker exec cmo-postgres pg_isready -U admin

# Redis health
docker exec cmo-redis redis-cli ping

# MinIO health
curl -f http://localhost:9000/minio/health/live
```

## Resource Usage

Typical resource consumption:

- **CPU**: ~5% idle, ~30% under load
- **Memory**: ~400MB total (Postgres: 200MB, Redis: 50MB, MinIO: 150MB)
- **Disk**: ~100MB + data

## Environment Variables Reference

See `.env.example` for all available configuration options.

Key variables:

- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` - Database credentials
- `REDIS_PASSWORD` - Redis authentication (leave empty for no auth)
- `S3_ACCESS_KEY`, `S3_SECRET_KEY` - MinIO credentials
- `S3_BUCKET` - Bucket name for artifacts

## Additional Commands

### View Real-Time Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f postgres
docker compose logs -f redis
docker compose logs -f minio
```

### Restart a Service

```bash
docker compose restart postgres
docker compose restart redis
docker compose restart minio
```

### Execute Commands in Containers

```bash
# PostgreSQL shell
docker exec -it cmo-postgres psql -U admin -d playwright_enterprise

# Redis CLI
docker exec -it cmo-redis redis-cli

# MinIO shell
docker exec -it cmo-minio sh
```

## Next Steps

- Start the CMO service: See `services/cmo/README.md`
- Run tests: `npm --prefix services/cmo test`
- Explore the API: See `services/cmo/docs/api.md`
- Configure policies: See `services/cmo/policies/README.md`

## Support

For issues specific to the local stack, check:

1. Docker daemon is running
2. Sufficient system resources
3. No port conflicts
4. Environment variables are set correctly

For CMO service issues, see `services/cmo/README.md`
