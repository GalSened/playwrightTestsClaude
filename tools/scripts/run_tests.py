#!/usr/bin/env python3
"""
WeSign Test Runner
Comprehensive test execution script for WeSign test suite with multiple execution modes
"""
import argparse
import subprocess
import sys
import os
import json
from pathlib import Path
from datetime import datetime
from typing import List, Optional


class WeSignTestRunner:
    """Test runner for WeSign test suite"""
    
    def __init__(self):
        self.base_dir = Path(__file__).parent
        self.artifacts_dir = self.base_dir / "artifacts"
        self.reports_dir = self.base_dir / "reports"
        
        # Ensure directories exist
        self.artifacts_dir.mkdir(exist_ok=True)
        self.reports_dir.mkdir(exist_ok=True)
        (self.artifacts_dir / "logs").mkdir(exist_ok=True)
        (self.artifacts_dir / "allure-results").mkdir(exist_ok=True)
    
    def run_command(self, cmd: List[str], timeout: int = 1800) -> int:
        """Execute command with timeout and logging"""
        print(f"Executing: {' '.join(cmd)}")
        try:
            result = subprocess.run(
                cmd,
                capture_output=False,
                timeout=timeout,
                cwd=self.base_dir
            )
            return result.returncode
        except subprocess.TimeoutExpired:
            print(f"Command timed out after {timeout} seconds")
            return 1
        except Exception as e:
            print(f"Error executing command: {e}")
            return 1
    
    def build_pytest_command(self, args: argparse.Namespace) -> List[str]:
        """Build pytest command based on arguments"""
        cmd = ["python", "-m", "pytest"]
        
        # Add basic options
        if args.verbose:
            cmd.extend(["-v", "-s"])
        
        # Add markers
        if args.markers:
            cmd.extend(["-m", args.markers])
        
        # Add language filter
        if args.language and args.language != "both":
            cmd.extend(["--language", args.language])
        
        # Add browser options
        if args.headless:
            cmd.append("--headless")
        
        if args.slow_mo:
            cmd.extend(["--slow-mo", str(args.slow_mo)])
        
        # Add parallel execution
        if args.parallel > 1:
            cmd.extend(["-n", str(args.parallel)])
        
        # Add specific test files or directories
        if args.test_files:
            cmd.extend(args.test_files)
        else:
            cmd.append("tests/")
        
        # Add report generation
        if args.allure:
            cmd.extend(["--alluredir", str(self.artifacts_dir / "allure-results")])
        
        if args.html:
            cmd.extend(["--html", str(self.reports_dir / "report.html")])
        
        if args.json:
            cmd.extend(["--json-report", "--json-report-file", 
                       str(self.reports_dir / "report.json")])
        
        return cmd
    
    def run_smoke_tests(self) -> int:
        """Run smoke tests"""
        print("\n=== Running Smoke Tests ===")
        cmd = [
            "python", "-m", "pytest",
            "-m", "smoke",
            "-v",
            "--tb=short",
            "--maxfail=5",
            f"--alluredir={self.artifacts_dir / 'allure-results'}",
            "tests/"
        ]
        return self.run_command(cmd, timeout=600)
    
    def run_regression_tests(self) -> int:
        """Run full regression test suite"""
        print("\n=== Running Full Regression Tests ===")
        cmd = [
            "python", "-m", "pytest",
            "-m", "regression",
            "-v",
            "--tb=short",
            f"--alluredir={self.artifacts_dir / 'allure-results'}",
            f"--html={self.reports_dir / 'regression_report.html'}",
            "tests/"
        ]
        return self.run_command(cmd, timeout=3600)
    
    def run_bilingual_tests(self) -> int:
        """Run bilingual tests (English and Hebrew)"""
        print("\n=== Running Bilingual Tests ===")
        cmd = [
            "python", "-m", "pytest",
            "-m", "bilingual",
            "-v",
            "--tb=short",
            f"--alluredir={self.artifacts_dir / 'allure-results'}",
            "tests/"
        ]
        return self.run_command(cmd, timeout=1800)
    
    def run_performance_tests(self) -> int:
        """Run performance tests"""
        print("\n=== Running Performance Tests ===")
        cmd = [
            "python", "-m", "pytest",
            "-m", "performance",
            "-v",
            "--tb=short",
            "--benchmark-json", str(self.reports_dir / "benchmark.json"),
            f"--alluredir={self.artifacts_dir / 'allure-results'}",
            "tests/"
        ]
        return self.run_command(cmd, timeout=2400)
    
    def run_upload_tests(self) -> int:
        """Run upload functionality tests"""
        print("\n=== Running Upload Tests ===")
        cmd = [
            "python", "-m", "pytest",
            "-m", "upload",
            "-v",
            "--tb=short",
            f"--alluredir={self.artifacts_dir / 'allure-results'}",
            "tests/test_wesign_upload_functionality.py"
        ]
        return self.run_command(cmd)
    
    def run_merge_tests(self) -> int:
        """Run merge functionality tests"""
        print("\n=== Running Merge Tests ===")
        cmd = [
            "python", "-m", "pytest",
            "-m", "merge",
            "-v",
            "--tb=short",
            f"--alluredir={self.artifacts_dir / 'allure-results'}",
            "tests/test_wesign_merge_functionality.py"
        ]
        return self.run_command(cmd)
    
    def run_send_tests(self) -> int:
        """Run assign and send functionality tests"""
        print("\n=== Running Assign & Send Tests ===")
        cmd = [
            "python", "-m", "pytest",
            "-m", "send",
            "-v",
            "--tb=short",
            f"--alluredir={self.artifacts_dir / 'allure-results'}",
            "tests/test_wesign_assign_send_functionality.py"
        ]
        return self.run_command(cmd)
    
    def generate_allure_report(self) -> int:
        """Generate Allure HTML report"""
        print("\n=== Generating Allure Report ===")
        
        # Check if allure results exist
        allure_results = self.artifacts_dir / "allure-results"
        if not allure_results.exists() or not list(allure_results.glob("*")):
            print("No Allure results found. Run tests first.")
            return 1
        
        # Generate report
        allure_report_dir = self.reports_dir / "allure-report"
        cmd = [
            "allure", "generate",
            str(allure_results),
            "-o", str(allure_report_dir),
            "--clean"
        ]
        
        result = self.run_command(cmd, timeout=300)
        
        if result == 0:
            print(f"Allure report generated at: {allure_report_dir / 'index.html'}")
        
        return result
    
    def serve_allure_report(self) -> int:
        """Serve Allure report"""
        print("\n=== Serving Allure Report ===")
        
        allure_report_dir = self.reports_dir / "allure-report"
        if not allure_report_dir.exists():
            print("Allure report not found. Generate report first.")
            return 1
        
        cmd = ["allure", "serve", str(self.artifacts_dir / "allure-results")]
        return self.run_command(cmd)
    
    def clean_artifacts(self):
        """Clean test artifacts"""
        print("\n=== Cleaning Test Artifacts ===")
        
        import shutil
        
        cleanup_dirs = [
            self.artifacts_dir / "screenshots",
            self.artifacts_dir / "videos", 
            self.artifacts_dir / "traces",
            self.artifacts_dir / "allure-results",
            self.artifacts_dir / "logs",
            self.reports_dir
        ]
        
        for dir_path in cleanup_dirs:
            if dir_path.exists():
                shutil.rmtree(dir_path)
                print(f"Cleaned: {dir_path}")
        
        # Recreate directories
        for dir_path in cleanup_dirs:
            dir_path.mkdir(parents=True, exist_ok=True)
    
    def install_dependencies(self) -> int:
        """Install required dependencies"""
        print("\n=== Installing Dependencies ===")
        
        # Install Python dependencies
        result = self.run_command([
            "pip", "install", "-r", "requirements.txt"
        ], timeout=600)
        
        if result != 0:
            return result
        
        # Install Playwright browsers
        result = self.run_command([
            "playwright", "install", "chromium"
        ], timeout=600)
        
        return result
    
    def validate_environment(self) -> bool:
        """Validate test environment"""
        print("\n=== Validating Environment ===")
        
        # Check settings.json exists
        settings_file = self.base_dir / "settings .json"
        if not settings_file.exists():
            print(f"ERROR: Settings file not found: {settings_file}")
            return False
        
        # Check required directories exist
        required_dirs = ["tests", "pages", "config", "utils"]
        for dir_name in required_dirs:
            dir_path = self.base_dir / dir_name
            if not dir_path.exists():
                print(f"ERROR: Required directory not found: {dir_path}")
                return False
        
        # Check Python version
        if sys.version_info < (3, 8):
            print(f"ERROR: Python 3.8+ required. Current: {sys.version}")
            return False
        
        print("Environment validation passed!")
        return True


