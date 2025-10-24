# QA Intelligence Backend - Configuration Guide

**Last Updated:** October 24, 2025
**Version:** 2.0.0

## 🎯 Overview

This guide explains how to configure the QA Intelligence backend for different environments (Windows, Linux, macOS, Docker).

---

## 📁 Environment Configuration

### Quick Start

1. **Copy the example environment file:**
```bash
cp .env.example .env
```

2. **Edit `.env` and configure paths for your system:**
```bash
# For Linux/macOS
WESIGN_TEST_SUITE_PATH=../new_tests_for_wesign
PYTHON_PATH=python3

# For Windows
WESIGN_TEST_SUITE_PATH=../new_tests_for_wesign
PYTHON_PATH=python

# For custom absolute paths (any OS)
WESIGN_TEST_SUITE_PATH=/absolute/path/to/new_tests_for_wesign
PYTHON_PATH=/usr/local/bin/python3
```

3. **Start the backend:**
```bash
npm run dev
```

---

## 🔧 Configuration Options

### Required Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `WESIGN_TEST_SUITE_PATH` | Path to WeSign test suite (relative or absolute) | `../new_tests_for_wesign` | `../new_tests_for_wesign` |
| `PYTHON_PATH` | Python executable path | `python` | `python3` or `/usr/bin/python3` |
| `PORT` | Backend API port | `8082` | `8082` |
| `NODE_ENV` | Environment mode | `development` | `development`, `production` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_PATH` | SQLite database location | `./scheduler.db` |
| `LOG_LEVEL` | Logging level | `info` |
| `CORS_ORIGIN` | Allowed frontend origins | `http://localhost:3001` |
| `WESIGN_DOTNET_URL` | WeSign .NET backend URL | `http://localhost:5000` |

---

## 🌍 Platform-Specific Setup

### Linux / macOS

```bash
# .env file
WESIGN_TEST_SUITE_PATH=../new_tests_for_wesign
PYTHON_PATH=python3  # or python
PORT=8082
NODE_ENV=development
```

**Verify Python:**
```bash
python3 --version
# Python 3.8+ required
```

**Start Backend:**
```bash
cd backend
npm install
npm run dev
```

---

### Windows

```bash
# .env file
WESIGN_TEST_SUITE_PATH=../new_tests_for_wesign
PYTHON_PATH=python
PORT=8082
NODE_ENV=development
```

**Verify Python:**
```cmd
python --version
# Python 3.8+ required
```

**Start Backend:**
```cmd
cd backend
npm install
npm run dev
```

---

### Docker

```dockerfile
# docker-compose.yml
services:
  backend:
    build: ./backend
    environment:
      - WESIGN_TEST_SUITE_PATH=/app/new_tests_for_wesign
      - PYTHON_PATH=python3
      - PORT=8082
      - NODE_ENV=production
    volumes:
      - ./new_tests_for_wesign:/app/new_tests_for_wesign
    ports:
      - "8082:8082"
```

**Start with Docker:**
```bash
docker-compose up -d
```

---

## 📂 Path Resolution

The backend uses the following path resolution logic:

### WeSign Test Suite Path

```typescript
// Priority order:
1. Environment variable: WESIGN_TEST_SUITE_PATH
2. Relative path: ../new_tests_for_wesign
3. Fallback: Current directory + new_tests_for_wesign

// Examples:
WESIGN_TEST_SUITE_PATH=../new_tests_for_wesign  // Relative
WESIGN_TEST_SUITE_PATH=/opt/qa/tests            // Absolute
WESIGN_TEST_SUITE_PATH=./tests                  // Current dir relative
```

### Python Executable Path

```typescript
// Priority order:
1. Environment variable: PYTHON_PATH
2. System PATH: 'python' or 'python3'

// Examples:
PYTHON_PATH=python                              // System PATH
PYTHON_PATH=python3                             // System PATH (Linux)
PYTHON_PATH=/usr/local/bin/python3              // Absolute
PYTHON_PATH=C:/Python312/python.exe             // Windows absolute
```

---

## 🧪 Testing Configuration

### Verify Paths

