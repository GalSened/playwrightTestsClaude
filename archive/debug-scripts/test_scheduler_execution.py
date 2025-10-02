#!/usr/bin/env python3
"""
Test scheduler execution in 5 minutes
Creates a schedule for 5 minutes from now and monitors execution
"""

import requests
import json
import time
from datetime import datetime, timedelta

BASE_URL = 'http://localhost:8081/api/schedules'

def create_test_schedule():
    """Create a test schedule for 5 minutes from now"""
    print("Creating test schedule for 5 minutes from now...")
    
    # Calculate time 5 minutes from now
    future_time = datetime.now() + timedelta(minutes=5)
    run_at = future_time.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    
    print(f"Scheduled for: {future_time.strftime('%Y-%m-%d %H:%M:%S')} (local time)")
    
    schedule_data = {
        'suite_id': 'execution-test-suite',
        'suite_name': '5-Minute Execution Test',
        'run_at': run_at,
        'timezone': 'Asia/Jerusalem',
        'notes': f'Test execution scheduled for {future_time.strftime("%H:%M")}',
        'priority': 9,
        'execution_options': {
            'mode': 'headless',
            'execution': 'parallel',
            'retries': 1,
            'browser': 'chromium',
            'environment': 'test'
        }
    }
    
    try:
        response = requests.post(BASE_URL, json=schedule_data)
        
        if response.status_code == 201:
            result = response.json()
            schedule = result.get('schedule')
            schedule_id = schedule['id']
            
            print(f"✅ Schedule created successfully!")
            print(f"   ID: {schedule_id}")
            print(f"   Suite: {schedule['suite_name']}")
            print(f"   Status: {schedule['status']}")
            print(f"   Run at (UTC): {schedule['run_at_utc']}")
            print(f"   Run at (Local): {schedule['run_at_local']}")
            print(f"   Minutes until execution: {schedule.get('minutes_until_run', 'unknown')}")
            
            return schedule_id
        else:
            print(f"❌ Failed to create schedule: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error creating schedule: {e}")
        return None

def monitor_schedule_execution(schedule_id, check_duration_minutes=7):
    """Monitor schedule execution for the specified duration"""
    if not schedule_id:
        print("❌ No schedule ID to monitor")
        return
    
    print(f"\n🔍 Monitoring schedule {schedule_id} for {check_duration_minutes} minutes...")
    print("Checking every 30 seconds for status changes...")
    
    start_time = datetime.now()
    last_status = None
    execution_detected = False
    
    while (datetime.now() - start_time).total_seconds() < (check_duration_minutes * 60):
        try:
            # Check schedule status
            response = requests.get(f"{BASE_URL}/{schedule_id}")
            
            if response.status_code == 200:
                result = response.json()
                schedule = result.get('schedule')
                current_status = schedule['status']
                minutes_until = schedule.get('minutes_until_run')
                
                # Print status change
                if current_status != last_status:
                    timestamp = datetime.now().strftime("%H:%M:%S")
                    print(f"[{timestamp}] Status: {current_status}")
                    
                    if minutes_until is not None and minutes_until >= 0:
                        print(f"              Minutes until run: {minutes_until}")
                    elif minutes_until is not None and minutes_until < 0:
                        print(f"              Overdue by: {abs(minutes_until)} minutes")
                    
                    last_status = current_status
                
                # Check for execution
                if current_status == 'running':
                    print("🚀 EXECUTION STARTED!")
                    execution_detected = True
                elif current_status == 'completed':
                    print("✅ EXECUTION COMPLETED!")
                    execution_detected = True
                    
                    # Get execution details
                    runs = result.get('recent_runs', [])
                    if runs:
                        latest_run = runs[0]
                        print(f"   Run ID: {latest_run['id']}")
                        print(f"   Started: {latest_run['started_at']}")
                        print(f"   Finished: {latest_run.get('finished_at', 'N/A')}")
                        print(f"   Duration: {latest_run.get('duration_ms', 0)}ms")
                        print(f"   Exit Code: {latest_run.get('exit_code', 'N/A')}")
                        print(f"   Tests Total: {latest_run.get('tests_total', 0)}")
                        print(f"   Tests Passed: {latest_run.get('tests_passed', 0)}")
                        print(f"   Tests Failed: {latest_run.get('tests_failed', 0)}")
                    break
                elif current_status == 'failed':
                    print("❌ EXECUTION FAILED!")
                    execution_detected = True
                    
                    # Get failure details
                    runs = result.get('recent_runs', [])
                    if runs:
                        latest_run = runs[0]
                        print(f"   Error: {latest_run.get('error_message', 'Unknown error')}")
                    break
                
            else:
                print(f"❌ Failed to check schedule: {response.status_code}")
        
        except Exception as e:
            print(f"❌ Error checking schedule: {e}")
        
        # Wait before next check
        time.sleep(30)
    
    if not execution_detected:
        print(f"\n⚠️  No execution detected within {check_duration_minutes} minutes")
        print("This could mean:")
        print("  • The scheduler worker is not running")
        print("  • The execution is queued but not started yet") 
        print("  • There was an issue with the worker process")
    
    return execution_detected

