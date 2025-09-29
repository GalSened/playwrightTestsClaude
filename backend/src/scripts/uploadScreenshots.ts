import { KnowledgeIngestionService } from '../services/ai/knowledgeIngestionService';
import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

async function uploadKeyScreenshots() {
  console.log('📸 Uploading key WeSign screenshots to knowledge base...\n');
  
  const service = new KnowledgeIngestionService();
  
  // Key screenshots to upload
  const keyScreenshots = [
    // Login UI screenshots
    '../artifacts/screenshots/login_page_layout.png',
    '../artifacts/screenshots/login_form_desktop_view.png',
    '../artifacts/screenshots/hebrew_error_state.png',
    
    // Dashboard screenshots  
    '../dashboard_load_failure.png',
    '../navigation_failure.png',
    '../activity_feed_failure.png',
    '../dashboard_initial_state.png',
    '../dashboard_final_state.png',
    
    // Debug screenshots
    '../artifacts/screenshots/navigation_debug.png',
    '../artifacts/screenshots/contacts_page_debug.png',
    '../artifacts/screenshots/contacts_debug.png',
    '../artifacts/screenshots/login_page_debug.png',
    
    // Test Bank screenshots (showing test management UI)
    '../artifacts/screenshots/testbank_01_initial_load_20250827_105615.png',
    '../artifacts/screenshots/testbank_03_tests_selected_20250827_105628.png',
    '../artifacts/screenshots/testbank_05_table_functionality_20250827_105651.png',
    
    // Reports screenshots
    '../artifacts/screenshots/reports_01_initial_load_20250827_135033.png',
    '../artifacts/screenshots/reports_02_details_opened_20250827_135033.png',
    '../artifacts/screenshots/reports_05_results_bars_20250827_135033.png'
  ];
  
  let successCount = 0;
  let totalChunks = 0;
  
  for (const screenshotPath of keyScreenshots) {
    const fullPath = join(process.cwd(), screenshotPath);
    
    try {
      // Check if file exists
      const stat = statSync(fullPath);
      console.log(`📷 Processing: ${screenshotPath.split('/').pop()} (${Math.round(stat.size/1024)}KB)`);
      
      const result = await service.ingestFile(fullPath, 'wesign-screenshots');
      
      if (result.success) {
        console.log(`  ✅ Success: ${result.chunks} chunks created`);
        successCount++;
        totalChunks += result.chunks;
      } else {
        console.log(`  ❌ Failed: ${result.error}`);
      }
      
    } catch (error: any) {
      console.log(`  ⚠️  Skipped: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Upload Summary:`);
  console.log(`  Screenshots processed: ${successCount}/${keyScreenshots.length}`);
  console.log(`  Total chunks created: ${totalChunks}`);
  console.log(`  Category: wesign-screenshots`);
  
  // Test search for screenshot data
  console.log('\n🔍 Testing screenshot search...');
  const searchResults = await service.searchKnowledge('login page layout dashboard', 3);
  console.log(`  Found ${searchResults.length} relevant results`);
  
  service.close();
}

if (require.main === module) {
  uploadKeyScreenshots().catch(console.error);
}

export { uploadKeyScreenshots };