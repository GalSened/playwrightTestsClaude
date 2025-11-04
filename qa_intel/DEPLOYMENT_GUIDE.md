# Test Banks Deployment Guide

**Version**: 1.0
**Date**: 2025-10-19
**Status**: ✅ Ready for Deployment

---

## 📋 Quick Start

This guide walks you through deploying the separate test banks feature from start to finish.

**Total Time**: ~30 minutes
**Difficulty**: Intermediate

---

## 🎯 What You're Deploying

A complete **3-bank test separation system**:
- **📱 E2E Bank**: 427 Playwright/Pytest tests
- **🔌 API Bank**: 97 Postman/Newman tests
- **⚡ Load Bank**: 9 K6 performance scenarios

---

## ✅ Prerequisites

### Required
- [x] Node.js 18+ installed
- [x] Python 3.12+ installed
- [x] SQLite3 installed
- [x] Backend running (port 8082)
- [x] Frontend running (port 3001)

### Optional
- [ ] pytest installed (`pip install pytest pytest-playwright`)
- [ ] newman installed (`npm install -g newman`)
- [ ] k6 installed

---

## 🚀 Step-by-Step Deployment

### Step 1: Database Migration (5 minutes)

**1.1. Navigate to backend directory**
```bash
cd backend
```

**1.2. Run the migration**
```bash
# If using SQLite (dev)
sqlite3 data/qa-intel.db < src/database/migrations/001_create_test_banks_schema.sql

# If using PostgreSQL (prod)
psql -d qa_intelligence < src/database/migrations/001_create_test_banks_schema.sql
```

**1.3. Verify tables created**
```bash
sqlite3 data/qa-intel.db "SELECT * FROM test_banks;"
```

**Expected Output**:
```
e2e|e2e|End-to-End Tests|...|laptop|#3B82F6|...
api|api|API Tests|...|api|#10B981|...
load|load|Load Tests|...|gauge|#F59E0B|...
```

✅ **Success**: You should see 3 test banks listed

---

### Step 2: Register API Routes (2 minutes)

**2.1. Open `backend/src/server.ts`**

**2.2. Add import at the top**
```typescript
import testBanksRouter from './routes/test-banks';
```

**2.3. Register routes (after other routes)**
```typescript
// Test Banks API Routes
app.use('/api/test-banks', testBanksRouter);
app.use('/api/e2e-tests', testBanksRouter);
app.use('/api/api-tests', testBanksRouter);
app.use('/api/load-tests', testBanksRouter);
```

**2.4. Save file**

✅ **Success**: Routes are now registered

---

### Step 3: Restart Backend (1 minute)

**3.1. Stop current backend**
```bash
# Press Ctrl+C in terminal running backend
```

**3.2. Start backend**
```bash
cd backend
npm run dev
```

**3.3. Verify server started**
```bash
curl http://localhost:8082/health
```

**Expected**: `{"status":"healthy"}`

✅ **Success**: Backend is running with new routes

---

### Step 4: Test Discovery (10 minutes)

**4.1. Trigger discovery via API**
```bash
curl -X POST http://localhost:8082/api/test-banks/all/discover
```

**This will**:
- Run pytest to discover 427 E2E tests (~5-10 seconds)
- Parse Postman collection for 97 API tests (~1 second)
- Scan K6 scenarios for 9 load tests (~1 second)
- Persist all to database

**Expected Response**:
```json
{
  "success": true,
  "message": "Discovery completed for all test banks",
  "data": {
    "e2e_count": 427,
    "api_count": 97,
    "load_count": 9,
    "total_count": 533,
    "discovery_time": 10234
  }
}
```

**4.2. Verify discovery**
```bash
# Check E2E tests count
sqlite3 data/qa-intel.db "SELECT COUNT(*) FROM e2e_tests;"
# Expected: 427

# Check API tests count
sqlite3 data/qa-intel.db "SELECT COUNT(*) FROM api_tests;"
# Expected: 97

# Check Load tests count
sqlite3 data/qa-intel.db "SELECT COUNT(*) FROM load_tests;"
# Expected: 9
```

✅ **Success**: All 533 tests discovered and stored

---

### Step 5: Test API Endpoints (5 minutes)

**5.1. Get all test banks**
```bash
curl http://localhost:8082/api/test-banks | jq
```

