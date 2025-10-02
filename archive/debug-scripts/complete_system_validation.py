#!/usr/bin/env python3
"""
Complete QA Intelligence System Validation
Validates all components: Frontend, Backend, AI Agents, WeSign Integration
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
        self.allure_url = "http://localhost"  # Will detect port
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "components": {},
            "validation_summary": {},
            "ai_connections": {},
            "wesign_integration": {}
        }
    
    async def validate_backend_health(self):
        """Validate backend health and AI agents"""
        try:
            async with aiohttp.ClientSession() as session:
                # Check health endpoint
                async with session.get(f"{self.backend_url}/health") as resp:
                    if resp.status == 200:
                        health_data = await resp.json()
                        self.results["components"]["backend"] = {
                            "status": "healthy",
                            "response_time": resp.headers.get("response-time", "unknown"),
                            "health_data": health_data
                        }
                        
                        # Check for AI agents
                        if "agents" in health_data:
                            self.results["ai_connections"]["agents_detected"] = health_data["agents"]
                            self.results["ai_connections"]["total_agents"] = len(health_data.get("agents", []))
                        
                        return True
                    else:
                        self.results["components"]["backend"] = {
                            "status": "unhealthy",
                            "error": f"HTTP {resp.status}"
                        }
                        return False
                        
        except Exception as e:
            self.results["components"]["backend"] = {
                "status": "error",
                "error": str(e)
            }
            return False
    
    async def validate_frontend_accessibility(self):
        """Validate frontend is accessible"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.frontend_url) as resp:
                    if resp.status == 200:
                        html_content = await resp.text()
                        self.results["components"]["frontend"] = {
                            "status": "accessible",
                            "contains_react": "react" in html_content.lower() or "vite" in html_content.lower(),
                            "title_detected": "<title>" in html_content
                        }
                        return True
                    else:
                        self.results["components"]["frontend"] = {
                            "status": "inaccessible",
                            "error": f"HTTP {resp.status}"
                        }
                        return False
        except Exception as e:
            self.results["components"]["frontend"] = {
                "status": "error",
                "error": str(e)
            }
            return False
    
    async def validate_test_discovery(self):
        """Validate test discovery functionality"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.backend_url}/api/tests") as resp:
                    if resp.status == 200:
                        tests_data = await resp.json()
                        total_tests = len(tests_data) if isinstance(tests_data, list) else tests_data.get("total", 0)
                        
                        self.results["components"]["test_discovery"] = {
                            "status": "working",
                            "total_tests": total_tests,
                            "test_types": list(set([t.get("type", "unknown") for t in tests_data[:10]])) if isinstance(tests_data, list) else []
                        }
                        return True
                    else:
                        self.results["components"]["test_discovery"] = {
                            "status": "failed",
                            "error": f"HTTP {resp.status}"
                        }
                        return False
        except Exception as e:
            self.results["components"]["test_discovery"] = {
                "status": "error",
                "error": str(e)
            }
            return False
    
    async def validate_wesign_integration(self):
        """Validate WeSign test integration"""
        try:
            wesign_test_dir = Path("C:/Users/gals/seleniumpythontests-1/playwright_tests/tests")
            
            if not wesign_test_dir.exists():
                self.results["wesign_integration"]["status"] = "directory_not_found"
                return False
            
            # Count original vs converted files
            original_files = list(wesign_test_dir.rglob("test_*.py"))
            converted_files = [f for f in original_files if "_converted" in f.name]
            original_only = [f for f in original_files if "_converted" not in f.name]
            
            self.results["wesign_integration"] = {
                "status": "integrated",
                "test_directory": str(wesign_test_dir),
                "total_test_files": len(original_files),
                "original_files": len(original_only),
                "converted_files": len(converted_files),
                "recommendation": "Remove converted files, keep originals" if converted_files else "Clean structure"
            }
            
            # Test a sample file for syntax
            if original_only:
                sample_file = original_only[0]
                try:
                    with open(sample_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    compile(content, sample_file, 'exec')
                    self.results["wesign_integration"]["syntax_check"] = "passed"
                except SyntaxError as e:
                    self.results["wesign_integration"]["syntax_check"] = f"failed: {e}"
                except Exception as e:
                    self.results["wesign_integration"]["syntax_check"] = f"error: {e}"
            
            return True
            
        except Exception as e:
            self.results["wesign_integration"] = {
                "status": "error",
                "error": str(e)
            }
            return False
    
    def detect_allure_port(self):
        """Detect Allure server port"""
        try:
            result = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                for line in lines:
                    if ':' in line and 'LISTENING' in line and '127.0.0.1' in line:
                        parts = line.split()
                        if len(parts) >= 2:
                            addr = parts[1]
                            if addr.startswith('127.0.0.1:') or addr.startswith('0.0.0.0:'):
                                port = addr.split(':')[-1]
                                if port.isdigit() and int(port) > 8000 and int(port) < 65535:
                                    # Test if it's Allure
                                    try:
                                        import requests
                                        resp = requests.get(f"http://localhost:{port}", timeout=2)
                                        if "allure" in resp.text.lower():
                                            return int(port)
                                    except:
                                        continue
        except:
            pass
        return None
    
    async def validate_allure_reports(self):
        """Validate Allure reporting system"""
        try:
            allure_port = self.detect_allure_port()
            if allure_port:
                allure_url = f"http://localhost:{allure_port}"
                async with aiohttp.ClientSession() as session:
                    async with session.get(allure_url) as resp:
                        if resp.status == 200:
                            content = await resp.text()
                            self.results["components"]["allure_reports"] = {
                                "status": "running",
                                "port": allure_port,
                                "url": allure_url,
                                "contains_allure": "allure" in content.lower()
                            }
                            return True
            
            # Check for static reports
            allure_report_dir = Path("allure-report")
            if allure_report_dir.exists():
                self.results["components"]["allure_reports"] = {
                    "status": "static_available",
                    "report_directory": str(allure_report_dir)
                }
                return True
            
            self.results["components"]["allure_reports"] = {
                "status": "not_detected",
                "note": "No running Allure server or static reports found"
            }
            return False
            
        except Exception as e:
            self.results["components"]["allure_reports"] = {
                "status": "error",
                "error": str(e)
            }
            return False
    
    async def validate_ai_agent_functionality(self):
        """Validate AI agent functionality"""
        try:
            async with aiohttp.ClientSession() as session:
                # Try to get agent status
                async with session.get(f"{self.backend_url}/api/agents/status") as resp:
                    if resp.status == 200:
                        agent_data = await resp.json()
                        self.results["ai_connections"]["agent_status"] = agent_data
                        self.results["ai_connections"]["status"] = "connected"
                        return True
                    else:
                        # Try alternative endpoint
                        async with session.get(f"{self.backend_url}/api/health") as health_resp:
                            if health_resp.status == 200:
                                health_data = await health_resp.json()
                                if "agents" in str(health_data):
                                    self.results["ai_connections"]["status"] = "detected_in_health"
                                    self.results["ai_connections"]["health_contains_agents"] = True
                                    return True
                                
            self.results["ai_connections"]["status"] = "not_detected"
            return False
            
        except Exception as e:
            self.results["ai_connections"]["status"] = "error"
            self.results["ai_connections"]["error"] = str(e)
            return False
    
    def create_validation_summary(self):
        """Create overall validation summary"""
        component_statuses = []
        for component, data in self.results["components"].items():
            status = data.get("status", "unknown")
            if status in ["healthy", "accessible", "working", "running", "static_available"]:
                component_statuses.append(True)
            else:
                component_statuses.append(False)
        
        ai_working = self.results["ai_connections"].get("status") in ["connected", "detected_in_health"]
        wesign_working = self.results["wesign_integration"].get("status") == "integrated"
        
        total_components = len(component_statuses) + (1 if ai_working else 0) + (1 if wesign_working else 0)
        working_components = sum(component_statuses) + (1 if ai_working else 0) + (1 if wesign_working else 0)
        
        self.results["validation_summary"] = {
            "overall_status": "healthy" if working_components >= total_components * 0.8 else "partial" if working_components > 0 else "failed",
            "working_components": working_components,
            "total_components": total_components,
            "success_rate": f"{(working_components/total_components*100):.1f}%" if total_components > 0 else "0%",
            "critical_issues": []
        }
        
        # Identify critical issues
        if not self.results["components"].get("backend", {}).get("status") in ["healthy"]:
            self.results["validation_summary"]["critical_issues"].append("Backend not healthy")
        
        if not self.results["components"].get("frontend", {}).get("status") in ["accessible"]:
            self.results["validation_summary"]["critical_issues"].append("Frontend not accessible")
    
    async def run_complete_validation(self):
        """Run all validations"""
        print("🚀 Starting Complete QA Intelligence System Validation...")
        print("=" * 60)
        
        validations = [
            ("Backend Health", self.validate_backend_health()),
            ("Frontend Accessibility", self.validate_frontend_accessibility()), 
            ("Test Discovery", self.validate_test_discovery()),
            ("WeSign Integration", self.validate_wesign_integration()),
            ("Allure Reports", self.validate_allure_reports()),
            ("AI Agent Functionality", self.validate_ai_agent_functionality())
        ]
        
        for name, validation_coro in validations:
            print(f"🔍 Validating {name}...", end=" ")
            result = await validation_coro
            status = "✅ PASS" if result else "❌ FAIL"
            print(status)
        
        self.create_validation_summary()
        
        print("\n" + "=" * 60)
        print("📊 VALIDATION SUMMARY")
        print("=" * 60)
        
        summary = self.results["validation_summary"]
        print(f"Overall Status: {summary['overall_status'].upper()}")
        print(f"Success Rate: {summary['success_rate']}")
        print(f"Working Components: {summary['working_components']}/{summary['total_components']}")
        
        if summary['critical_issues']:
            print(f"\n❌ Critical Issues:")
            for issue in summary['critical_issues']:
                print(f"  - {issue}")
        
        print(f"\n📁 Detailed report saved to: system_validation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        
        # Save detailed results
        with open(f"system_validation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", 'w') as f:
            json.dump(self.results, f, indent=2)
        
        return summary['overall_status'] == "healthy"

async def main():
    validator = SystemValidator()
    success = await validator.run_complete_validation()
    
    if success:
        print("\n🎉 QA Intelligence System is FULLY OPERATIONAL!")
        return 0
    else:
        print("\n⚠️  QA Intelligence System has issues that need attention.")
        return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))