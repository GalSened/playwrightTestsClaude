import { ChatOpenAI } from '@langchain/openai';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testAIConnection() {
  console.log('Testing AI connection...');
  
  // Test OpenAI
  try {
    const model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o',
      temperature: 0.1
    });
    
    const response = await model.invoke('What is 2+2?');
    console.log('✅ OpenAI works:', response.content);
  } catch (error: any) {
    console.log('❌ OpenAI failed:', error.message);
  }
  
  // Test knowledge base
  try {
    const db = new Database('data/scheduler.db');
    const knowledge = db.prepare('SELECT source, COUNT(*) as count FROM knowledge_base GROUP BY source LIMIT 5').all();
    console.log('Knowledge base sources:', knowledge);
    db.close();
  } catch (error: any) {
    console.log('❌ Knowledge base access failed:', error.message);
  }
}

testAIConnection().catch(console.error);