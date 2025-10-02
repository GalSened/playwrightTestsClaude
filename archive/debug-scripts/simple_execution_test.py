#!/usr/bin/env python3
"""
Simple scheduler execution test - creates a schedule for 5 minutes from now
"""

import requests
import time
from datetime import datetime, timedelta

BASE_URL = 'http://localhost:8081/api/schedules'

def main():
    print("Creating schedule for 5 minutes from now...")
    
    # Calculate time 5 minutes from now
    future_time = datetime.now() + timedelta(minutes=5)
    run_at = future_time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    
    print(f"Schedule time: {future_time.strftime('%Y-%m-%d %H:%M:%S')} (local)")
    
    # Create the schedule
    schedule_data = {
        'suite_id': 'execution-test-suite-' + str(int(time.time())),
        'suite_name': 'Quick Execution Test',
        'run_at': run_at,
        'timezone': 'Asia/Jerusalem',
        'notes': f'Test execution at {future_time.strftime("%H:%M")}',
        'priority': 9,
        'execution_options': {
            'mode': 'headless',
            'execution': 'parallel',
            'retries': 1,
            'browser': 'chromium'
        }
    }
    
    try:
        response = requests.post(BASE_URL, json=schedule_data)
        
        if response.status_code == 201:
            result = response.json()
            schedule = result.get('schedule')
            schedule_id = schedule['id']
            
            print(f"SUCCESS: Schedule created!")
            print(f"ID: {schedule_id}")
            print(f"Status: {schedule['status']}")
            print(f"Minutes until run: {schedule.get('minutes_until_run', 'unknown')}")
            
            # Monitor for 7 minutes
            print(f"\nMonitoring for execution (checking every 30 seconds)...")
            
            for i in range(14):  # 14 * 30 seconds = 7 minutes
                time.sleep(30)
                
                try:
                    check_response = requests.get(f"{BASE_URL}/{schedule_id}")
                    if check_response.status_code == 200:
                        check_result = check_response.json()
                        current_schedule = check_result.get('schedule')
                        status = current_schedule['status']
                        
                        minutes_left = current_schedule.get('minutes_until_run', 0)
                        timestamp = datetime.now().strftime("%H:%M:%S")
                        
                        print(f"[{timestamp}] Status: {status} | Minutes until: {minutes_left}")
                        
                        if status == 'running':
                            print("EXECUTION STARTED!")
                            break
                        elif status == 'completed':
                            print("EXECUTION COMPLETED!")
                            
                            # Show run details
                            runs = check_result.get('recent_runs', [])
                            if runs:
                                run = runs[0]
                                print(f"Duration: {run.get('duration_ms', 0)}ms")
                                print(f"Tests: {run.get('tests_total', 0)} total")
                                print(f"Exit code: {run.get('exit_code', 'unknown')}")
                            break
                        elif status == 'failed':
                            print("EXECUTION FAILED!")
                            break
                            
                except Exception as e:
                    print(f"Error checking status: {e}")
            
            print(f"\nView in UI: http://localhost:3000/scheduler")
            print(f"Schedule ID: {schedule_id}")
            
        else:
            print(f"Failed to create schedule: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()