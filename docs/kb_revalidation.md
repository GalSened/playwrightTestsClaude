# Knowledge Base Revalidation Runbook

**QA Intelligence Platform - Knowledge Base Health Check & Validation Protocol**

*Version: 2.0.0 | Last Updated: 2025-09-15 | Owner: Senior Maintainer*

---

## 🎯 Overview

This runbook provides a systematic approach to validate the Knowledge Base after implementing critical fixes for:
- ✅ Document chunking with token optimization
- ✅ Bilingual Hebrew/English content generation
- ✅ Standardized vector storage architecture
- ✅ Enhanced language detection accuracy

The validation process ensures the system is **READY_TO_INGEST** additional knowledge before proceeding with production deployment.

---

## 📋 Prerequisites

### System Requirements
- Node.js 18+ with TypeScript support
- OpenAI API key configured (`OPENAI_API_KEY`)
- Backend service running on port 8082
- Frontend service running on port 3001
- Sufficient disk space (2GB+) for vector storage

### Environment Setup
```bash
# Verify environment
node --version          # Should be 18+
npm --version          # Should be 8+
ts-node --version      # Should be available

# Check OpenAI configuration
echo $OPENAI_API_KEY   # Should not be empty or placeholder

# Verify services are running
curl http://localhost:8082/health
curl http://localhost:3001
```

### Test Data Preparation
Ensure the following files are available:
- `PRODUCT_REQUIREMENTS_DOCUMENT.md` (PRD)
- `backend/data/scheduler.db` (existing data)
- Test documents in supported formats (PDF, MD, TXT)

---

## 🔍 Validation Steps

### Step 1: Infrastructure Health Check

**Objective**: Verify all components are operational before testing

```bash
# 1.1 Check backend service health
curl -X GET http://localhost:8082/health
# Expected: {"status": "healthy", "timestamp": "..."}

# 1.2 Check AI configuration
curl -X GET http://localhost:8082/api/ai/health
# Expected: All components showing as healthy or warning (not error)

# 1.3 Check database connectivity
curl -X GET http://localhost:8082/api/schedules
# Expected: Valid JSON response (empty array is fine)

# 1.4 Verify vector store initialization
curl -X GET http://localhost:8082/api/ai/stats
# Expected: Vector store statistics
```

**Expected Output**:
```json
{
  "vectorStore": {
    "status": "initialized",
    "namespace": "qa-intel",
    "type": "local",
    "vectorCount": 0
  },
  "embeddings": {
    "model": "text-embedding-3-large",
    "dimensions": 1536
  }
}
```

**Pass Criteria**: ✅ All health checks return 200 status with valid responses

---

### Step 2: Unit Test Validation

**Objective**: Verify core functionality through automated tests

```bash
# 2.1 Run chunking tests
cd backend
npm test -- --testPathPattern=chunking.spec.ts
# Expected: All tests pass (0 failures)

# 2.2 Run language detection tests
npm test -- --testPathPattern=languageDetection.spec.ts
# Expected: All tests pass (0 failures)

# 2.3 Run integration tests (if available)
npm test -- --testPathPattern=integration
# Expected: All integration tests pass
```

**Expected Output**:
```
✓ Document Chunking (15 tests passed)
✓ Language Detection (20 tests passed)
✓ Vector Storage (8 tests passed)

Test Suites: 3 passed, 3 total
Tests: 43 passed, 43 total
```

**Pass Criteria**: ✅ Zero test failures, all core functionality validated

---

### Step 3: Vector Migration Validation

**Objective**: Migrate existing data and validate standardized storage

```bash
# 3.1 Run vector migration (dry run first)
cd scripts
ts-node migrate_vectors.ts --dry-run
# Expected: Migration plan without errors

# 3.2 Execute actual migration
ts-node migrate_vectors.ts --regenerate-embeddings
# Expected: Successful migration with statistics

# 3.3 Validate migration results
curl -X GET http://localhost:8082/api/ai/stats
# Expected: Non-zero vector count with proper namespace
```