**Expected**: Array of 3 banks with statistics

**5.2. Get E2E tests**
```bash
curl http://localhost:8082/api/e2e-tests?limit=10 | jq
```

**Expected**: Array of 10 E2E tests

**5.3. Get API tests**
```bash
curl http://localhost:8082/api/api-tests?limit=10 | jq
```

**Expected**: Array of 10 API tests

**5.4. Get Load tests**
```bash
curl http://localhost:8082/api/load-tests | jq
```

**Expected**: Array of 9 load scenarios

✅ **Success**: All API endpoints working

---

### Step 6: Frontend Integration (5 minutes)

**6.1. Restart frontend**
```bash
cd apps/frontend/dashboard
npm run dev
```

**6.2. Open browser**
```
http://localhost:3001/test-banks
```

**6.3. Verify UI**
You should see:
- [x] 3 test bank cards (E2E, API, Load)
- [x] Test counts for each bank
- [x] Discover Tests button
- [x] Tab switching between banks

**6.4. Test discovery from UI**
- Click "Discover Tests" button
- Wait for completion (~10 seconds)
- See updated test counts

✅ **Success**: Frontend displaying test banks

---

### Step 7: Validation (2 minutes)

**7.1. Run validation checklist**

```bash
# 1. Check database
sqlite3 data/qa-intel.db "SELECT name, test_count FROM test_banks;"

# Expected output:
# e2e|427
# api|97
# load|9

# 2. Check API health
curl http://localhost:8082/api/test-banks/summary | jq

# 3. Check E2E category stats
curl http://localhost:8082/api/test-banks/e2e/stats | jq

# Expected: Array with categories (auth, contacts, documents, templates, self_signing)
```

**7.2. Visual validation**
- [ ] Open frontend at http://localhost:3001/test-banks
- [ ] See 3 test bank cards
- [ ] Click on E2E bank → See 427 tests
- [ ] Click on API bank → See placeholder
- [ ] Click on Load bank → See placeholder

✅ **Success**: Everything validated

---

## 🧪 Testing the Complete Flow

### Test Scenario: End-to-End Discovery and Display

**1. Start fresh**
```bash
# Clear existing data
sqlite3 data/qa-intel.db "DELETE FROM e2e_tests; DELETE FROM api_tests; DELETE FROM load_tests;"

# Verify empty
sqlite3 data/qa-intel.db "SELECT COUNT(*) FROM e2e_tests;"
# Expected: 0
```

**2. Trigger discovery**
```bash
curl -X POST http://localhost:8082/api/test-banks/all/discover
```

**3. Verify in database**
```bash
sqlite3 data/qa-intel.db "SELECT
  'E2E' as bank, COUNT(*) as count FROM e2e_tests
  UNION ALL
  SELECT 'API', COUNT(*) FROM api_tests
  UNION ALL
  SELECT 'Load', COUNT(*) FROM load_tests;"
```

**Expected**:
```
E2E|427
API|97
Load|9
```

**4. Check frontend**
- Reload http://localhost:3001/test-banks
- See updated counts

✅ **Success**: Complete flow working

---

## 🔍 Troubleshooting

### Issue: Discovery fails

**Symptom**: `POST /discover` returns error

**Solutions**:
1. Check Python installed: `py --version`
2. Check pytest installed: `py -m pytest --version`
3. Check test path exists: `ls new_tests_for_wesign/tests/`
4. Check backend logs for error details

---

### Issue: No tests discovered

**Symptom**: `SELECT COUNT(*)` returns 0

**Solutions**:
1. Check migration ran: `sqlite3 data/qa-intel.db ".tables"`
2. Re-run discovery: `curl -X POST http://localhost:8082/api/test-banks/all/discover`
3. Check test files exist: `ls new_tests_for_wesign/tests/auth/`

---

### Issue: Frontend shows 0 tests

**Symptom**: UI displays 0 for all banks

**Solutions**:
1. Check API accessible: `curl http://localhost:8082/api/test-banks`
2. Check CORS settings in backend
3. Check browser console for errors (F12)
4. Verify backend is running on port 8082

---

### Issue: Categories not showing

**Symptom**: E2E view shows no categories

