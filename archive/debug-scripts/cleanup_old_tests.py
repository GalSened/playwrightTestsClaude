#!/usr/bin/env python3
"""
Carefully cleanup old WeSign tests while preserving new converted ones
Only removes tests that were from the original baseline, keeps new converted tests
"""

import json
import os
import shutil
from datetime import datetime

def cleanup_old_tests():
    """Remove old tests systematically, keeping new converted ones"""
    
    # Load baseline to know which files to remove
    try:
        with open("migration_baseline.json", "r") as f:
            baseline = json.load(f)
    except FileNotFoundError:
        print("ERROR: No migration baseline found. Aborting cleanup for safety.")
        return False
    
    # Load conversion report to know which files to keep
    try:
        with open("conversion_report.json", "r") as f:
            conversion_report = json.load(f)
    except FileNotFoundError:
        print("ERROR: No conversion report found. Aborting cleanup for safety.")
        return False
    
    print("Starting systematic cleanup of old tests...")
    print(f"Original files to remove: {len(baseline['current_python_tests'])}")
    print(f"New converted files to keep: {len(conversion_report['converted_tests'])}")
    
    # Create list of files to remove (from baseline)
    files_to_remove = []
    for test in baseline["current_python_tests"]:
        file_path = test["file"].replace("\\\\", "/").replace("\\", "/")
        files_to_remove.append(file_path)
    
    # Create list of files to keep (newly converted)
    files_to_keep = []
    for test in conversion_report["converted_tests"]:
        files_to_keep.append(test["python_file"])
    
    print(f"\\nFiles to remove: {len(files_to_remove)}")
    print(f"Files to keep: {len(files_to_keep)}")
    
    # Safety check - make sure we have new files before removing old ones
    if len(files_to_keep) < 20:  # Should have at least 23 converted files
        print("ERROR: Too few new files found. Aborting cleanup for safety.")
        return False
    
    # Remove old test files
    removed_count = 0
    failed_removals = []
    
    for file_path in files_to_remove:
        try:
            if os.path.exists(file_path):
                print(f"Removing: {file_path}")
                os.remove(file_path)
                removed_count += 1
            else:
                print(f"Already removed: {file_path}")
        except Exception as e:
            print(f"Failed to remove {file_path}: {e}")
            failed_removals.append({"file": file_path, "error": str(e)})
    
    # Check for empty directories and remove them
    empty_dirs = []
    for root, dirs, files in os.walk("tests/"):
        if not files and not dirs and root != "tests":
            empty_dirs.append(root)
    
    for empty_dir in empty_dirs:
        try:
            os.rmdir(empty_dir)
            print(f"Removed empty directory: {empty_dir}")
        except Exception as e:
            print(f"Failed to remove directory {empty_dir}: {e}")
    
    # Generate cleanup report
    cleanup_report = {
        "timestamp": datetime.now().isoformat(),
        "files_to_remove": len(files_to_remove),
        "files_removed": removed_count,
        "files_kept": len(files_to_keep),
        "failed_removals": failed_removals,
        "cleanup_successful": len(failed_removals) == 0
    }
    
    with open("cleanup_report.json", "w") as f:
        json.dump(cleanup_report, f, indent=2)
    
    print(f"\\nCleanup Report:")
    print(f"  Files removed: {removed_count}/{len(files_to_remove)}")
    print(f"  Files kept: {len(files_to_keep)}")
    print(f"  Failed removals: {len(failed_removals)}")
    print(f"  Cleanup successful: {cleanup_report['cleanup_successful']}")
    print(f"  Report saved: cleanup_report.json")
    
    return cleanup_report['cleanup_successful']

if __name__ == "__main__":
    success = cleanup_old_tests()
    if success:
        print("\\nSUCCESS: Old tests cleaned up successfully!")
    else:
        print("\\nFAILED: Cleanup encountered errors!")