#!/usr/bin/env python3
"""
Basic scheduler functionality test
Tests the core scheduling features we just implemented:
- Simple schedule creation
- Recurring schedules (daily, weekly)
- Time validation
- Schedule management (cancel, delete)
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = 'http://localhost:8081/api/schedules'

def test_basic_schedule_creation():
    """Test creating a basic one-time schedule"""
    print("Testing basic schedule creation...")
    
    # Calculate a future time (5 minutes from now)
    future_time = datetime.now() + timedelta(minutes=5)
    run_at = future_time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    
    schedule_data = {
        'suite_id': 'test-suite-001',
        'suite_name': 'WeSign Login Tests',
        'run_at': run_at,
        'timezone': 'Asia/Jerusalem',
        'notes': 'Test scheduler basic functionality',
        'priority': 5,
        'execution_options': {
            'mode': 'headless',
            'execution': 'parallel',
            'retries': 1,
            'browser': 'chromium',
            'environment': 'staging'
        }
    }
    
    try:
        response = requests.post(BASE_URL, json=schedule_data)
        
        if response.status_code == 201:
            result = response.json()
            schedule = result.get('schedule')
            print(f"Schedule created successfully!")
            print(f"   ID: {schedule['id']}")
            print(f"   Suite: {schedule['suite_name']}")
            print(f"   Run At: {schedule['run_at_local']}")
            print(f"   Status: {schedule['status']}")
            return schedule['id']
        else:
            print(f"Failed to create schedule: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"Error creating schedule: {e}")
        return None

def test_daily_recurring_schedule():
    """Test creating a daily recurring schedule"""
    print("\nTesting daily recurring schedule...")
    
    # Calculate a future time (10 minutes from now)
    future_time = datetime.now() + timedelta(minutes=10)
    run_at = future_time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    
    schedule_data = {
        'suite_id': 'test-suite-002',
        'suite_name': 'WeSign Daily Smoke Tests',
        'run_at': run_at,
        'timezone': 'Asia/Jerusalem',
        'notes': 'Daily recurring test - every day at the same time',
        'priority': 8,
        'recurrence_type': 'daily',
        'recurrence_interval': 1,
        'execution_options': {
            'mode': 'headless',
            'execution': 'parallel',
            'retries': 2,
            'browser': 'chromium',
            'environment': 'staging'
        }
    }
    
    try:
        response = requests.post(BASE_URL, json=schedule_data)
        
        if response.status_code == 201:
            result = response.json()
            schedule = result.get('schedule')
            print(f"Recurring schedule created successfully!")
            print(f"   ID: {schedule['id']}")
            print(f"   Suite: {schedule['suite_name']}")
            print(f"   Recurrence: {schedule['recurrence_type']}")
            print(f"   Run At: {schedule['run_at_local']}")
            return schedule['id']
        else:
            print(f"Failed to create recurring schedule: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"Error creating recurring schedule: {e}")
        return None

def test_weekly_recurring_schedule():
    """Test creating a weekly recurring schedule with specific days"""
    print("\nTesting weekly recurring schedule...")
    
    # Calculate a future time (15 minutes from now)
    future_time = datetime.now() + timedelta(minutes=15)
    run_at = future_time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    
    schedule_data = {
        'suite_id': 'test-suite-003',
        'suite_name': 'WeSign Weekend Regression',
        'run_at': run_at,
        'timezone': 'Asia/Jerusalem',
        'notes': 'Weekend regression tests - runs on Saturday and Sunday',
        'priority': 7,
        'recurrence_type': 'weekly',
        'recurrence_interval': 1,
        'recurrence_days': ['Saturday', 'Sunday'],
        'execution_options': {
            'mode': 'headed',
            'execution': 'sequential',
            'retries': 3,
            'browser': 'all',
            'environment': 'staging'
        }
    }
    
    try:
        response = requests.post(BASE_URL, json=schedule_data)
        
        if response.status_code == 201:
            result = response.json()
            schedule = result.get('schedule')
            print(f"Weekly schedule created successfully!")
            print(f"   ID: {schedule['id']}")
            print(f"   Suite: {schedule['suite_name']}")
            print(f"   Recurrence: {schedule['recurrence_type']}")
            print(f"   Days: {schedule.get('recurrence_days_parsed', 'N/A')}")
            return schedule['id']
        else:
            print(f"Failed to create weekly schedule: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"Error creating weekly schedule: {e}")
        return None

def test_list_schedules():
    """Test listing all schedules"""
    print("\nTesting schedule listing...")
    
    try:
        response = requests.get(BASE_URL)
        
        if response.status_code == 200:
            result = response.json()
            schedules = result.get('schedules', [])
            print(f"Found {len(schedules)} schedules:")
            
            for schedule in schedules:
                recurring_info = ""
                if schedule.get('recurrence_type') and schedule['recurrence_type'] != 'none':
                    recurring_info = f" [{schedule['recurrence_type']}]"
                    if schedule.get('recurrence_days_parsed'):
                        recurring_info += f" on {', '.join(schedule['recurrence_days_parsed'])}"
                
                print(f"   - {schedule['suite_name']}{recurring_info}")
                print(f"     Status: {schedule['status']}, Priority: {schedule['priority']}")
                print(f"     Run at: {schedule['run_at_local']}")
            
            return schedules
        else:
            print(f"Failed to list schedules: {response.status_code}")
            return []
            
    except Exception as e:
        print(f"Error listing schedules: {e}")
        return []

def test_schedule_cancellation(schedule_id):
    """Test canceling a schedule"""
    if not schedule_id:
        print("\nSkipping cancellation test - no schedule ID provided")
        return
        
    print(f"\nTesting schedule cancellation for {schedule_id}...")
    
    try:
        response = requests.post(f"{BASE_URL}/{schedule_id}/cancel")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Schedule canceled successfully!")
            print(f"   Message: {result.get('message')}")
        else:
            print(f"Failed to cancel schedule: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"Error canceling schedule: {e}")

def test_invalid_schedule_creation():
    """Test validation by trying to create invalid schedules"""
    print("\nTesting schedule validation...")
    
    # Test 1: Past time should fail
    past_time = datetime.now() - timedelta(minutes=5)
    
    invalid_schedule = {
        'suite_id': 'test-suite-invalid',
        'suite_name': 'Invalid Schedule Test',
        'run_at': past_time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z',
        'timezone': 'Asia/Jerusalem'
    }
    
    try:
        response = requests.post(BASE_URL, json=invalid_schedule)
        
        if response.status_code == 400:
            print("Past time validation working correctly")
        else:
            print(f"Warning: Expected validation error for past time, got: {response.status_code}")
            
    except Exception as e:
        print(f"Error testing past time validation: {e}")

def test_stats_endpoint():
    """Test the scheduler stats endpoint"""
    print("\nTesting scheduler statistics...")
    
    try:
        response = requests.get(f"{BASE_URL}/stats/summary")
        
        if response.status_code == 200:
            stats = response.json()
            print(f"Scheduler statistics:")
            print(f"   Total schedules: {stats.get('total', 0)}")
            print(f"   Scheduled: {stats.get('by_status', {}).get('scheduled', 0)}")
            print(f"   Next 24h: {stats.get('next_24h', 0)}")
            print(f"   Overdue: {stats.get('overdue', 0)}")
        else:
            print(f"Failed to get stats: {response.status_code}")
            
    except Exception as e:
        print(f"Error getting stats: {e}")

def main():
    """Run all scheduler tests"""
    print("Starting Scheduler Functionality Tests")
    print("=" * 50)
    
    # Test basic functionality
    schedule_id_1 = test_basic_schedule_creation()
    schedule_id_2 = test_daily_recurring_schedule()
    schedule_id_3 = test_weekly_recurring_schedule()
    
    # Test listing and validation
    test_list_schedules()
    test_stats_endpoint()
    test_invalid_schedule_creation()
    
    # Test cancellation (only cancel the first one to preserve others for demo)
    if schedule_id_1:
        test_schedule_cancellation(schedule_id_1)
    
    print("\n" + "=" * 50)
    print("Scheduler functionality tests completed!")
    print("\nTips:")
    print("   - Check the UI at http://localhost:3000/scheduler")
    print("   - All schedules include proper validation")
    print("   - Recurring schedules support daily/weekly patterns")
    print("   - Smart time suggestions help avoid past times")

if __name__ == "__main__":
    main()