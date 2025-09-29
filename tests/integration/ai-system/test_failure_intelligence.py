import asyncio
import json
import aiohttp

async def test_failure_intelligence_api():
    """Test the new failure intelligence API endpoint"""
    
    try:
        async with aiohttp.ClientSession() as session:
            # Test the failure intelligence endpoint
            print("Testing failure intelligence API...")
            
            url = "http://localhost:8081/api/analytics/failure-intelligence"
            
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    print("SUCCESS: Failure intelligence API working")
                    print(f"Response keys: {list(data.keys())}")
                    
                    # Check expected structure
                    expected_keys = ['failureGroups', 'blockingFailures', 'timeline', 'patterns', 'generatedAt']
                    missing_keys = [key for key in expected_keys if key not in data]
                    
                    if missing_keys:
                        print(f"WARNING: Missing expected keys: {missing_keys}")
                    else:
                        print("SUCCESS: All expected keys present")
                    
                    # Print sample data
                    print(f"Failure groups count: {len(data.get('failureGroups', []))}")
                    print(f"Blocking failures count: {len(data.get('blockingFailures', []))}")
                    print(f"Timeline entries: {len(data.get('timeline', []))}")
                    print(f"Pattern types: {list(data.get('patterns', {}).keys())}")
                    
                    # Pretty print a sample for debugging
                    print("\nSample failure intelligence data:")
                    print(json.dumps(data, indent=2, default=str)[:1000] + "...")
                    
                else:
                    print(f"FAILED: API returned status {response.status}")
                    error_text = await response.text()
                    print(f"Error response: {error_text}")
                    
    except Exception as e:
        print(f"ERROR: Failed to test API - {e}")

async def main():
    print("=== Testing Failure Intelligence Features ===")
    await test_failure_intelligence_api()
    print("=== Test Complete ===")

if __name__ == "__main__":
    asyncio.run(main())