**Expected Output**:
```
🚀 Starting Vector Migration
✅ Migration completed successfully!

📊 Migration Report:
Migration completed in 45s
Success rate: 100% (127/127)
Errors: 0
Validation: 4/4 queries successful
```

**Pass Criteria**: ✅ 100% migration success rate, 4/4 validation queries successful

---

### Step 4: PRD Processing Validation

**Objective**: Test enhanced chunking with large document processing

```bash
# 4.1 Process PRD document with new chunking
curl -X POST http://localhost:8082/api/ai/integrate-prd \
  -H "Content-Type: application/json" \
  -d '{
    "prdFilePath": "./PRODUCT_REQUIREMENTS_DOCUMENT.md",
    "options": {
      "generateHebrew": true,
      "chunkingEnabled": true,
      "validateContent": true
    }
  }'

# 4.2 Verify processing results
curl -X GET http://localhost:8082/api/knowledge/stats
# Expected: Knowledge base populated with PRD chunks
```

**Expected Output**:
```json
{
  "success": true,
  "summary": {
    "totalChunks": 89,
    "languages": ["en", "he"],
    "sections": 8,
    "processingTime": "12.3s"
  },
  "chunkingStats": {
    "avgChunkSize": 950,
    "maxChunkSize": 1000,
    "overlapSize": 200
  }
}
```

**Pass Criteria**: ✅ PRD processed without token limit errors, bilingual content generated

---

### Step 5: Language Detection Accuracy Test

**Objective**: Validate enhanced language detection with real queries

```bash
# 5.1 Test English query accuracy
curl -X POST http://localhost:8082/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I add a new contact in WeSign?"}'

# 5.2 Test Hebrew query accuracy
curl -X POST http://localhost:8082/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "איך אני מוסיף איש קשר חדש ב-WeSign?"}'

# 5.3 Test mixed language query
curl -X POST http://localhost:8082/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "איך אני משתמש ב-WeSign API?"}'
```

**Expected Output Validation**:

**English Query**:
```json
{
  "response": "To add a new contact in WeSign:\n1. Log into your WeSign account...",
  "confidence": 0.95,
  "language": "english",
  "sources": 2,
  "executionTime": 3200
}
```

**Hebrew Query**:
```json
{
  "response": "להוספת איש קשר חדש ב-WeSign:\n1. היכנס למערכת WeSign...",
  "confidence": 0.88,
  "language": "hebrew",
  "sources": 2,
  "executionTime": 2800
}
```

**Pass Criteria**:
- ✅ English queries: 90%+ confidence, detailed responses
- ✅ Hebrew queries: 80%+ confidence, Hebrew responses
- ✅ Mixed queries: Appropriate language detection

---

### Step 6: Bilingual Knowledge Validation

**Objective**: Test bilingual content quality and keyword mapping

#### Test Query Set (Execute all 12 queries):

