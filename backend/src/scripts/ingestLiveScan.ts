import { KnowledgeIngestionService } from '../services/ai/knowledgeIngestionService';
import { join } from 'path';

async function ingestLiveScan() {
  console.log('🔍 Ingesting live WeSign scan data...');
  
  const service = new KnowledgeIngestionService();
  const scanFile = join(process.cwd(), '..', 'docs', 'extracted', 'wesign-scan.json');
  
  try {
    const result = await service.ingestFile(scanFile, 'live-scan');
    
    console.log('✅ Live scan data ingested successfully!');
    console.log(`   Documents created: ${result.chunks}`);
    console.log(`   Category: live-scan`);
    console.log(`   Source: WeSign system scan`);
    
    // Test search for live scan data
    const searchResults = await service.searchKnowledge('authentication login form fields', 3);
    console.log(`\n🔍 Verification search: ${searchResults.length} results found`);
    
  } catch (error) {
    console.error('❌ Live scan ingestion failed:', error);
  } finally {
    service.close();
  }
}

if (require.main === module) {
  ingestLiveScan().catch(console.error);
}

export { ingestLiveScan };