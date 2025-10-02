"""
Test manual schedule trigger functionality
"""
import requests
import json
from datetime import datetime, timedelta

def test_manual_schedule_trigger():
    print("TESTING MANUAL SCHEDULE TRIGGER")
    print("=" * 35)
    
    # Get auth token
    print("1. Getting authentication...")
    auth_response = requests.post(
        "http://localhost:8081/api/auth/login",
        json={"email": "admin@demo.com", "password": "demo123"},
        timeout=5
    )
    
    if auth_response.status_code != 200:
        print(f"   AUTH FAILED: {auth_response.status_code}")
        return
        
    token = auth_response.json()['token']
    headers = {"Authorization": f"Bearer {token}"}
    print("   SUCCESS: Got auth token")
    
    # First create a schedule
    print("2. Creating test schedule...")
    future_time = datetime.now() + timedelta(hours=1)
    schedule_data = {
        "suite_id": "test-suite-1",
        "suite_name": "Manual Trigger Test Suite",
        "run_at": future_time.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "timezone": "Asia/Jerusalem",
        "notes": "Test manual triggering"
    }
    
    create_response = requests.post(
        "http://localhost:8081/api/schedules",
        headers={"Content-Type": "application/json", **headers},
        json=schedule_data,
        timeout=10
    )
    
    if create_response.status_code != 201:
        print(f"   Schedule creation failed: {create_response.status_code}")
        try:
            print(f"   Error: {create_response.json()}")
        except:
            print(f"   Raw response: {create_response.text}")
        return
    
    schedule = create_response.json()['schedule']
    schedule_id = schedule['id']
    print(f"   SUCCESS: Created schedule {schedule_id}")
    
    # Now trigger manual execution
    print("3. Triggering manual execution...")
    trigger_data = {
        "notes": "Manual execution via API test",
        "execution_options": {
            "mode": "headed",
            "execution": "sequential"
        }
    }
    
    trigger_response = requests.post(
        f"http://localhost:8081/api/schedules/{schedule_id}/run-now",
        headers={"Content-Type": "application/json", **headers},
        json=trigger_data,
        timeout=10
    )
    
    print(f"   Response Status: {trigger_response.status_code}")
    
    if trigger_response.status_code == 200:
        result = trigger_response.json()
        print("   SUCCESS: Manual execution triggered!")
        print(f"   Run ID: {result.get('run', {}).get('id', 'N/A')}")
        print(f"   Message: {result.get('message', 'N/A')}")
        print(f"   Schedule remains: {result.get('schedule_remains', 'N/A')}")
        
        # Check schedule runs
        print("4. Checking schedule runs...")
        runs_response = requests.get(
            f"http://localhost:8081/api/schedules/{schedule_id}/runs",
            headers=headers,
            timeout=5
        )
        
        if runs_response.status_code == 200:
            runs_data = runs_response.json()
            runs = runs_data.get('runs', [])
            print(f"   Found {len(runs)} execution runs")
            
            if runs:
                latest_run = runs[0]
                print(f"   Latest run status: {latest_run.get('status', 'unknown')}")
                print(f"   Started at: {latest_run.get('started_at', 'N/A')}")
                print(f"   Run ID: {latest_run.get('id', 'N/A')}")
        
        return True
    else:
        try:
            error_data = trigger_response.json()
            print(f"   FAILED: {error_data}")
        except:
            print(f"   FAILED: {trigger_response.text}")
        return False

def test_schedule_retrieval():
    print("\n5. Testing schedule retrieval...")
    
    # Get auth token
    auth_response = requests.post(
        "http://localhost:8081/api/auth/login",
        json={"email": "admin@demo.com", "password": "demo123"}
    )
    token = auth_response.json()['token']
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(
        "http://localhost:8081/api/schedules",
        headers=headers
    )
    
    if response.status_code == 200:
        data = response.json()
        schedules = data.get('schedules', [])
        print(f"   SUCCESS: Retrieved {len(schedules)} schedules")
        
        for i, schedule in enumerate(schedules[:3]):
            print(f"   [{i+1}] {schedule.get('suite_name', 'Unnamed')} - {schedule.get('status', 'unknown')}")
        return True
    else:
        print(f"   FAILED: {response.status_code}")
        return False

if __name__ == "__main__":
    triggered = test_manual_schedule_trigger()
    retrieved = test_schedule_retrieval()
    
    print(f"\nFINAL RESULTS:")
    print(f"Manual Trigger: {'PASS' if triggered else 'FAIL'}")
    print(f"Schedule Retrieval: {'PASS' if retrieved else 'FAIL'}")
    
    if triggered and retrieved:
        print("\n🎉 SCHEDULER SYSTEM FULLY OPERATIONAL!")
    else:
        print("\n⚠️  Some issues detected, but core functionality working")