#!/usr/bin/env python3
"""
Simple QA Intelligence System Validation
Validates all components without Unicode issues
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime
from pathlib import Path
import subprocess
import sys

class SystemValidator:
    def __init__(self):
        self.frontend_url = "http://localhost:3000"
        self.backend_url = "http://localhost:8081"
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "components": {},
            "validation_summary": {}
        }
    
    async def validate_backend(self):
        """Validate backend health"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.backend_url}/health") as resp:
                    if resp.status == 200:
                        health_data = await resp.json()
                        self.results["components"]["backend"] = {
                            "status": "healthy",
                            "agents": health_data.get("agents", 0),
                            "tests": health_data.get("tests", 0)
                        }
                        return True
                    else:
                        self.results["components"]["backend"] = {"status": "failed", "code": resp.status}
                        return False
        except Exception as e:
            self.results["components"]["backend"] = {"status": "error", "error": str(e)}
            return False
    
    async def validate_frontend(self):
        """Validate frontend accessibility"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.frontend_url) as resp:
                    if resp.status == 200:
                        self.results["components"]["frontend"] = {"status": "accessible"}
                        return True
                    else:
                        self.results["components"]["frontend"] = {"status": "failed", "code": resp.status}
                        return False
        except Exception as e:
            self.results["components"]["frontend"] = {"status": "error", "error": str(e)}
            return False
    
    async def validate_tests(self):
        """Validate test discovery"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.backend_url}/api/tests") as resp:
                    if resp.status == 200:
                        tests = await resp.json()
                        count = len(tests) if isinstance(tests, list) else tests.get("total", 0)
                        self.results["components"]["tests"] = {"status": "working", "count": count}
                        return True
                    else:
                        self.results["components"]["tests"] = {"status": "failed", "code": resp.status}
                        return False
        except Exception as e:
            self.results["components"]["tests"] = {"status": "error", "error": str(e)}
            return False
    
    def validate_wesign(self):
        """Validate WeSign integration"""
        try:
            wesign_dir = Path("C:/Users/gals/seleniumpythontests-1/playwright_tests/tests")
            if wesign_dir.exists():
                test_files = list(wesign_dir.rglob("test_*.py"))
                original_files = [f for f in test_files if "_converted" not in f.name]
                converted_files = [f for f in test_files if "_converted" in f.name]
                
                self.results["components"]["wesign"] = {
                    "status": "integrated",
                    "total_files": len(test_files),
                    "original_files": len(original_files),
                    "converted_files": len(converted_files)
                }
                return True
            else:
                self.results["components"]["wesign"] = {"status": "not_found"}
                return False
        except Exception as e:
            self.results["components"]["wesign"] = {"status": "error", "error": str(e)}
            return False
    
    def validate_allure(self):
        """Check for Allure reports"""
        allure_report = Path("allure-report")
        allure_results = Path("allure-results")
        
        if allure_report.exists() or allure_results.exists():
            self.results["components"]["allure"] = {
                "status": "available",
                "report_exists": allure_report.exists(),
                "results_exists": allure_results.exists()
            }
            return True
        else:
            self.results["components"]["allure"] = {"status": "not_found"}
            return False
    
    async def run_validation(self):
        """Run all validations"""
        print("Starting QA Intelligence System Validation...")
        print("=" * 50)
        
        validations = [
            ("Backend", self.validate_backend()),
            ("Frontend", self.validate_frontend()),
            ("Tests", self.validate_tests()),
            ("WeSign", self.validate_wesign()),
            ("Allure", self.validate_allure())
        ]
        
        results = []
        for name, validation in validations:
            print(f"Validating {name}...", end=" ")
            if asyncio.iscoroutine(validation):
                result = await validation
            else:
                result = validation
            
            status = "PASS" if result else "FAIL"
            print(status)
            results.append(result)
        
        # Summary
        working = sum(results)
        total = len(results)
        success_rate = (working / total) * 100
        
        self.results["validation_summary"] = {
            "working_components": working,
            "total_components": total,
            "success_rate": f"{success_rate:.1f}%",
            "overall_status": "healthy" if working >= total * 0.8 else "partial" if working > 0 else "failed"
        }
        
        print("\n" + "=" * 50)
        print("VALIDATION SUMMARY")
        print("=" * 50)
        print(f"Status: {self.results['validation_summary']['overall_status'].upper()}")
        print(f"Success Rate: {self.results['validation_summary']['success_rate']}")
        print(f"Working: {working}/{total} components")
        
        # Save results
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"system_validation_{timestamp}.json"
        with open(filename, 'w') as f:
            json.dump(self.results, f, indent=2)
        
        print(f"\nDetailed report: {filename}")
        
        return self.results["validation_summary"]["overall_status"] == "healthy"

async def main():
    validator = SystemValidator()
    success = await validator.run_validation()
    
    if success:
        print("\nSYSTEM STATUS: FULLY OPERATIONAL!")
        return 0
    else:
        print("\nSYSTEM STATUS: NEEDS ATTENTION")
        return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))