```bash
# English Technical Queries
curl -X POST http://localhost:8082/api/ai/chat -H "Content-Type: application/json" -d '{"message": "What browsers are supported for testing?"}'
curl -X POST http://localhost:8082/api/ai/chat -H "Content-Type: application/json" -d '{"message": "How do I schedule automated test runs?"}'
curl -X POST http://localhost:8082/api/ai/chat -H "Content-Type: application/json" -d '{"message": "How do I debug a failing test?"}'

# Hebrew Functional Queries
curl -X POST http://localhost:8082/api/ai/chat -H "Content-Type: application/json" -d '{"message": "כיצד להעלות מסמך למערכת?"}'
curl -X POST http://localhost:8082/api/ai/chat -H "Content-Type: application/json" -d '{"message": "איך לבדוק את התוצאות?"}'
curl -X POST http://localhost:8082/api/ai/chat -H "Content-Type: application/json" -d '{"message": "מה המשמעות של AI Assistant?"}'

# Cross-Language Mapping Tests
curl -X POST http://localhost:8082/api/ai/chat -H "Content-Type: application/json" -d '{"message": "How do I access test reports?"}'
curl -X POST http://localhost:8082/api/ai/chat -H "Content-Type: application/json" -d '{"message": "What is the difference between smoke and regression tests?"}'
curl -X POST http://localhost:8082/api/ai/chat -H "Content-Type: application/json" -d '{"message": "Can I run tests in parallel?"}'

# Mixed Language Technical Queries
curl -X POST http://localhost:8082/api/ai/chat -H "Content-Type: application/json" -d '{"message": "איך אני משתמש ב-WeSign API?"}'
curl -X POST http://localhost:8082/api/ai/chat -H "Content-Type: application/json" -d '{"message": "מה זה WeSign?"}'
curl -X POST http://localhost:8082/api/ai/chat -H "Content-Type: application/json" -d '{"message": "כיצד להגדיר automated testing?"}'
```

**Validation Scorecard Template**:

| Query | Language | Expected Confidence | Actual Confidence | Pass/Fail | Notes |
|-------|----------|-------------------|------------------|-----------|-------|
| "How do I add contact?" | English | 0.90+ | ___ | ___/❌ | |
| "איך אני מוסיף איש קשר?" | Hebrew | 0.80+ | ___ | ___/❌ | |
| ... | ... | ... | ___ | ___/❌ | |

**Pass Criteria**:
- ✅ English Accuracy: 100% (6/6 correct)
- ✅ Hebrew Accuracy: 80%+ (5/6 correct minimum)
- ✅ Overall Accuracy: 85%+ (10/12 correct minimum)
- ✅ Zero hallucinations detected

---

### Step 7: Performance & Load Validation

**Objective**: Ensure system performs under realistic load

```bash
# 7.1 Concurrent query test
for i in {1..10}; do
  curl -X POST http://localhost:8082/api/ai/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "Performance test query '$i'"}' &
done
wait

# 7.2 Large document processing test
curl -X POST http://localhost:8082/api/knowledge/upload \
  -F "files=@large_test_document.pdf" \
  -F "category=performance_test"

# 7.3 Memory and resource check
curl -X GET http://localhost:8082/api/ai/stats
ps aux | grep node
```

**Expected Performance Metrics**:
- Response time: < 5 seconds average
- Memory usage: < 1GB per service
- Concurrent requests: 10+ without errors
- Vector search: < 2 seconds

**Pass Criteria**: ✅ All performance thresholds met, no memory leaks detected

---

### Step 8: Vector Storage Consistency Validation

**Objective**: Verify standardized vector storage integrity

```bash
# 8.1 Check vector store statistics
curl -X GET http://localhost:8082/api/ai/stats

# 8.2 Test vector search functionality
curl -X POST http://localhost:8082/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{"query": "contact management", "limit": 5}'

# 8.3 Validate namespace isolation
curl -X GET http://localhost:8082/api/knowledge/stats
```

**Expected Output**:
```json
{
  "vectorStore": {
    "namespace": "qa-intel",
    "totalVectors": 127,
    "languages": {
      "en": 64,
      "he": 63
    },
    "lastUpdated": "2025-09-15T10:30:00Z"
  },
  "searchPerformance": {
    "avgResponseTime": 1.2,
    "cacheHitRate": 0.65
  }
}
```

**Pass Criteria**: ✅ Single namespace, balanced language distribution, fast search

---

## 🎯 Final Readiness Gate

### Readiness Criteria Checklist

To gate the system as **READY_TO_INGEST**, ALL criteria must pass:

#### ✅ **CRITICAL FIXES VALIDATION**
- [ ] Document chunking works without token overflow
- [ ] Hebrew content generation achieves 80%+ accuracy
- [ ] Standardized vector storage operational
- [ ] Language detection accuracy >85% overall

