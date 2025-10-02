# QA Intelligence Platform - Makefile
# Convenient targets for development and testing

.PHONY: help up down cmo cmo-down test-cmo clean logs status

# Default target
help:
	@echo "QA Intelligence Platform - Development Commands"
	@echo ""
	@echo "Infrastructure:"
	@echo "  make up            - Start local stack (Postgres, Redis, MinIO)"
	@echo "  make down          - Stop local stack"
	@echo "  make logs          - View local stack logs"
	@echo "  make status        - Check local stack status"
	@echo ""
	@echo "CMO/ELG Service:"
	@echo "  make cmo           - Start CMO service"
	@echo "  make cmo-down      - Stop CMO service"
	@echo "  make test-cmo      - Run CMO tests"
	@echo "  make lint-cmo      - Lint CMO code"
	@echo ""
	@echo "Testing:"
	@echo "  make test-all      - Run all tests"
	@echo "  make test-backend  - Run backend tests"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean         - Clean build artifacts and volumes"
	@echo "  make install       - Install all dependencies"

# Infrastructure targets
up:
	@echo "🚀 Starting local stack..."
	cd tools/local-stack && cp -n .env.example .env 2>/dev/null || true && docker compose up -d
	@echo "✅ Local stack started"
	@echo "   - Postgres: localhost:5432"
	@echo "   - Redis: localhost:6379"
	@echo "   - MinIO: localhost:9000 (console: localhost:9001)"

down:
	@echo "🛑 Stopping local stack..."
	cd tools/local-stack && docker compose down
	@echo "✅ Local stack stopped"

logs:
	cd tools/local-stack && docker compose logs -f

status:
	@echo "📊 Local stack status:"
	cd tools/local-stack && docker compose ps

# CMO/ELG Service targets
cmo:
	@echo "🚀 Starting CMO/ELG service..."
	cd services/cmo && npm run dev

cmo-down:
	@echo "🛑 Stopping CMO/ELG service..."
	@pkill -f "tsx src/app/main.ts" || true
	@echo "✅ CMO service stopped"

test-cmo:
	@echo "🧪 Running CMO tests..."
	cd services/cmo && npm test
	@echo "✅ Tests complete"

lint-cmo:
	@echo "🔍 Linting CMO code..."
	cd services/cmo && npm run lint
	@echo "✅ Lint complete"

# Backend targets
test-backend:
	@echo "🧪 Running backend tests..."
	cd backend && npm test
	@echo "✅ Tests complete"

# Combined targets
test-all:
	@echo "🧪 Running all tests..."
	$(MAKE) test-cmo
	$(MAKE) test-backend
	@echo "✅ All tests complete"

install:
	@echo "📦 Installing dependencies..."
	cd backend && npm install
	cd services/cmo && npm install
	@echo "✅ Dependencies installed"

# Cleanup targets
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf backend/dist backend/build backend/coverage
	rm -rf services/cmo/dist services/cmo/coverage
	cd tools/local-stack && docker compose down -v
	@echo "✅ Cleanup complete"

# Database targets
db-migrate:
	@echo "🗄️  Running database migrations..."
	cd tools/local-stack && docker compose exec postgres psql -U admin -d playwright_enterprise -f /docker-entrypoint-initdb.d/01-schema.sql
	@echo "✅ Migrations complete"

db-reset:
	@echo "⚠️  Resetting database..."
	cd tools/local-stack && docker compose down -v postgres
	cd tools/local-stack && docker compose up -d postgres
	@echo "✅ Database reset complete"

# Docker shortcuts
docker-clean:
	@echo "🧹 Cleaning Docker resources..."
	docker system prune -f
	@echo "✅ Docker cleanup complete"