def create_parser() -> argparse.ArgumentParser:
    """Create command line argument parser"""
    parser = argparse.ArgumentParser(
        description="WeSign Test Runner - Comprehensive test execution for WeSign functionality",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --smoke                    # Run smoke tests only
  %(prog)s --regression              # Run full regression suite  
  %(prog)s --bilingual               # Run bilingual tests
  %(prog)s --upload                  # Run upload tests only
  %(prog)s --merge                   # Run merge tests only
  %(prog)s --send                    # Run assign & send tests only
  %(prog)s --performance             # Run performance tests
  %(prog)s --language hebrew         # Run tests in Hebrew only
  %(prog)s --markers "smoke and not slow"  # Run with custom markers
  %(prog)s --parallel 4              # Run tests in parallel
  %(prog)s --generate-report         # Generate Allure report
  %(prog)s --serve-report            # Serve Allure report
  %(prog)s --clean                   # Clean test artifacts
        """
    )
    
    # Test execution modes
    test_group = parser.add_argument_group('Test Execution')
    test_group.add_argument('--smoke', action='store_true', 
                           help='Run smoke tests only')
    test_group.add_argument('--regression', action='store_true',
                           help='Run full regression test suite')
    test_group.add_argument('--bilingual', action='store_true',
                           help='Run bilingual tests (English and Hebrew)')
    test_group.add_argument('--performance', action='store_true',
                           help='Run performance tests')
    test_group.add_argument('--upload', action='store_true',
                           help='Run upload functionality tests')
    test_group.add_argument('--merge', action='store_true',
                           help='Run merge functionality tests')
    test_group.add_argument('--send', action='store_true',
                           help='Run assign and send functionality tests')
    
    # Test configuration
    config_group = parser.add_argument_group('Test Configuration')
    config_group.add_argument('--language', choices=['english', 'hebrew', 'both'],
                             default='both', help='Language to test')
    config_group.add_argument('--markers', type=str,
                             help='Pytest markers expression (e.g., "smoke and not slow")')
    config_group.add_argument('--parallel', type=int, default=1,
                             help='Number of parallel workers')
    config_group.add_argument('--headless', action='store_true',
                             help='Run tests in headless mode')
    config_group.add_argument('--slow-mo', type=int, default=0,
                             help='Slow down operations by milliseconds')
    
    # Reporting options
    report_group = parser.add_argument_group('Reporting')
    report_group.add_argument('--allure', action='store_true', default=True,
                             help='Generate Allure results (default: True)')
    report_group.add_argument('--html', action='store_true',
                             help='Generate HTML report')
    report_group.add_argument('--json', action='store_true',
                             help='Generate JSON report')
    report_group.add_argument('--generate-report', action='store_true',
                             help='Generate Allure HTML report')
    report_group.add_argument('--serve-report', action='store_true',
                             help='Serve Allure report in browser')
    
    # Utility options
    util_group = parser.add_argument_group('Utilities')
    util_group.add_argument('--install-deps', action='store_true',
                           help='Install required dependencies')
    util_group.add_argument('--clean', action='store_true',
                           help='Clean test artifacts')
    util_group.add_argument('--validate', action='store_true',
                           help='Validate test environment')
    
    # Advanced options
    advanced_group = parser.add_argument_group('Advanced')
    advanced_group.add_argument('--test-files', nargs='+',
                               help='Specific test files to run')
    advanced_group.add_argument('--verbose', '-v', action='store_true',
                               help='Verbose output')
    
    return parser


def main():
    """Main entry point"""
    parser = create_parser()
    args = parser.parse_args()
    
    runner = WeSignTestRunner()
    
    # Handle utility commands first
    if args.install_deps:
        return runner.install_dependencies()
    
    if args.clean:
        runner.clean_artifacts()
        return 0
    
    if args.validate:
        return 0 if runner.validate_environment() else 1
    
    if args.generate_report:
        return runner.generate_allure_report()
    
    if args.serve_report:
        return runner.serve_allure_report()
    
    # Validate environment before running tests
    if not runner.validate_environment():
        return 1
    
    # Determine which tests to run
    exit_code = 0
    
    if args.smoke:
        exit_code = runner.run_smoke_tests()
    elif args.regression:
        exit_code = runner.run_regression_tests()
    elif args.bilingual:
        exit_code = runner.run_bilingual_tests()
    elif args.performance:
        exit_code = runner.run_performance_tests()
    elif args.upload:
        exit_code = runner.run_upload_tests()
    elif args.merge:
        exit_code = runner.run_merge_tests()
    elif args.send:
        exit_code = runner.run_send_tests()
    else:
        # Run custom pytest command
        cmd = runner.build_pytest_command(args)
        exit_code = runner.run_command(cmd)
    
    # Generate report after test execution
    if exit_code == 0 and args.allure:
        print("\n=== Generating Final Report ===")
        runner.generate_allure_report()
    
    return exit_code


if __name__ == "__main__":
    sys.exit(main())