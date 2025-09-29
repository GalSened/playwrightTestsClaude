const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

async function ingestExtractedKnowledge() {
  console.log('🚀 Starting extraction knowledge ingestion...\n');

  const scanPath = path.join(__dirname, '../../../docs/extracted/wesign-scan.json');
  
  if (!fs.existsSync(scanPath)) {
    console.error('❌ No scan data found. Run scanWeSign.js first.');
    return;
  }
  
  const scanData = JSON.parse(fs.readFileSync(scanPath, 'utf-8'));
  const db = new Database(path.join(process.cwd(), 'data/scheduler.db'));
  
  console.log('📊 Scan Data Overview:');
  console.log(`  Timestamp: ${scanData.timestamp}`);
  console.log(`  Pages: ${Object.keys(scanData.pages).length}`);
  console.log(`  APIs: ${scanData.apis.length}`);
  console.log(`  Workflows: ${scanData.workflows.length}\n`);
  
  // Prepare database
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_base_enhanced (
      id TEXT PRIMARY KEY,
      content TEXT,
      type TEXT,
      source TEXT,
      chunk_index INTEGER,
      metadata TEXT,
      embedding BLOB,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO knowledge_base_enhanced 
    (id, content, type, source, metadata) 
    VALUES (?, ?, ?, ?, ?)
  `);
  
  let totalChunks = 0;
  
  // 1. Ingest Authentication Knowledge
  console.log('🔐 Ingesting authentication data...');
  const authContent = `WeSign Authentication System:
  
LOGIN URL: ${scanData.authentication.loginUrl}
CREDENTIALS: admin@demo.com / demo123

Login Form Structure:
- Email field: input[name="email"] with placeholder "Username / Email"
- Password field: input[name="password"] with placeholder "Password" 
- Submit button: input[type="submit"]#loginInput
- Remember me checkbox: input[name="rememberme"]

Form Method: ${scanData.authentication.loginForm.method || 'Not specified'}
Form Action: ${scanData.authentication.loginForm.action || 'Not specified'}

Required Fields: ${scanData.authentication.loginForm.fields.filter(f => f.required).length} of ${scanData.authentication.loginForm.fields.length}

For Playwright tests:
await page.goto('https://devtest.comda.co.il');
await page.fill('input[name="email"]', 'admin@demo.com');
await page.fill('input[name="password"]', 'demo123');
await page.click('input[type="submit"]');`;

  stmt.run('scan-auth', authContent, 'authentication', 'live-scan', 
    JSON.stringify({ scanned: scanData.timestamp, fields: scanData.authentication.loginForm.fields.length }));
  totalChunks++;
  
  // 2. Ingest Page Structure Knowledge
  console.log('📄 Ingesting page structure data...');
  Object.entries(scanData.pages).forEach(([pageName, pageData], index) => {
    const pageContent = `WeSign ${pageName} Page:

URL: ${pageData.url}
Title: ${pageData.title}

UI Elements:
- Forms found: ${pageData.forms.length}
- Buttons found: ${pageData.buttons.length}
- Input fields: ${pageData.inputs.length}
- Tables: ${pageData.tables.length}

${pageData.buttons.length > 0 ? `
Button Details:
${pageData.buttons.map(btn => `  - "${btn.text}" (${btn.type}) ${btn.disabled ? '[DISABLED]' : ''}`).join('\n')}
` : ''}

${pageData.inputs.length > 0 ? `
Input Fields:
${pageData.inputs.map(inp => `  - ${inp.type} field "${inp.name}" ${inp.required ? '[REQUIRED]' : ''}`).join('\n')}
` : ''}

For Playwright Tests:
await page.goto('${pageData.url}');
// Interact with ${pageData.buttons.length} buttons and ${pageData.inputs.length} inputs
`;
    
    stmt.run(`scan-page-${index}`, pageContent, 'page-structure', 'live-scan',
      JSON.stringify({ page: pageName, elements: pageData.buttons.length + pageData.inputs.length }));
    totalChunks++;
  });
  
  // 3. Ingest API Endpoints Knowledge
  console.log('🔌 Ingesting API endpoints...');
  const uniqueApis = [...new Set(scanData.apis.map(api => api.url))];
  const apiContent = `WeSign API Endpoints (Live Scan):

Configuration API:
- Endpoint: GET /userapi/ui/v3/configuration
- Called ${scanData.apis.length} times during page navigation
- Purpose: UI configuration and settings

API Base URL: https://devtest.comda.co.il/userapi

Network Patterns:
- All pages make configuration calls
- RESTful API structure with versioning (v3)
- UI-specific endpoints under /ui/ path

For API Testing:
const response = await page.request.get('https://devtest.comda.co.il/userapi/ui/v3/configuration');
expect(response.status()).toBe(200);

Observed API Calls:
${scanData.apis.slice(0, 5).map((api, i) => `${i+1}. ${api.method} ${api.url} (${api.timestamp})`).join('\n')}`;

  stmt.run('scan-apis', apiContent, 'api-endpoints', 'live-scan',
    JSON.stringify({ endpoints: uniqueApis.length, totalCalls: scanData.apis.length }));
  totalChunks++;
  
  // 4. Ingest Workflow Knowledge
  console.log('🔄 Ingesting workflow data...');
  scanData.workflows.forEach((workflow, index) => {
    const workflowContent = `WeSign ${workflow.name} Workflow:

Workflow Type: ${workflow.name}
Steps Found: ${workflow.steps?.length || 0}
Operations: ${workflow.operations?.length || 0}

${workflow.steps?.length > 0 ? `
Steps Discovered:
${workflow.steps.map(step => `  - ${step.step}: ${step.text || step.selector || 'Element found'}`).join('\n')}
` : ''}

${workflow.operations?.length > 0 ? `
Operations Available:
${workflow.operations.map(op => typeof op === 'string' ? `  - ${op}` : `  - ${op.type}`).join('\n')}
` : ''}

Playwright Test Pattern:
// Navigate to workflow page
await page.goto('https://devtest.comda.co.il/${workflow.name.toLowerCase().replace(' ', '')}');
// Interact with workflow elements
${workflow.name === 'Document Upload' ? 
  `await page.setInputFiles('input[type="file"]', 'test-document.pdf');` :
  `await page.click('button:has-text("Add")');`}
`;
    
    stmt.run(`scan-workflow-${index}`, workflowContent, 'workflow', 'live-scan',
      JSON.stringify({ name: workflow.name, complexity: (workflow.steps?.length || 0) + (workflow.operations?.length || 0) }));
    totalChunks++;
  });
  
  // 5. Ingest System Overview
  console.log('🎯 Creating system overview...');
  const systemContent = `WeSign System Overview (Live Scan ${scanData.timestamp}):

SYSTEM TYPE: Document Signing Platform (like DocuSign)
ENVIRONMENT: https://devtest.comda.co.il
CREDENTIALS: admin@demo.com / demo123

ARCHITECTURE:
- Login URL: ${scanData.authentication.loginUrl}
- Main Pages: ${Object.keys(scanData.pages).length} (Dashboard, Contacts, Documents, Templates, Upload, Profile, Settings)
- API Structure: RESTful with /userapi/ui/v3/ endpoints
- Language Support: English (Hebrew support: ${scanData.hebrew.hasLanguageSwitch})

TESTING INSIGHTS:
✅ Login working with demo credentials
✅ Multi-page navigation available
✅ Form-based interactions (${Object.values(scanData.pages).reduce((sum, p) => sum + p.forms.length, 0)} forms total)
✅ API endpoints discoverable (${scanData.apis.length} calls intercepted)
⚠️ Some pages redirected to login (authentication required)

KEY TEST SCENARIOS:
1. Authentication: Email/password login with validation
2. Navigation: 7 main pages accessible
3. Document Upload: File input workflows
4. Contact Management: CRUD operations
5. API Testing: Configuration and user API calls

PLAYWRIGHT TEST FOUNDATION:
- Use admin@demo.com / demo123 for login
- Expect ${Object.keys(scanData.pages).length} main navigation areas
- API calls to /userapi/ui/v3/configuration on each page
- Form interactions available across all pages

This scan provides real-world structure for comprehensive test coverage.`;

  stmt.run('scan-overview', systemContent, 'system-overview', 'live-scan',
    JSON.stringify({ 
      scanTimestamp: scanData.timestamp,
      totalPages: Object.keys(scanData.pages).length,
      totalApis: scanData.apis.length,
      totalWorkflows: scanData.workflows.length 
    }));
  totalChunks++;
  
  // Final stats
  const stats = db.prepare(`SELECT type, COUNT(*) as count FROM knowledge_base_enhanced WHERE source = ? GROUP BY type`).all('live-scan');
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 EXTRACTED KNOWLEDGE INGESTION COMPLETE');
  console.log('='.repeat(50));
  console.table(stats);
  console.log(`\n✅ Total knowledge chunks: ${totalChunks}`);
  console.log('🎯 Live WeSign system knowledge now available for AI');
  console.log('🧠 Enhanced with real UI structure and workflows');
  console.log('🔍 Ready for accurate test generation and guidance');
  
  db.close();
}

if (require.main === module) {
  ingestExtractedKnowledge().catch(console.error);
}

module.exports = { ingestExtractedKnowledge };