def check_scheduler_worker_status():
    """Check if the scheduler worker is active"""
    print("\n🔧 Checking scheduler worker status...")
    
    try:
        # Check for recent worker activity in logs
        # This is a simple check - in production you'd have proper worker monitoring
        
        # Get all schedules to see if any are being processed
        response = requests.get(BASE_URL)
        if response.status_code == 200:
            result = response.json()
            schedules = result.get('schedules', [])
            
            running_count = sum(1 for s in schedules if s['status'] == 'running')
            scheduled_count = sum(1 for s in schedules if s['status'] == 'scheduled')
            
            print(f"   Active schedules: {len(schedules)}")
            print(f"   Currently running: {running_count}")
            print(f"   Scheduled for future: {scheduled_count}")
            
            if running_count > 0:
                print("✅ Worker appears to be active (schedules are running)")
            elif scheduled_count > 0:
                print("⏳ Worker status unclear (schedules waiting)")
            else:
                print("❓ No active schedules to assess worker status")
        
        # Get stats
        stats_response = requests.get(f"{BASE_URL}/stats/summary")
        if stats_response.status_code == 200:
            stats = stats_response.json()
            print(f"   Total schedules: {stats.get('total', 0)}")
            print(f"   Next 24h: {stats.get('next_24h', 0)}")
            
    except Exception as e:
        print(f"❌ Error checking worker status: {e}")

def main():
    """Run the 5-minute execution test"""
    print("Testing Scheduler Execution - 5 Minute Test")
    print("=" * 50)
    print("This test will:")
    print("1. Create a schedule for 5 minutes from now")
    print("2. Monitor for execution")
    print("3. Report results")
    print()
    
    # Check worker status first
    check_scheduler_worker_status()
    
    # Create the test schedule
    schedule_id = create_test_schedule()
    
    if schedule_id:
        print(f"\n⏰ Schedule created! Will execute in ~5 minutes")
        print("🔍 Starting monitoring...")
        
        # Monitor for execution
        execution_detected = monitor_schedule_execution(schedule_id)
        
        print("\n" + "=" * 50)
        if execution_detected:
            print("🎉 SUCCESS: Schedule execution was detected!")
            print("✅ The scheduler is working correctly end-to-end")
        else:
            print("⚠️  INCONCLUSIVE: No execution detected in monitoring window")
            print("📋 Possible reasons:")
            print("   • Scheduler worker may not be running")
            print("   • Execution may happen after monitoring window")
            print("   • Check backend logs for worker activity")
        
        print(f"\n💡 You can continue monitoring at: http://localhost:3000/scheduler")
        print(f"   Schedule ID: {schedule_id}")
    
    else:
        print("❌ Could not create test schedule")

if __name__ == "__main__":
    main()