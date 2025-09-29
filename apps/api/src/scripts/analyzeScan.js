const fs = require('fs');
const path = require('path');

const scanPath = path.join(__dirname, '../../../docs/extracted/wesign-scan.json');
const scan = JSON.parse(fs.readFileSync(scanPath, 'utf-8'));

console.log('📊 WeSign Scan Results Summary:');
console.log('=====================================');
console.log('🔐 Authentication:', scan.authentication.loginUrl);
console.log('📄 Pages Found:', Object.keys(scan.pages).length);
console.log('🌐 API Endpoints:', scan.apis.length);
console.log('🔄 Workflows:', scan.workflows.length);
console.log();
console.log('📋 Pages Scanned:');
Object.entries(scan.pages).forEach(([name, data]) => {
  console.log(`  - ${name}: ${data.url}`);
  console.log(`    Forms: ${data.forms.length}, Buttons: ${data.buttons.length}, Inputs: ${data.inputs.length}`);
});
console.log();
console.log('🔌 API Endpoints Found:');
scan.apis.forEach((api, i) => {
  console.log(`  ${i+1}. ${api.method} ${api.url}`);
});
console.log();
console.log('⚙️ Workflows:');
scan.workflows.forEach(workflow => {
  console.log(`  - ${workflow.name}: ${workflow.steps?.length || workflow.operations?.length || 0} steps/operations`);
});
console.log();
console.log('🔍 Key Findings:');
console.log('- Login uses email/password with "admin@demo.com" / "demo123"');
console.log('- WeSign has', Object.keys(scan.pages).length, 'main pages');
console.log('- Found', scan.apis.length, 'API endpoints');
console.log('- Hebrew support:', scan.hebrew.hasLanguageSwitch ? 'Yes' : 'No');