```bash
# Check health endpoint
curl http://localhost:8082/api/wesign/health

# Expected response:
{
  "success": true,
  "healthy": true,
  "checks": {
    "pythonAvailable": true,
    "wesignTestsExists": true,
    "playwrightInstalled": true,
    "pythonPath": "python3",
    "testBasePath": "/home/user/playwrightTestsClaude/new_tests_for_wesign",
    "pythonVersion": "Python 3.12.0"
  }
}
```

### Test Execution

```bash
# Run a single test
curl -X POST http://localhost:8082/api/wesign/test/run \
  -H "Content-Type: application/json" \
  -d '{
    "testId": "test_auth_login",
    "testFile": "tests/auth/test_authentication_core_fixed.py"
  }'

# Check execution status
curl http://localhost:8082/api/wesign/tests/status/{runId}
```

---

## 🔍 Troubleshooting

### Issue: "WeSign tests directory not found"

**Cause:** `WESIGN_TEST_SUITE_PATH` not set correctly

**Fix:**
```bash
# Verify the path exists
ls -la ../new_tests_for_wesign

# Set absolute path in .env
WESIGN_TEST_SUITE_PATH=/absolute/path/to/new_tests_for_wesign
```

---

### Issue: "Python not available"

**Cause:** Python not in PATH or `PYTHON_PATH` incorrect

**Fix:**
```bash
# Find Python location
which python3  # Linux/macOS
where python   # Windows

# Update .env
PYTHON_PATH=/path/to/python3
```

---

### Issue: "Test file not found"

**Cause:** Relative test file path incorrect

**Fix:**
- Test files should be relative to `WESIGN_TEST_SUITE_PATH`
- Example: `tests/auth/test_login.py` (not absolute paths)

---

## 📊 Configuration Validation

### Startup Checks

The backend automatically validates configuration on startup:

```bash
[INFO] Test Discovery Service initialized
  testRootPath: /app/backend/../tests
  wesignTestDir: /app/new_tests_for_wesign

[INFO] WeSign environment validation: Directory exists
[INFO] Python available: Python 3.12.0
```

### Manual Validation

```bash
# Test backend health
npm run healthcheck:api

# Expected output:
✅ Backend API: Healthy
✅ Database: Connected
✅ WeSign Tests: Found (634 tests)
✅ Python: Available (3.12.0)
```

---

## 🚀 Production Deployment

### Production .env

```bash
NODE_ENV=production
PORT=8082
WESIGN_TEST_SUITE_PATH=/opt/qa-intelligence/tests
PYTHON_PATH=/usr/bin/python3
DATABASE_PATH=/var/lib/qa-intelligence/scheduler.db
LOG_LEVEL=warn
CORS_ORIGIN=https://qa-dashboard.example.com
```

### Security Best Practices

1. **Use absolute paths in production**
2. **Set restrictive file permissions on .env**
   ```bash
   chmod 600 .env
   ```
3. **Use environment-specific .env files**
   - `.env.development`
   - `.env.staging`
   - `.env.production`

---

## 📝 Migration from Legacy Paths

If you're migrating from the old hardcoded paths:

### Old Code (Deprecated)
```typescript
// ❌ Don't do this
const PYTHON_PATH = "C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe";
const TEST_PATH = "C:/Users/gals/Desktop/playwrightTestsClaude/new_tests_for_wesign";
```

### New Code (Recommended)
```typescript
// ✅ Do this
const PYTHON_PATH = process.env.PYTHON_PATH || 'python';
const TEST_PATH = process.env.WESIGN_TEST_SUITE_PATH
  ? path.resolve(process.cwd(), process.env.WESIGN_TEST_SUITE_PATH)
  : path.resolve(process.cwd(), '../new_tests_for_wesign');
```

---

## 🆘 Support

For issues or questions:

1. Check logs: `tail -f logs/app.log`
2. Validate configuration: `curl http://localhost:8082/api/wesign/health`
3. Review this guide
4. Check GitHub issues: [Repository Issues](https://github.com/your-org/qa-intelligence/issues)

---

**Configuration complete!** 🎉

Your QA Intelligence backend is now properly configured for cross-platform deployment.
