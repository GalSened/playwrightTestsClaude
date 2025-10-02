#!/usr/bin/env python3
"""
Simple Test Execution Runner for WeSign QA Intelligence
Runs all tests without Unicode characters to avoid Windows console issues
"""

import os
import sys
import subprocess
import json
import logging
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime
import concurrent.futures
import time

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('test_execution.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class SimpleTestRunner:
    def __init__(self):
        self.root_path = Path(__file__).parent
        self.external_wesign_path = Path("C:/Users/gals/seleniumpythontests-1/playwright_tests")
        self.results = {
            'total_tests': 0,
            'passed': 0,
            'failed': 0,
            'skipped': 0,
            'execution_time': 0,
            'test_results': []
        }
        
    def discover_tests(self) -> List[Dict]:
        """Discover all test files"""
        tests = []
        
        # Current repository tests
        current_test_dirs = [
            self.root_path / "tests",
            self.root_path / "playwright-smart" / "tests",
            self.root_path / "playwright-system-tests" / "tests",
            self.root_path / "tests-enterprise" / "src"
        ]
        
        for test_dir in current_test_dirs:
            if test_dir.exists():
                for test_file in test_dir.rglob("*.py"):
                    if test_file.name.startswith("test_") and test_file.suffix == ".py":
                        tests.append({
                            'file_path': str(test_file),
                            'repository': 'current',
                            'test_name': test_file.name
                        })
        
        # External WeSign tests
        if self.external_wesign_path.exists():
            wesign_test_dir = self.external_wesign_path / "tests"
            if wesign_test_dir.exists():
                for test_file in wesign_test_dir.rglob("*.py"):
                    if test_file.name.startswith("test_") and test_file.suffix == ".py":
                        tests.append({
                            'file_path': str(test_file),
                            'repository': 'external_wesign',
                            'test_name': test_file.name
                        })
        
        return tests
    
    def run_single_test(self, test: Dict) -> Dict:
        """Run a single test file"""
        start_time = time.time()
        result = {
            'test_name': test['test_name'],
            'repository': test['repository'],
            'file_path': test['file_path'],
            'status': 'failed',
            'output': '',
            'error': '',
            'execution_time': 0
        }
        
        try:
            # Change to test directory
            test_dir = Path(test['file_path']).parent
            
            # Run pytest on the specific test file
            cmd = [
                sys.executable, "-m", "pytest", 
                test['file_path'],
                "-v", "--tb=short",
                "--maxfail=1"  # Stop after first failure in file
            ]
            
            process = subprocess.run(
                cmd,
                cwd=test_dir,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout per test file
                encoding='utf-8',
                errors='replace'
            )
            
            result['output'] = process.stdout
            result['error'] = process.stderr
            result['execution_time'] = time.time() - start_time
            
            if process.returncode == 0:
                result['status'] = 'passed'
            elif 'SKIPPED' in process.stdout:
                result['status'] = 'skipped' 
            else:
                result['status'] = 'failed'
                
        except subprocess.TimeoutExpired:
            result['status'] = 'failed'
            result['error'] = 'Test execution timeout (5 minutes)'
            result['execution_time'] = time.time() - start_time
        except Exception as e:
            result['status'] = 'failed'
            result['error'] = str(e)
            result['execution_time'] = time.time() - start_time
            
        return result
    
    def run_all_tests(self) -> Dict:
        """Run all discovered tests"""
        print("WeSign QA Intelligence - Test Execution Started")
        print("=" * 60)
        
        # Discover tests
        tests = self.discover_tests()
        print(f"Discovered {len(tests)} test files")
        
        # Count by repository
        repo_counts = {}
        for test in tests:
            repo = test['repository']
            repo_counts[repo] = repo_counts.get(repo, 0) + 1
            
        for repo, count in repo_counts.items():
            print(f"  - {repo}: {count} files")
        
        print(f"\nStarting execution...")
        print("-" * 40)
        
        self.results['total_tests'] = len(tests)
        start_time = time.time()
        
        # Run tests sequentially to avoid resource conflicts
        for i, test in enumerate(tests, 1):
            print(f"[{i}/{len(tests)}] Running {test['test_name']}...", end=' ', flush=True)
            
            result = self.run_single_test(test)
            self.results['test_results'].append(result)
            
            # Update counters
            if result['status'] == 'passed':
                self.results['passed'] += 1
                print("PASSED")
            elif result['status'] == 'skipped':
                self.results['skipped'] += 1  
                print("SKIPPED")
            else:
                self.results['failed'] += 1
                print("FAILED")
                if result['error']:
                    print(f"    Error: {result['error'][:100]}...")
        
        self.results['execution_time'] = time.time() - start_time
        
        # Print summary
        self.print_summary()
        
        return self.results
    
    def print_summary(self):
        """Print execution summary"""
        print("\n" + "=" * 60)
        print("TEST EXECUTION SUMMARY")
        print("=" * 60)
        
        total = self.results['total_tests']
        passed = self.results['passed']
        failed = self.results['failed']
        skipped = self.results['skipped']
        duration = self.results['execution_time']
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed} ({(passed/total*100):.1f}%)")
        print(f"Failed: {failed} ({(failed/total*100):.1f}%)")
        print(f"Skipped: {skipped} ({(skipped/total*100):.1f}%)")
        print(f"Execution Time: {duration:.2f} seconds")
        
        # Success rate
        if total > 0:
            success_rate = (passed / total) * 100
            print(f"Success Rate: {success_rate:.1f}%")
        
        # Show some failures
        failed_tests = [r for r in self.results['test_results'] if r['status'] == 'failed']
        if failed_tests:
            print(f"\nFirst 5 Failed Tests:")
            for i, test in enumerate(failed_tests[:5], 1):
                print(f"  {i}. {test['test_name']}")
                if test['error']:
                    print(f"     Error: {test['error'][:80]}...")
        
        print("\n" + "=" * 60)
        
        # Generate JSON report
        report_file = f"test_execution_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
        print(f"Detailed report saved to: {report_file}")

def main():
    """Main execution function"""
    runner = SimpleTestRunner()
    
    try:
        results = runner.run_all_tests()
        
        # Exit codes
        if results['failed'] == 0:
            print("\nALL TESTS PASSED!")
            sys.exit(0)
        elif results['passed'] > results['failed']:
            print(f"\nMOSTLY SUCCESSFUL: {results['passed']} passed, {results['failed']} failed")
            sys.exit(1)  
        else:
            print(f"\nMANY FAILURES: {results['failed']} failed out of {results['total_tests']}")
            sys.exit(2)
            
    except KeyboardInterrupt:
        print("\nExecution interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(3)

if __name__ == "__main__":
    main()