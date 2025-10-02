"""
Test schedule creation API to verify timezone fix
"""
import requests
import json
from datetime import datetime, timedelta

def test_schedule_api():
    print("TESTING SCHEDULE CREATION API")
    print("=" * 35)
    
    # First get auth token
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
    if not auth_data.get('success') or not auth_data.get('token'):
        print(f"   AUTH FAILED: No token received")
        return False
        
    token = auth_data['token']
    print("   SUCCESS: Got auth token")
    
    # Test schedule data  
    future_time = datetime.now() + timedelta(hours=2)
    run_at = future_time.strftime("%Y-%m-%dT%H:%M:00")
    
    schedule_data = {
        "suite_id": "1",
        "suite_name": "API Test Suite",
        "run_at": run_at,
        "timezone": "Asia/Jerusalem",
        "notes": "Created via API test",
        "priority": 5
    }
    
    try:
        print(f"2. Creating schedule for: {run_at}")
        print(f"   Timezone: Asia/Jerusalem")
        
        response = requests.post(
            "http://localhost:8081/api/schedules",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}"
            },
            json=schedule_data,
            timeout=10
        )
        
        print(f"   Response Status: {response.status_code}")
        
        if response.status_code == 200 or response.status_code == 201:
            result = response.json()
            print("   SUCCESS: Schedule created!")
            print(f"   Schedule ID: {result.get('id', 'N/A')}")
            print(f"   Name: {result.get('name', 'N/A')}")
            print(f"   Scheduled Time: {result.get('scheduled_time', 'N/A')}")
            return True
            
        else:
            print(f"   FAILED: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('message', 'Unknown error')}")
                if 'stack' in error_data:
                    print(f"   Details: {error_data.get('error', 'No details')}")
            except:
                print(f"   Raw response: {response.text[:200]}...")
            return False
            
    except requests.exceptions.ConnectionError:
        print("   ERROR: Could not connect to backend server")
        print("   Make sure backend is running on port 8081")
        return False
    except Exception as e:
        print(f"   ERROR: {e}")
        return False

def test_get_schedules():
    print("\n3. Testing schedule retrieval...")
    
    # Get auth token first
    auth_response = requests.post(
        "http://localhost:8081/api/auth/login",
        json={"email": "admin@demo.com", "password": "demo123"},
        timeout=5
    )
    
    if auth_response.status_code != 200:
        print(f"   AUTH FAILED: {auth_response.status_code}")
        return False
    
    token = auth_response.json().get('token')
    if not token:
        print("   AUTH FAILED: No token")
        return False
        
    try:
        response = requests.get(
            "http://localhost:8081/api/schedules",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            response_data = response.json()
            schedules = response_data.get('schedules', [])
            print(f"   Found {len(schedules)} schedules")
            for i, schedule in enumerate(schedules[:3]):  # Show first 3
                print(f"   [{i+1}] {schedule.get('suite_name', 'Unnamed')} - {schedule.get('run_at_local', 'No time')}")
            return True
        else:
            print(f"   Failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ERROR: {e}")
        return False

if __name__ == "__main__":
    created = test_schedule_api()
    retrieved = test_get_schedules()
    
    print(f"\nAPI Test Results:")
    print(f"Schedule Creation: {'PASS' if created else 'FAIL'}")
    print(f"Schedule Retrieval: {'PASS' if retrieved else 'FAIL'}")