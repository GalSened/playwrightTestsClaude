# 📚 Add Your Documents Here

Welcome to the WeSign AI Knowledge Base document ingestion system! This folder is where you can add your project documentation to enhance the AI Assistant's knowledge.

## 📋 Required Documents

### 1. **PRD (Product Requirements Document)**
- **Location:** `docs/prd/wesign-prd.md` (preferred) 
- **Alternative locations:** 
  - `docs/prd/wesign-prd.txt`
  - `docs/prd/prd.md`
  - `docs/prd/requirements.md`
- **Format:** Markdown (.md) or Text (.txt)
- **Contents:** Your complete WeSign product requirements, features, user stories, acceptance criteria

### 2. **API Collection**
- **Location:** `docs/api/` folder
- **Supported formats:**
  - `postman-collection.json` (Postman export)
  - `swagger.json` or `openapi.yaml` (OpenAPI spec)
  - Any `.json`, `.yaml`, or `.yml` file
- **Contents:** Your WeSign API endpoints, authentication, request/response schemas

### 3. **Test Patterns (Optional)**
- **Location:** `docs/test-patterns/` folder
- **Format:** Markdown (.md) files
- **Contents:** Custom test patterns, reusable test components, specific WeSign test scenarios

## 🚀 How to Add Your Documents

### Step 1: Add PRD
```bash
# Copy your PRD document to the correct location
cp /path/to/your-prd.md docs/prd/wesign-prd.md

# Or if you have a Word/PDF document, convert it to text/markdown first
# Then save it as docs/prd/wesign-prd.md
```

### Step 2: Add API Collection  
```bash
# For Postman users:
# 1. Open Postman
# 2. Click on your collection → Export → Collection v2.1
# 3. Save as docs/api/wesign-postman-collection.json

# For Swagger/OpenAPI users:
cp /path/to/swagger.json docs/api/wesign-api-spec.json
# or 
cp /path/to/openapi.yaml docs/api/wesign-api-spec.yaml
```

### Step 3: Run Ingestion
```bash
cd backend
npm run ingest:docs
```

## 📊 What Gets Ingested

The ingestion script automatically processes:

✅ **Your PRD** - Product requirements and features  
✅ **API Documentation** - Endpoints and schemas  
✅ **Existing Docs** - All .md files in the docs/ folder  
✅ **Test Database** - All 311+ existing test cases  
✅ **Test Patterns** - Common testing patterns and examples  

## 🎯 Expected Output

When you run `npm run ingest:docs`, you should see:

```
🚀 Starting comprehensive document ingestion...

📋 Checking for PRD document...
   ✅ Found PRD: /path/to/docs/prd/wesign-prd.md
   📄 PRD length: 15,423 characters

🔌 Checking for API documentation...  
   ✅ Found API file: wesign-postman-collection.json

📚 Ingesting existing documentation...
   📄 Ingested 8 existing documentation files

🧪 Ingesting existing tests...
   ✅ Added 311 test cases from database

🎯 Adding test patterns...
   ✅ Added 2 default test patterns

==================================================
📊 INGESTION SUMMARY  
==================================================
📋 PRD Documents: 1
🔌 API Documentation: 1  
📚 Existing Docs: 8
🧪 Test Cases: 311
🎯 Test Patterns: 2
──────────────────────────────────
✅ Total Documents Ingested: 323
```

## ⚠️ Prerequisites

Before running ingestion, ensure:

1. **OpenAI API Key** configured in `backend/.env`
2. **Pinecone API Key** configured in `backend/.env` (optional but recommended)
3. **Backend server** running: `cd backend && npm run dev`

## 🔍 Verify Integration

After ingestion, test the AI Assistant:

1. Go to `http://localhost:3000/ai-assistant`
2. Try asking: "What are the main features of WeSign?"
3. Try asking: "Show me the API endpoints for user management"
4. Try asking: "Generate a test for document upload"

## 📁 Current Structure

```
docs/
├── README.md (this file)
├── prd/                    # Your PRD goes here
│   └── wesign-prd.md      # ← Add your PRD here
├── api/                    # Your API docs go here  
│   └── postman-collection.json # ← Add your API collection here
├── test-patterns/          # Custom test patterns (optional)
└── [existing-docs...]      # Auto-ingested
```

## 💡 Tips

- **Large documents** are automatically chunked for optimal AI processing
- **Markdown format** is preferred for better parsing
- **API collections** are formatted for better readability
- **Test cases** from your database are automatically included
- Run ingestion again anytime to update the knowledge base

## 🆘 Troubleshooting

**Issue:** "No PRD found"
- **Solution:** Ensure file is at `docs/prd/wesign-prd.md` or alternative locations

**Issue:** "OpenAI API key not configured"  
- **Solution:** Add `OPENAI_API_KEY=your-key-here` to `backend/.env`

**Issue:** "Pinecone not configured"
- **Solution:** Add `PINECONE_API_KEY=your-key-here` to `backend/.env`

---

Ready to enhance your AI Assistant? Add your documents and run the ingestion! 🚀