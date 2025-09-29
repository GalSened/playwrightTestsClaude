import { config } from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';

// Load environment variables
config();

async function test() {
  console.log('🧪 Testing LangChain integration...\n');
  
  try {
    // Test OpenAI configuration
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('placeholder')) {
      console.log('❌ OpenAI API key not configured');
      return;
    }
    
    console.log('✅ OpenAI API key configured');
    
    // Initialize LangChain ChatOpenAI model
    const model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o',
      temperature: 0.1, // Maximum accuracy
    });
    
    console.log('🔗 LangChain model initialized');
    
    // Test basic chat
    console.log('💬 Testing chat functionality...');
    const response = await model.invoke('What is WeSign?');
    
    console.log('\n🎯 LangChain Response:');
    console.log('─'.repeat(50));
    console.log(response.content);
    console.log('─'.repeat(50));
    
    // Test with system message
    console.log('\n🧠 Testing with system context...');
    const systemResponse = await model.invoke([
      {
        role: 'system',
        content: 'You are an expert on the WeSign document signing platform. WeSign is like DocuSign - it allows users to upload documents, create digital signatures, and manage signing workflows.'
      },
      {
        role: 'user', 
        content: 'What are the main features of WeSign?'
      }
    ]);
    
    console.log('\n🎯 LangChain System Response:');
    console.log('─'.repeat(50));
    console.log(systemResponse.content);
    console.log('─'.repeat(50));
    
    console.log('\n✅ LangChain is working correctly!');
    console.log('🚀 Ready for document processing and RAG implementation');
    
  } catch (error) {
    console.error('❌ LangChain test failed:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check OpenAI API key in .env file');
    console.error('2. Ensure internet connection is available');
    console.error('3. Verify API quota and billing status');
  }
}

if (require.main === module) {
  test();
}