#### ✅ **FUNCTIONAL VALIDATION**
- [ ] PRD processing completes without errors
- [ ] Bilingual keyword mappings functional
- [ ] Vector migration successful (100% success rate)
- [ ] Unit tests pass (0 failures)

#### ✅ **PERFORMANCE VALIDATION**
- [ ] Response times <5 seconds average
- [ ] Concurrent requests handled (10+)
- [ ] Memory usage within limits (<1GB per service)
- [ ] Vector search performance <2 seconds

#### ✅ **QUALITY VALIDATION**
- [ ] Zero hallucinations detected
- [ ] Confidence scores within expected ranges
- [ ] Bilingual content quality validated
- [ ] Knowledge base consistency verified

---

## 🚀 Final Validation Command

Run the comprehensive validation suite:

```bash
#!/bin/bash
# final_validation.sh

echo "🚀 Starting Final KB Validation..."

# Infrastructure checks
curl -s http://localhost:8082/health | jq '.status' || exit 1

# Run all tests
npm test || exit 1

# Migration validation
ts-node scripts/migrate_vectors.ts --dry-run || exit 1

# Query accuracy validation
python3 scripts/validate_query_accuracy.py || exit 1

# Performance validation
node scripts/performance_validation.js || exit 1

echo "✅ All validations passed - System READY_TO_INGEST"
```

**Expected Final Output**:
```
🚀 Starting Final KB Validation...
✅ Infrastructure Health: PASS
✅ Unit Tests: PASS (43/43)
✅ Migration: PASS (100% success)
✅ Query Accuracy: PASS (85%+)
✅ Performance: PASS (all thresholds met)
✅ Bilingual Support: PASS
✅ Vector Storage: PASS

🎉 FINAL RESULT: READY_TO_INGEST = TRUE

System approved for additional knowledge ingestion.
```

---

## 🔧 Troubleshooting Guide

### Common Issues & Solutions

#### **Issue**: Token limit errors during PRD processing
**Solution**:
```bash
# Check chunking configuration
curl -X GET http://localhost:8082/api/ai/config
# Verify chunkSizeTokens <= 1000 and overlapTokens <= 200
```

#### **Issue**: Hebrew responses have low confidence
**Solution**:
```bash
# Check Hebrew keyword mappings
curl -X GET http://localhost:8082/api/ai/mappings
# Verify bilingual keyword pairs are loaded
```

#### **Issue**: Vector search returns no results
**Solution**:
```bash
# Check vector store health
curl -X GET http://localhost:8082/api/knowledge/stats
# Verify vectors are properly indexed
```

#### **Issue**: High response times
**Solution**:
```bash
# Check cache configuration
curl -X GET http://localhost:8082/api/ai/cache-stats
# Clear cache if hit rate is low
curl -X POST http://localhost:8082/api/ai/clear-cache
```

---

## 📊 Success Metrics Summary

### Target Metrics (All Must Pass)
- **Hebrew Query Accuracy**: ≥80% (up from 8%)
- **English Query Accuracy**: ≥95% (maintain 100%)
- **Overall System Accuracy**: ≥85%
- **PRD Processing**: Zero token limit errors
- **Response Time**: <5 seconds average
- **Vector Migration**: 100% success rate
- **Memory Usage**: <1GB per service
- **Hallucination Rate**: 0%

### Post-Validation Actions

#### If ALL criteria pass ✅:
1. Set `READY_TO_INGEST = TRUE`
2. Document validation results
3. Proceed with additional knowledge ingestion
4. Schedule regular health monitoring

#### If ANY criteria fail ❌:
1. Set `READY_TO_INGEST = FALSE`
2. Document specific failures
3. Implement fixes for failing criteria
4. Re-run validation from Step 1

---

**Document Control**
- Version: 2.0.0
- Last Updated: 2025-09-15
- Next Review: 2025-10-15
- Owner: Senior Maintainer
- Approver: QA Intelligence Team Lead