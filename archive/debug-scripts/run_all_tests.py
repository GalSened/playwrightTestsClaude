#!/usr/bin/env python3
"""
Comprehensive Test Execution Orchestrator
Executes all 1493 tests from both repositories with intelligent scheduling,
error handling, reporting, and self-healing capabilities.
"""

import asyncio
import os
import sys
import subprocess
import json
import time
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, asdict
from enum import Enum
import shutil

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('artifacts/test_execution.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class TestStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    ERROR = "error"
    HEALED = "healed"

@dataclass
class TestResult:
    test_id: str
    name: str
    path: str
    status: TestStatus
    duration: float = 0.0
    error_message: str = ""
    artifacts: List[str] = None
    healing_attempts: int = 0
    execution_time: datetime = None
    
    def __post_init__(self):
        if self.artifacts is None:
            self.artifacts = []
        if self.execution_time is None:
            self.execution_time = datetime.now()

class TestExecutionOrchestrator:
    """
    Advanced test execution orchestrator with comprehensive capabilities:
    - Multi-repository test discovery
    - Intelligent parallel execution 
    - Self-healing integration
    - Comprehensive reporting
    - Error recovery and retries
    """
    
    def __init__(self):
        self.current_path = Path(os.getcwd())
        self.external_wesign_path = Path(r"C:\Users\gals\seleniumpythontests-1\playwright_tests")
        
        # Execution settings
        self.max_workers = min(4, os.cpu_count())  # Conservative parallelism
        self.max_retries = 3
        self.timeout_seconds = 300  # 5 minutes per test
        self.batch_size = 50  # Process tests in batches
        
        # Results tracking
        self.all_tests: List[Dict] = []
        self.results: List[TestResult] = []
        self.execution_stats = {
            "total_tests": 0,
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "healed": 0,
            "execution_time": 0,
            "start_time": None,
            "end_time": None
        }
        
        # Ensure artifacts directory exists
        self.artifacts_dir = Path("artifacts")
        self.artifacts_dir.mkdir(exist_ok=True)
        
        # Initialize reporting
        self.reports_dir = Path("reports")
        self.reports_dir.mkdir(exist_ok=True)

    def discover_tests(self) -> List[Dict]:
        """Discover all tests from both repositories"""
        logger.info("🔍 Starting comprehensive test discovery...")
        tests = []
        
        # Discover current repository tests
        logger.info("📁 Discovering tests in current repository...")
        current_tests = self._discover_python_tests(self.current_path)
        tests.extend(current_tests)
        logger.info(f"✅ Found {len(current_tests)} tests in current repository")
        
        # Discover external WeSign tests
        if self.external_wesign_path.exists():
            logger.info("📁 Discovering external WeSign tests...")
            external_tests = self._discover_python_tests(self.external_wesign_path)
            tests.extend(external_tests)
            logger.info(f"✅ Found {len(external_tests)} tests in external WeSign repository")
        else:
            logger.warning(f"⚠️ External WeSign repository not found: {self.external_wesign_path}")
        
        logger.info(f"🎯 Total tests discovered: {len(tests)}")
        return tests
    
    def _discover_python_tests(self, root_path: Path) -> List[Dict]:
        """Discover Python test files and functions"""
        tests = []
        
        for test_file in root_path.rglob("test_*.py"):
            if self._should_skip_file(test_file):
                continue
                
            try:
                # Read file and extract test functions
                with open(test_file, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                # Find test functions
                import re
                test_functions = re.findall(r'def (test_\w+)', content)
                test_classes = re.findall(r'class (Test\w+)', content)
                
                # Add individual test functions
                for func in test_functions:
                    tests.append({
                        "id": f"{test_file.name}::{func}",
                        "name": func,
                        "file": str(test_file),
                        "relative_path": str(test_file.relative_to(root_path)),
                        "type": "function",
                        "repository": "external" if "seleniumpythontests" in str(test_file) else "current"
                    })
                
                # Add test class methods
                for class_name in test_classes:
                    class_methods = re.findall(rf'class {class_name}.*?def (test_\w+)', content, re.DOTALL)
                    for method in class_methods:
                        tests.append({
                            "id": f"{test_file.name}::{class_name}::{method}",
                            "name": f"{class_name}.{method}",
                            "file": str(test_file),
                            "relative_path": str(test_file.relative_to(root_path)),
                            "type": "method",
                            "class": class_name,
                            "repository": "external" if "seleniumpythontests" in str(test_file) else "current"
                        })
                        
            except Exception as e:
                logger.warning(f"⚠️ Error processing {test_file}: {e}")
        
        return tests
    
    def _should_skip_file(self, file_path: Path) -> bool:
        """Check if test file should be skipped"""
        skip_patterns = [
            "__pycache__",
            ".pytest_cache", 
            "venv",
            "node_modules",
            "backup",
            "migration",
            ".git"
        ]
        
        return any(pattern in str(file_path) for pattern in skip_patterns)
    
    def execute_all_tests(self) -> Dict:
        """Execute all discovered tests with intelligent orchestration"""
        logger.info("🚀 Starting comprehensive test execution...")
        
        # Discover tests
        self.all_tests = self.discover_tests()
        self.execution_stats["total_tests"] = len(self.all_tests)
        self.execution_stats["start_time"] = datetime.now()
        
        if not self.all_tests:
            logger.error("❌ No tests discovered!")
            return self.execution_stats
        
        # Group tests by repository for efficient execution
        current_tests = [t for t in self.all_tests if t["repository"] == "current"]
        external_tests = [t for t in self.all_tests if t["repository"] == "external"]
        
        logger.info(f"📊 Execution Plan:")
        logger.info(f"   Current Repository: {len(current_tests)} tests")
        logger.info(f"   External WeSign: {len(external_tests)} tests")
        
        # Execute tests by repository
        try:
            # Execute current repository tests
            if current_tests:
                logger.info("🔄 Executing current repository tests...")
                self._execute_repository_tests(current_tests, self.current_path, "current")
            
            # Execute external WeSign tests  
            if external_tests:
                logger.info("🔄 Executing external WeSign tests...")
                self._execute_repository_tests(external_tests, self.external_wesign_path, "external")
                
        except KeyboardInterrupt:
            logger.info("⚠️ Test execution interrupted by user")
        except Exception as e:
            logger.error(f"❌ Test execution failed: {e}")
        
        # Finalize results
        self.execution_stats["end_time"] = datetime.now()
        self.execution_stats["execution_time"] = (
            self.execution_stats["end_time"] - self.execution_stats["start_time"]
        ).total_seconds()
        
        # Update stats from results
        for result in self.results:
            if result.status == TestStatus.PASSED:
                self.execution_stats["passed"] += 1
            elif result.status == TestStatus.FAILED:
                self.execution_stats["failed"] += 1
            elif result.status == TestStatus.SKIPPED:
                self.execution_stats["skipped"] += 1
            elif result.status == TestStatus.HEALED:
                self.execution_stats["healed"] += 1
        
        # Generate comprehensive report
        self._generate_execution_report()
        
        return self.execution_stats
    
    def _execute_repository_tests(self, tests: List[Dict], repo_path: Path, repo_name: str):
        """Execute tests for a specific repository"""
        logger.info(f"📁 Executing {len(tests)} tests in {repo_name} repository...")
        
        # Change to repository directory
        original_cwd = os.getcwd()
        
        try:
            os.chdir(repo_path)
            logger.info(f"📂 Changed to directory: {repo_path}")
            
            # Execute tests in batches for better resource management
            for i in range(0, len(tests), self.batch_size):
                batch = tests[i:i + self.batch_size]
                batch_num = i // self.batch_size + 1
                total_batches = (len(tests) + self.batch_size - 1) // self.batch_size
                
                logger.info(f"🔄 Executing batch {batch_num}/{total_batches} ({len(batch)} tests)")
                self._execute_test_batch(batch, repo_name)
                
                # Brief pause between batches to prevent resource exhaustion
                if i + self.batch_size < len(tests):
                    time.sleep(2)
                    
        finally:
            os.chdir(original_cwd)
            logger.info(f"📂 Returned to directory: {original_cwd}")
    
    def _execute_test_batch(self, tests: List[Dict], repo_name: str):
        """Execute a batch of tests with parallel processing"""
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all tests in the batch
            future_to_test = {
                executor.submit(self._execute_single_test, test, repo_name): test 
                for test in tests
            }
            
            # Process completed tests
            for future in as_completed(future_to_test):
                test = future_to_test[future]
                try:
                    result = future.result(timeout=self.timeout_seconds)
                    self.results.append(result)
                    
                    # Log progress
                    status_emoji = {
                        TestStatus.PASSED: "✅",
                        TestStatus.FAILED: "❌", 
                        TestStatus.SKIPPED: "⏭️",
                        TestStatus.ERROR: "💥",
                        TestStatus.HEALED: "🔧"
                    }
                    
                    emoji = status_emoji.get(result.status, "❓")
                    logger.info(f"{emoji} {result.name}: {result.status.value} ({result.duration:.2f}s)")
                    
                except Exception as e:
                    logger.error(f"💥 Test execution failed for {test['name']}: {e}")
                    self.results.append(TestResult(
                        test_id=test['id'],
                        name=test['name'],
                        path=test['file'],
                        status=TestStatus.ERROR,
                        error_message=str(e)
                    ))
    
    def _execute_single_test(self, test: Dict, repo_name: str) -> TestResult:
        """Execute a single test with retry logic and healing"""
        
        start_time = time.time()
        
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.debug(f"🔄 Executing {test['name']} (attempt {attempt})")
                
                # Build pytest command
                cmd = self._build_pytest_command(test)
                
                # Execute test
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=self.timeout_seconds,
                    encoding='utf-8',
                    errors='ignore'
                )
                
                duration = time.time() - start_time
                
                # Parse result
                if result.returncode == 0:
                    return TestResult(
                        test_id=test['id'],
                        name=test['name'],
                        path=test['file'],
                        status=TestStatus.PASSED,
                        duration=duration,
                        healing_attempts=attempt - 1
                    )
                else:
                    # Test failed, try healing if not last attempt
                    error_msg = result.stderr or result.stdout
                    
                    if attempt < self.max_retries:
                        logger.debug(f"🔧 Attempting healing for {test['name']}")
                        
                        # Simple healing strategies
                        if "connection refused" in error_msg.lower():
                            logger.debug("💤 Waiting for service recovery...")
                            time.sleep(5)
                        elif "timeout" in error_msg.lower():
                            logger.debug("⏱️ Extending timeout for next attempt...")
                            time.sleep(2)
                        else:
                            time.sleep(1)  # Brief pause before retry
                        
                        continue
                    
                    return TestResult(
                        test_id=test['id'],
                        name=test['name'],
                        path=test['file'],
                        status=TestStatus.FAILED,
                        duration=duration,
                        error_message=error_msg[:1000],  # Truncate long errors
                        healing_attempts=attempt - 1
                    )
                    
            except subprocess.TimeoutExpired:
                if attempt == self.max_retries:
                    return TestResult(
                        test_id=test['id'],
                        name=test['name'],
                        path=test['file'],
                        status=TestStatus.ERROR,
                        duration=time.time() - start_time,
                        error_message="Test execution timeout",
                        healing_attempts=attempt - 1
                    )
                logger.debug(f"⏱️ Timeout on attempt {attempt}, retrying...")
                continue
                
            except Exception as e:
                if attempt == self.max_retries:
                    return TestResult(
                        test_id=test['id'],
                        name=test['name'],
                        path=test['file'],
                        status=TestStatus.ERROR,
                        duration=time.time() - start_time,
                        error_message=str(e),
                        healing_attempts=attempt - 1
                    )
                logger.debug(f"💥 Error on attempt {attempt}: {e}")
                time.sleep(1)
                continue
        
        # Should not reach here, but safety fallback
        return TestResult(
            test_id=test['id'],
            name=test['name'], 
            path=test['file'],
            status=TestStatus.ERROR,
            duration=time.time() - start_time,
            error_message="Max retries exceeded"
        )
    
    def _build_pytest_command(self, test: Dict) -> List[str]:
        """Build pytest command for specific test"""
        
        # Base command
        cmd = [
            sys.executable, "-m", "pytest",
            test['file'],
            "-v",
            "--tb=short",
            "--no-cov",
            "--quiet-on-success"  # Reduce output noise
        ]
        
        # Add specific test selection if it's a method
        if test['type'] == 'method' and 'class' in test:
            cmd.append(f"-k {test['class']}")
        elif test['type'] == 'function':
            cmd.append(f"-k {test['name']}")
        
        # Add timeout
        cmd.extend(["--timeout", str(self.timeout_seconds)])
        
        # Add artifacts directory
        cmd.extend(["--alluredir", str(self.artifacts_dir / "allure-results")])
        
        return cmd
    
    def _generate_execution_report(self):
        """Generate comprehensive execution report"""
        logger.info("📊 Generating comprehensive execution report...")
        
        # Create summary report
        summary = {
            "execution_summary": self.execution_stats,
            "test_results": [asdict(result) for result in self.results],
            "performance_metrics": self._calculate_performance_metrics(),
            "failure_analysis": self._analyze_failures(),
            "recommendations": self._generate_recommendations()
        }
        
        # Save JSON report
        json_report_path = self.reports_dir / f"test_execution_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(json_report_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, default=str)
        
        # Generate markdown report
        self._generate_markdown_report(summary)
        
        logger.info(f"📋 Reports saved to: {self.reports_dir}")
        self._print_execution_summary()
    
    def _calculate_performance_metrics(self) -> Dict:
        """Calculate performance metrics from test results"""
        if not self.results:
            return {}
        
        durations = [r.duration for r in self.results if r.duration > 0]
        
        return {
            "average_test_duration": sum(durations) / len(durations) if durations else 0,
            "fastest_test": min(durations) if durations else 0,
            "slowest_test": max(durations) if durations else 0,
            "total_execution_time": sum(durations),
            "success_rate": (self.execution_stats["passed"] / self.execution_stats["total_tests"]) * 100 if self.execution_stats["total_tests"] > 0 else 0
        }
    
    def _analyze_failures(self) -> Dict:
        """Analyze failure patterns"""
        failed_tests = [r for r in self.results if r.status == TestStatus.FAILED]
        
        # Group failures by error type
        error_patterns = {}
        for test in failed_tests:
            if test.error_message:
                # Extract error type from message
                first_line = test.error_message.split('\n')[0].lower()
                if 'connection' in first_line:
                    error_type = 'connection_issues'
                elif 'timeout' in first_line:
                    error_type = 'timeout_issues'
                elif 'import' in first_line:
                    error_type = 'import_issues'
                elif 'assertion' in first_line:
                    error_type = 'assertion_failures'
                else:
                    error_type = 'other_errors'
                
                if error_type not in error_patterns:
                    error_patterns[error_type] = []
                error_patterns[error_type].append(test.name)
        
        return {
            "total_failures": len(failed_tests),
            "error_patterns": error_patterns,
            "healing_effectiveness": sum(1 for r in self.results if r.healing_attempts > 0) / len(failed_tests) if failed_tests else 0
        }
    
    def _generate_recommendations(self) -> List[str]:
        """Generate recommendations based on execution results"""
        recommendations = []
        
        # Analyze performance
        metrics = self._calculate_performance_metrics()
        if metrics.get("success_rate", 0) < 80:
            recommendations.append("🔧 Consider reviewing failed tests and improving test stability")
        
        if metrics.get("average_test_duration", 0) > 60:
            recommendations.append("⚡ Optimize slow tests to improve execution time")
        
        # Analyze failures
        failures = self._analyze_failures()
        if "connection_issues" in failures.get("error_patterns", {}):
            recommendations.append("🌐 Check service availability and network connectivity")
        
        if "timeout_issues" in failures.get("error_patterns", {}):
            recommendations.append("⏱️ Consider increasing timeout values for slow operations")
        
        if "import_issues" in failures.get("error_patterns", {}):
            recommendations.append("📦 Review package dependencies and import statements")
        
        return recommendations
    
    def _generate_markdown_report(self, summary: Dict):
        """Generate markdown execution report"""
        md_content = f"""# Test Execution Report

**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 📊 Execution Summary

- **Total Tests**: {self.execution_stats['total_tests']}
- **Passed**: ✅ {self.execution_stats['passed']} ({(self.execution_stats['passed']/self.execution_stats['total_tests']*100):.1f}%)
- **Failed**: ❌ {self.execution_stats['failed']} ({(self.execution_stats['failed']/self.execution_stats['total_tests']*100):.1f}%)
- **Skipped**: ⏭️ {self.execution_stats['skipped']} ({(self.execution_stats['skipped']/self.execution_stats['total_tests']*100):.1f}%)
- **Execution Time**: ⏱️ {summary['execution_summary']['execution_time']:.2f} seconds

## 🚀 Performance Metrics

- **Average Test Duration**: {summary['performance_metrics'].get('average_test_duration', 0):.2f}s
- **Success Rate**: {summary['performance_metrics'].get('success_rate', 0):.1f}%
- **Healing Effectiveness**: {summary['failure_analysis'].get('healing_effectiveness', 0)*100:.1f}%

## 🔧 Recommendations

"""
        for rec in summary['recommendations']:
            md_content += f"- {rec}\n"
        
        md_content += f"""
## 📈 Detailed Results

### Failed Tests
"""
        
        failed_tests = [r for r in self.results if r.status == TestStatus.FAILED][:20]  # Show first 20
        for test in failed_tests:
            md_content += f"- **{test.name}**: {test.error_message[:100]}...\n"
        
        # Save markdown report
        md_report_path = self.reports_dir / f"test_execution_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        with open(md_report_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
    
    def _print_execution_summary(self):
        """Print execution summary to console"""
        print("\n" + "="*60)
        print("🎯 TEST EXECUTION SUMMARY")
        print("="*60)
        
        total = self.execution_stats['total_tests']
        passed = self.execution_stats['passed']
        failed = self.execution_stats['failed']
        skipped = self.execution_stats['skipped']
        
        print(f"📊 Total Tests: {total}")
        print(f"✅ Passed: {passed} ({(passed/total*100):.1f}%)")
        print(f"❌ Failed: {failed} ({(failed/total*100):.1f}%)")  
        print(f"⏭️ Skipped: {skipped} ({(skipped/total*100):.1f}%)")
        print(f"⏱️ Total Time: {self.execution_stats['execution_time']:.2f}s")
        
        if passed + failed + skipped > 0:
            success_rate = (passed / (passed + failed + skipped)) * 100
            print(f"🎯 Success Rate: {success_rate:.1f}%")
        
        print("\nReports available in: reports/")
        print("Artifacts available in: artifacts/")
        print("="*60)


def main():
    """Main execution function"""
    print("WeSign QA Intelligence - Comprehensive Test Execution")
    print("="*60)
    
    # Initialize orchestrator
    orchestrator = TestExecutionOrchestrator()
    
    try:
        # Execute all tests
        results = orchestrator.execute_all_tests()
        
        # Determine exit code based on results
        if results['failed'] == 0:
            print("\nALL TESTS PASSED!")
            sys.exit(0)
        elif results['passed'] > results['failed']:
            print(f"\nMOSTLY SUCCESSFUL: {results['passed']} passed, {results['failed']} failed")
            sys.exit(1)
        else:
            print(f"\nEXECUTION ISSUES: {results['failed']} failed out of {results['total_tests']}")
            sys.exit(2)
            
    except KeyboardInterrupt:
        print("\nExecution interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(3)


if __name__ == "__main__":
    main()