**Solutions**:
1. Check discovery completed for E2E tests
2. Verify view exists: `sqlite3 data/qa-intel.db ".schema v_e2e_by_category"`
3. Query view directly: `SELECT * FROM v_e2e_by_category;`

---

## 📊 Monitoring & Health Checks

### Database Health

```bash
# Check table row counts
sqlite3 data/qa-intel.db "
SELECT
  'test_banks' as table_name, COUNT(*) as rows FROM test_banks
  UNION ALL
  SELECT 'e2e_tests', COUNT(*) FROM e2e_tests
  UNION ALL
  SELECT 'api_tests', COUNT(*) FROM api_tests
  UNION ALL
  SELECT 'load_tests', COUNT(*) FROM load_tests;
"
```

**Expected**:
```
test_banks|3
e2e_tests|427
api_tests|97
load_tests|9
```

---

### API Health

```bash
# Test all main endpoints
curl http://localhost:8082/api/test-banks
curl http://localhost:8082/api/e2e-tests?limit=1
curl http://localhost:8082/api/api-tests?limit=1
curl http://localhost:8082/api/load-tests?limit=1
```

All should return `{"success": true, ...}`

---

### Performance Metrics

**Discovery Times** (expected):
- E2E Discovery: 5-10 seconds
- API Discovery: <1 second
- Load Discovery: <1 second
- **Total**: ~10-15 seconds

**API Response Times** (expected):
- List endpoints: <50ms
- Detail endpoints: <100ms
- Discovery trigger: <200ms (async)

---

## 🎯 Success Criteria

### Must Have ✅
- [x] Database migration successful
- [x] 3 test banks created
- [x] 533 tests discovered (427 E2E + 97 API + 9 Load)
- [x] API endpoints responding
- [x] Frontend displays test banks
- [x] Discovery works from UI

### Should Have 🎯
- [x] Category filtering works
- [x] Statistics displayed correctly
- [x] Real-time updates on discovery
- [x] Error handling functional

### Nice to Have 🌟
- [ ] API/Load bank views (placeholder ready)
- [ ] Test execution integration
- [ ] Historical data
- [ ] Analytics dashboard

---

## 📝 Post-Deployment Checklist

- [ ] Run database migration
- [ ] Verify 3 banks created
- [ ] Trigger discovery
- [ ] Verify 533 tests discovered
- [ ] Test API endpoints
- [ ] Check frontend display
- [ ] Run validation tests
- [ ] Monitor for errors
- [ ] Document any issues
- [ ] Update team on deployment

---

## 🔄 Rollback Plan

If something goes wrong, rollback:

**1. Database rollback**
```bash
# Drop new tables
sqlite3 data/qa-intel.db "
DROP TABLE IF EXISTS test_executions;
DROP TABLE IF EXISTS load_tests;
DROP TABLE IF EXISTS api_tests;
DROP TABLE IF EXISTS e2e_tests;
DROP TABLE IF EXISTS test_banks;
"
```

**2. Code rollback**
```bash
git checkout HEAD~1 backend/src/routes/test-banks.ts
git checkout HEAD~1 backend/src/services/TestBankDiscoveryService.ts
git checkout HEAD~1 backend/src/server.ts
```

**3. Restart services**
```bash
npm run dev
```

---

## 📞 Support

**For issues**:
- Check logs: `backend/logs/`
- Check database: `sqlite3 data/qa-intel.db`
- Review documentation: `qa_intel/*.md`

**Common commands**:
```bash
# View backend logs
tail -f backend/logs/app.log

# Check database
sqlite3 data/qa-intel.db ".tables"

# Test API
curl -v http://localhost:8082/api/test-banks
```

---

## 🎊 Next Steps After Deployment

**1. Add API Bank View** (2-3 hours)
- Implement APITestBankView component
- Add module filtering
- Add execution controls

**2. Add Load Bank View** (2-3 hours)
- Implement LoadTestBankView component
- Add scenario type filtering
- Add K6 metrics display

**3. Test Execution** (1 day)
- Add execution endpoints
- Implement result tracking
- Real-time execution updates

**4. Analytics Dashboard** (2-3 days)
- Historical trend analysis
- Pass rate tracking
- Performance metrics

---

**Deployment Guide Version**: 1.0
**Last Updated**: 2025-10-19
**Status**: ✅ Production Ready

