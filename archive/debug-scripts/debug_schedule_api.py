"""
Debug schedule creation API to see validation errors
"""
import requests
import json
from datetime import datetime, timedelta

def debug_schedule_api():
    print("DEBUGGING SCHEDULE CREATION API")
    print("=" * 40)
    
    # Get auth token first
    print("1. Getting authentication token...")
    auth_response = requests.post(
        "http://localhost:8081/api/auth/login",
        json={"email": "admin@demo.com", "password": "demo123"},
        timeout=5
    )
    
    if auth_response.status_code != 200:
        print(f"   AUTH FAILED: {auth_response.status_code}")
        return False
        
    auth_data = auth_response.json()
    token = auth_data['token']
    print("   SUCCESS: Got auth token")
    
    # Test schedule data - minimal valid payload
    future_time = datetime.now() + timedelta(hours=2)
    run_at = future_time.strftime("%Y-%m-%dT%H:%M:%S.%fZ")  # Full ISO 8601 with timezone
    
    schedule_data = {
        "suite_id": "1",
        "suite_name": "Debug Test Suite",
        "run_at": run_at,
        "timezone": "Asia/Jerusalem"
    }
    
    print(f"2. Testing schedule creation with data:")
    print(f"   {json.dumps(schedule_data, indent=2)}")
    
    try:
        response = requests.post(
            "http://localhost:8081/api/schedules",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}"
            },
            json=schedule_data,
            timeout=10
        )
        
        print(f"3. Response Status: {response.status_code}")
        print(f"   Response Headers: {dict(response.headers)}")
        
        try:
            response_data = response.json()
            print(f"   Response Body:")
            print(f"   {json.dumps(response_data, indent=2)}")
        except:
            print(f"   Raw Response: {response.text}")
            
        return response.status_code in [200, 201]
        
    except Exception as e:
        print(f"   ERROR: {e}")
        return False

if __name__ == "__main__":
    debug_schedule_api()