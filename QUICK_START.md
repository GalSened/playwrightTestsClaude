# QA Intelligence Platform - Quick Start Guide

**Last Updated:** October 24, 2025

This guide helps you get the QA Intelligence platform running and verified in **under 5 minutes**.

---

## 🚀 **Quick Start (3 Steps)**

### **Step 1: Start the Backend** (2 minutes)

```bash
# Navigate to backend directory
cd /home/user/playwrightTestsClaude/backend

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

**Expected Output:**
```
> qa-intelligence-backend@2.0.0 dev
> tsx watch src/server.ts

[INFO] Server starting on port 8082
[INFO] Database initialized
[INFO] WeSign integration initialized
[INFO] Server listening on http://localhost:8082
```

**Leave this terminal running!**

---

### **Step 2: Verify System** (1 minute)

Open a **new terminal** and run:

```bash
cd /home/user/playwrightTestsClaude
./verify-system.sh
```

**Expected Output:**
```
🚀 QA Intelligence Platform - System Verification
==================================================

✅ Backend is running

📋 Phase 1: Backend API Health Verification
-------------------------------------------
Testing /health endpoint... ✅ PASS
Testing /api/health endpoint... ✅ PASS
Testing /api/wesign/health endpoint... ✅ PASS

📋 Phase 2: WeSign Integration Testing
--------------------------------------
Testing test discovery... ✅ PASS (Found 634 tests)
Testing test suites endpoint... ✅ PASS (Found 8 suites)

📊 Verification Summary
========================================
Total Score: 6/6
Success Rate: 100%

✅ System is healthy and ready!
```

---

### **Step 3: Access the Dashboard** (Optional)

Open your browser:
```
http://localhost:8082/health
```

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-24T...",
  "database": { "healthy": true },
  "worker": { "running": true }
}
```

---

## 📊 **Available Endpoints**

| Endpoint | Purpose | Example |
|----------|---------|---------|
| `/health` | System health | `curl http://localhost:8082/health` |
| `/api/wesign/health` | WeSign health | `curl http://localhost:8082/api/wesign/health` |
| `/api/wesign/tests` | List all tests | `curl http://localhost:8082/api/wesign/tests` |
| `/api/wesign/suites` | List test suites | `curl http://localhost:8082/api/wesign/suites` |

---

## 🧪 **Run a Test (Advanced)**

```bash
curl -X POST http://localhost:8082/api/wesign/test/run \
  -H "Content-Type: application/json" \
  -d '{
    "testId": "test_auth",
    "testFile": "tests/auth/test_authentication_core_fixed.py"
  }'
```

---

## 🔧 **Troubleshooting**

### **Backend won't start**

1. **Check Node version:**
   ```bash
   node --version
   # Need 18.0.0 or higher
   ```

2. **Install dependencies:**
   ```bash
   cd backend
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check port 8082:**
   ```bash
   lsof -i :8082
   # If something is using it, kill the process or change PORT in .env
   ```

---

### **Verification script fails**

1. **Make sure backend is running** (Step 1)
2. **Check .env configuration:**
   ```bash
   cat backend/.env
   # Should have WESIGN_TEST_SUITE_PATH and PYTHON_PATH
   ```

3. **Verify tests directory:**
   ```bash
   ls ../new_tests_for_wesign/tests
   # Should show: auth, documents, self_signing, etc.
   ```

---

### **Python not found**

1. **Check Python installation:**
   ```bash
   python --version
   # or
   python3 --version
   ```

2. **Update .env:**
   ```bash
   # Edit backend/.env
   PYTHON_PATH=python3  # or full path like /usr/bin/python3
   ```

---

## 📝 **Next Steps**

After successful verification:

1. ✅ **Review the full verification plan:** `VERIFICATION_PLAN.md`
2. ✅ **Check configuration:** `backend/CONFIGURATION_GUIDE.md`
3. ✅ **Read about the fixes:** `PATH_FIXES_SUMMARY.md`
4. ✅ **Review test suite:** `new_tests_for_wesign/README_TEST_AUTOMATION.md`

---

## 🎯 **Quick Commands Reference**

```bash
# Start backend
cd backend && npm run dev

# Verify system
./verify-system.sh

# Check health
curl http://localhost:8082/health

# List tests
curl http://localhost:8082/api/wesign/tests | jq .

# Stop backend
# Press Ctrl+C in the terminal where backend is running
```

---

## 📞 **Support**

If you encounter issues:

1. Check logs in the backend terminal
2. Review `/backend/CONFIGURATION_GUIDE.md`
3. Check the troubleshooting sections above
4. Review error messages carefully

---

**You're all set!** 🎉

The QA Intelligence platform is ready to use!
