"""
Test the AI system setup and functionality
"""
import requests
import json

def test_ai_connections():
    print("TESTING AI SYSTEM SETUP")
    print("=" * 30)
    
    print("1. Testing AI connections endpoint...")
    try:
        response = requests.post(
            "http://localhost:8081/api/ai/test",
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Success: {data.get('success', False)}")
            print(f"   OpenAI: {data.get('openai', False)}")
            print(f"   Pinecone: {data.get('pinecone', False)}")
            print(f"   Status: {data.get('status', 'unknown')}")
            
            if data.get('messages'):
                print(f"   OpenAI Message: {data['messages'].get('openai', 'N/A')}")
                print(f"   Pinecone Message: {data['messages'].get('pinecone', 'N/A')}")
                
            return data
        else:
            print(f"   Failed: {response.text}")
            return None
            
    except Exception as e:
        print(f"   Error: {e}")
        return None

def test_ai_stats():
    print("\n2. Testing AI stats endpoint...")
    try:
        response = requests.get(
            "http://localhost:8081/api/ai/stats",
            timeout=5
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Success: {data.get('success', False)}")
            
            if data.get('stats', {}).get('configured'):
                config = data['stats']['configured']
                print(f"   OpenAI Configured: {config.get('openai', False)}")
                print(f"   Pinecone Configured: {config.get('pinecone', False)}")
                
            return data
        else:
            print(f"   Failed: {response.text}")
            return None
            
    except Exception as e:
        print(f"   Error: {e}")
        return None

def test_document_ingestion():
    print("\n3. Testing document ingestion...")
    try:
        test_doc = """
        WeSign Test Management System Features:
        
        1. Test Scheduling
        - Schedule tests to run at specific times
        - Support for timezone conversion
        - Recurring schedule patterns
        
        2. Test Execution
        - Run individual tests or test suites
        - Support for headed and headless modes
        - Real-time execution monitoring
        
        3. Reporting
        - Detailed test execution reports
        - Historical test run data
        - Performance analytics
        """
        
        response = requests.post(
            "http://localhost:8081/api/ai/ingest",
            headers={"Content-Type": "application/json"},
            json={
                "content": test_doc,
                "metadata": {
                    "source": "system-test",
                    "type": "documentation",
                    "title": "WeSign Test Management Features"
                }
            },
            timeout=30
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Success: {data.get('success', False)}")
            print(f"   Chunks: {data.get('chunks', 0)}")
            print(f"   Vectors: {data.get('vectors', 0)}")
            print(f"   Message: {data.get('message', 'N/A')}")
            
            return data
        else:
            print(f"   Failed: {response.text}")
            return None
            
    except Exception as e:
        print(f"   Error: {e}")
        return None

def test_knowledge_search():
    print("\n4. Testing knowledge search...")
    try:
        response = requests.post(
            "http://localhost:8081/api/ai/search",
            headers={"Content-Type": "application/json"},
            json={
                "query": "How do I schedule a test?",
                "topK": 3
            },
            timeout=15
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Success: {data.get('success', False)}")
            print(f"   Results: {len(data.get('results', []))}")
            
            for i, result in enumerate(data.get('results', [])[:2]):
                print(f"   Result {i+1}:")
                print(f"     Score: {result.get('score', 0):.3f}")
                print(f"     Text: {result.get('text', '')[:100]}...")
                
            return data
        else:
            print(f"   Failed: {response.text}")
            return None
            
    except Exception as e:
        print(f"   Error: {e}")
        return None

def test_ai_chat():
    print("\n5. Testing AI chat with RAG...")
    try:
        response = requests.post(
            "http://localhost:8081/api/ai/chat",
            headers={"Content-Type": "application/json"},
            json={
                "message": "How do I create a test schedule in WeSign?",
                "useRAG": True
            },
            timeout=30
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Success: {data.get('success', False)}")
            print(f"   Context Used: {data.get('contextUsed', False)}")
            print(f"   Context Length: {data.get('contextLength', 0)}")
            
            if data.get('usage'):
                usage = data['usage']
                print(f"   Tokens: {usage.get('total_tokens', 0)}")
                
            if data.get('response'):
                response_text = data['response'][:300] + "..." if len(data['response']) > 300 else data['response']
                print(f"   AI Response: {response_text}")
                
            return data
        else:
            print(f"   Failed: {response.text}")
            return None
            
    except Exception as e:
        print(f"   Error: {e}")
        return None

if __name__ == "__main__":
    print("Starting AI System Tests")
    print("Note: API keys must be configured in backend/.env for full functionality")
    print()
    
    # Run all tests
    connections = test_ai_connections()
    stats = test_ai_stats()
    ingestion = test_document_ingestion()
    search = test_knowledge_search()
    chat = test_ai_chat()
    
    # Summary
    print("\n" + "="*50)
    print("AI SYSTEM TEST SUMMARY")
    print("="*50)
    
    tests = [
        ("Connection Test", connections is not None),
        ("Stats Endpoint", stats is not None),
        ("Document Ingestion", ingestion is not None and ingestion.get('success')),
        ("Knowledge Search", search is not None and search.get('success')),
        ("AI Chat", chat is not None and chat.get('success'))
    ]
    
    for test_name, passed in tests:
        status = "PASS" if passed else "FAIL"
        print(f"{test_name:20} - {status}")
    
    total_passed = sum(1 for _, passed in tests if passed)
    print(f"\nOverall: {total_passed}/{len(tests)} tests passed")
    
    if connections:
        print(f"\nConfiguration Status:")
        if connections.get('messages'):
            print(f"- OpenAI: {'Configured' if connections.get('openai') else 'Not configured'}")
            print(f"- Pinecone: {'Configured' if connections.get('pinecone') else 'Not configured'}")
        
    print(f"\nAI Testing Assistant foundation is {'ready' if total_passed >= 3 else 'needs configuration'}!")