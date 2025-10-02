"""
Test API response directly to debug the login issue
"""
import asyncio
import aiohttp
import json

async def test_api_response():
    print("Testing API Response Format")
    print("=" * 40)
    
    async with aiohttp.ClientSession() as session:
        # Test login API
        login_data = {
            "email": "test@example.com",
            "password": "password123"
        }
        
        print("Making login request...")
        async with session.post('http://localhost:8081/api/auth/login', json=login_data) as resp:
            print(f"Status: {resp.status}")
            response_text = await resp.text()
            print(f"Raw response: {response_text}")
            
            try:
                response_json = json.loads(response_text)
                print("Parsed JSON response:")
                print(json.dumps(response_json, indent=2))
                
                # Check if the response has the expected structure
                if 'success' in response_json and response_json['success']:
                    print("✓ Success flag present")
                    
                    if 'user' in response_json and 'id' in response_json['user']:
                        print("✓ User object with ID present")
                    else:
                        print("✗ User object or ID missing")
                        
                    if 'tenant' in response_json and 'id' in response_json['tenant']:
                        print("✓ Tenant object with ID present")
                    else:
                        print("✗ Tenant object or ID missing")
                        
                    if 'token' in response_json:
                        print("✓ Token present")
                    else:
                        print("✗ Token missing")
                else:
                    print("✗ Success flag missing or false")
                    
            except json.JSONDecodeError as e:
                print(f"JSON decode error: {e}")

if __name__ == "__main__":
    asyncio.run(test_api_response())