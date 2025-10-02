#!/usr/bin/env python3
"""
Comprehensive Validation Suite for Smoke Test Module
Tests all components: API, UI, Reports, Error Handling
"""
import requests
import json
import time
import os
from pathlib import Path

class SmokeTestValidator:
    def __init__(self):
        self.backend_url = "http://localhost:8081"
        self.frontend_url = "http://localhost:3000"
        self.results = []
        
    def log_result(self, test_name, status, details=""):
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        self.results.append(result)
        status_mark = "[PASS]" if status == "PASS" else "[FAIL]" if status == "FAIL" else "[WARN]"
        print(f"{status_mark} {test_name}: {status} - {details}")
        
    def test_backend_health(self):
        """Test backend API health and availability"""
        try:
            response = requests.get(f"{self.backend_url}/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_result("Backend Health Check", "PASS", f"Version: {data.get('version')}")
                else:
                    self.log_result("Backend Health Check", "FAIL", "Status not healthy")
            else:
                self.log_result("Backend Health Check", "FAIL", f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("Backend Health Check", "FAIL", str(e))
            
    def test_frontend_availability(self):
        """Test frontend availability"""
        try:
            response = requests.get(self.frontend_url, timeout=10)
            if response.status_code == 200:
                self.log_result("Frontend Availability", "PASS", "Frontend accessible")
            else:
                self.log_result("Frontend Availability", "FAIL", f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("Frontend Availability", "FAIL", str(e))
            
    def test_pytest_api_endpoint(self):
        """Test the main pytest execution API"""
        try:
            payload = {
                "testFile": "tests/auth/test_login_converted.py::TestLogin::test_login_with_valid_credentials_success"
            }
            response = requests.post(
                f"{self.backend_url}/api/execute/pytest",
                json=payload,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                execution_id = data.get("executionId")
                if execution_id:
                    self.log_result("Pytest API Endpoint", "PASS", f"Execution ID: {execution_id}")
                    return execution_id
                else:
                    self.log_result("Pytest API Endpoint", "FAIL", "No execution ID returned")
            else:
                self.log_result("Pytest API Endpoint", "FAIL", f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("Pytest API Endpoint", "FAIL", str(e))
        return None
        
    def test_execution_status_api(self, execution_id):
        """Test execution status API"""
        if not execution_id:
            self.log_result("Execution Status API", "SKIP", "No execution ID available")
            return
            
        try:
            response = requests.get(
                f"{self.backend_url}/api/execute/status/{execution_id}",
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                status = data.get("status")
                self.log_result("Execution Status API", "PASS", f"Status: {status}")
                return data
            else:
                self.log_result("Execution Status API", "FAIL", f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("Execution Status API", "FAIL", str(e))
        return None
        
    def test_artifacts_generation(self, execution_data):
        """Test that artifacts are properly generated"""
        if not execution_data:
            self.log_result("Artifacts Generation", "SKIP", "No execution data available")
            return
            
        artifacts = execution_data.get("artifacts", {})
        artifacts_dir = artifacts.get("directory")
        
        if not artifacts_dir:
            self.log_result("Artifacts Generation", "FAIL", "No artifacts directory found")
            return
            
        # Check if artifacts directory exists
        if os.path.exists(artifacts_dir):
            files_found = []
            
            # Check for key artifact files
            expected_files = {
                "junit.xml": artifacts.get("junit"),
                "report.html": artifacts.get("html"),
                "allure-results": artifacts.get("allureResults")
            }
            
            for file_type, file_path in expected_files.items():
                if file_path and os.path.exists(file_path):
                    files_found.append(file_type)
                    
            if files_found:
                self.log_result("Artifacts Generation", "PASS", f"Found: {', '.join(files_found)}")
            else:
                self.log_result("Artifacts Generation", "FAIL", "No artifact files found")
        else:
            self.log_result("Artifacts Generation", "FAIL", "Artifacts directory does not exist")
            
    def test_working_test_files(self):
        """Test that working test files are syntactically valid"""
        test_dir = Path("C:/Users/gals/seleniumpythontests-1/playwright_tests/tests")
        working_files = [
            "auth/test_login_converted.py",
            "documents/test_document_editing_converted.py", 
            "documents/test_document_management_converted.py",
            "signing/test_advanced_others_signing_converted.py",
            "signing/test_comprehensive_others_signing_converted.py",
            "signing/test_comprehensive_self_signing_converted.py"
        ]
        
        valid_files = 0
        for file_path in working_files:
            full_path = test_dir / file_path
            if full_path.exists():
                try:
                    import ast
                    with open(full_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    ast.parse(content)
                    valid_files += 1
                except Exception as e:
                    self.log_result(f"Syntax Check: {file_path}", "FAIL", str(e))
                    continue
                    
        if valid_files == len(working_files):
            self.log_result("Working Test Files", "PASS", f"All {valid_files} files have valid syntax")
        else:
            self.log_result("Working Test Files", "WARN", f"{valid_files}/{len(working_files)} files valid")
            
    def test_broken_files_isolated(self):
        """Test that broken files are properly isolated"""
        broken_dir = Path("C:/Users/gals/seleniumpythontests-1/playwright_tests/tests_broken")
        
        if broken_dir.exists():
            broken_files = list(broken_dir.rglob("*_converted.py"))
            if broken_files:
                self.log_result("Broken Files Isolation", "PASS", f"{len(broken_files)} files isolated")
            else:
                self.log_result("Broken Files Isolation", "WARN", "No broken files found in isolation")
        else:
            self.log_result("Broken Files Isolation", "FAIL", "Broken files directory does not exist")
            
    def test_api_error_handling(self):
        """Test API error handling"""
        # Test invalid payload
        try:
            response = requests.post(
                f"{self.backend_url}/api/execute/pytest",
                json={"invalid": "payload"},
                timeout=5
            )
            
            if response.status_code in [400, 422]:  # Expected error codes
                self.log_result("API Error Handling", "PASS", "Properly handles invalid requests")
            else:
                self.log_result("API Error Handling", "WARN", f"Unexpected response: {response.status_code}")
        except Exception as e:
            self.log_result("API Error Handling", "FAIL", str(e))
            
    def test_reports_endpoint(self):
        """Test reports summary endpoint"""
        try:
            response = requests.get(f"{self.backend_url}/api/reports/summary", timeout=5)
            if response.status_code == 200:
                data = response.json()
                executions = data.get("executions", [])
                self.log_result("Reports Endpoint", "PASS", f"Found {len(executions)} execution records")
            else:
                self.log_result("Reports Endpoint", "FAIL", f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("Reports Endpoint", "FAIL", str(e))
            
    def generate_validation_report(self):
        """Generate comprehensive validation report"""
        total_tests = len(self.results)
        passed_tests = len([r for r in self.results if r["status"] == "PASS"])
        failed_tests = len([r for r in self.results if r["status"] == "FAIL"])
        warnings = len([r for r in self.results if r["status"] == "WARN"])
        
        print("\n" + "="*60)
        print("🎯 SMOKE TEST MODULE VALIDATION REPORT")
        print("="*60)
        print(f"📊 SUMMARY:")
        print(f"   Total Tests: {total_tests}")
        print(f"   ✅ Passed: {passed_tests}")
        print(f"   ❌ Failed: {failed_tests}")
        print(f"   ⚠️  Warnings: {warnings}")
        print(f"   🎯 Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        print(f"\n📋 DETAILED RESULTS:")
        for result in self.results:
            status_emoji = "✅" if result["status"] == "PASS" else "❌" if result["status"] == "FAIL" else "⚠️"
            print(f"   {status_emoji} {result['test']}: {result['status']} - {result['details']}")
            
        # Overall assessment
        if failed_tests == 0:
            if warnings == 0:
                assessment = "🟢 EXCELLENT - All systems fully operational"
            else:
                assessment = "🟡 GOOD - Minor issues detected but functionality intact"
        elif failed_tests <= 2:
            assessment = "🟠 MODERATE - Some issues need attention"
        else:
            assessment = "🔴 CRITICAL - Multiple failures require immediate attention"
            
        print(f"\n🎯 OVERALL ASSESSMENT: {assessment}")
        print("="*60)
        
        return {
            "total": total_tests,
            "passed": passed_tests, 
            "failed": failed_tests,
            "warnings": warnings,
            "success_rate": (passed_tests/total_tests)*100,
            "assessment": assessment,
            "details": self.results
        }
        
    def run_full_validation(self):
        """Run complete validation suite"""
        print("🚀 Starting Comprehensive Smoke Test Module Validation")
        print("="*60)
        
        # Core functionality tests
        self.test_backend_health()
        self.test_frontend_availability()
        execution_id = self.test_pytest_api_endpoint()
        
        # Give the execution a moment to start
        if execution_id:
            time.sleep(2)
            execution_data = self.test_execution_status_api(execution_id)
            self.test_artifacts_generation(execution_data)
            
        # File system tests
        self.test_working_test_files()
        self.test_broken_files_isolated()
        
        # Additional API tests
        self.test_api_error_handling()
        self.test_reports_endpoint()
        
        # Generate final report
        return self.generate_validation_report()

if __name__ == "__main__":
    validator = SmokeTestValidator()
    report = validator.run_full_validation()
    
    # Save report to file
    with open("validation_report.json", "w") as f:
        json.dump(report, f, indent=2)
        
    print(f"\n📄 Detailed report saved to: validation_report.json")