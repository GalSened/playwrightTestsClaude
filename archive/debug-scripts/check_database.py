import sqlite3
import json

# Connect to the database
conn = sqlite3.connect('backend/data/scheduler.db')
cursor = conn.cursor()

print("DATABASE PERSISTENCE VERIFICATION")
print("=" * 50)

# Check schedule_runs table for test executions
cursor.execute('SELECT COUNT(*) FROM schedule_runs;')
total_runs = cursor.fetchone()[0]
print(f"Total test execution runs in database: {total_runs}")

# Get recent runs
cursor.execute('SELECT * FROM schedule_runs ORDER BY started_at DESC LIMIT 5;')
runs = cursor.fetchall()

if runs:
    print("\nRECENT TEST EXECUTION RUNS:")
    for i, run in enumerate(runs, 1):
        print(f"\n{i}. Run ID: {run[0][:8]}...")
        print(f"   Status: {run[5]}")
        print(f"   Started: {run[2]}")
        print(f"   Finished: {run[3] if run[3] else 'N/A'}")
        print(f"   Duration: {run[4] if run[4] else 'N/A'} ms")
        print(f"   Exit Code: {run[6] if run[6] is not None else 'N/A'}")
        print(f"   Tests - Total: {run[8]}, Passed: {run[9]}, Failed: {run[10]}, Skipped: {run[11]}")
        print(f"   Environment: {run[17]}")
        print(f"   Browser: {run[18] if run[18] else 'N/A'}")
else:
    print("\nNo test execution runs found in database")

# Check schedules table
cursor.execute('SELECT COUNT(*) FROM schedules;')
total_schedules = cursor.fetchone()[0]
print(f"\nTotal scheduled items in database: {total_schedules}")

# Get recent schedules
cursor.execute('SELECT * FROM schedules ORDER BY created_at DESC LIMIT 3;')
schedules = cursor.fetchall()

if schedules:
    print("\nRECENT SCHEDULES:")
    for i, schedule in enumerate(schedules, 1):
        print(f"\n{i}. Schedule ID: {schedule[0][:8]}...")
        print(f"   Status: {schedule[2]}")  
        print(f"   Created: {schedule[6]}")
        print(f"   Test Files: {schedule[8]}")
        print(f"   Environment: {schedule[14]}")

conn.close()
print("\n" + "=" * 50)
print("DATABASE VERIFICATION COMPLETE")