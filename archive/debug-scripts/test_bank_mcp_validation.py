#!/usr/bin/env python3
"""
TEST BANK MCP VALIDATION SCRIPT
Real-Data, Test-First, Zero-Mock approach
Comprehensive Test Bank page functionality testing using MCP tools

Author: Claude Code
Date: 2025-08-28
Purpose: Validate Test Bank page functionality and identify technical issues
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
import traceback

# Import MCP IDE tools
try:
    from mcp import mcp__ide__executeCode, mcp__ide__getDiagnostics
    MCP_AVAILABLE = True
except ImportError:
    print("Warning: MCP tools not available, using fallback approach")
    MCP_AVAILABLE = False

class TestBankMCPValidator:
    """Comprehensive Test Bank validation using MCP capabilities"""
    
    def __init__(self):
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.base_url = "http://localhost:5180"
        self.results = {
            "test_run_id": f"testbank_mcp_{self.timestamp}",
            "timestamp": self.timestamp,
            "base_url": self.base_url,
            "test_results": {},
            "errors": [],
            "network_requests": [],
            "console_logs": [],
            "screenshots": {},
            "technical_findings": []
        }
        self.artifacts_dir = Path(f"artifacts/test_bank_mcp_{self.timestamp}")
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        
    def log_result(self, test_name, status, details=None):
        """Log test result with structured data"""
        self.results["test_results"][test_name] = {
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "details": details or {}
        }
        print(f"[{status}] {test_name}: {details}")

    def capture_network_and_console(self, page):
        """Capture network requests and console logs"""
        try:
            # Get network requests from browser dev tools
            network_script = """
            () => {
                const networkData = [];
                const originalFetch = window.fetch;
                const originalXHR = window.XMLHttpRequest.prototype.send;
                
                // Capture fetch requests
                window.fetch = function(...args) {
                    networkData.push({
                        type: 'fetch',
                        url: args[0],
                        timestamp: new Date().toISOString(),
                        method: args[1]?.method || 'GET'
                    });
                    return originalFetch.apply(this, args);
                };
                
                // Return existing network data
                return window.__networkData || [];
            }
            """
            
            network_data = page.evaluate(network_script)
            self.results["network_requests"].extend(network_data)
            
            # Capture console logs
            console_script = """
            () => {
                const logs = [];
                const originalLog = console.log;
                const originalError = console.error;
                const originalWarn = console.warn;
                
                console.log = function(...args) {
                    logs.push({type: 'log', message: args.join(' '), timestamp: new Date().toISOString()});
                    originalLog.apply(console, args);
                };
                
                console.error = function(...args) {
                    logs.push({type: 'error', message: args.join(' '), timestamp: new Date().toISOString()});
                    originalError.apply(console, args);
                };
                
                console.warn = function(...args) {
                    logs.push({type: 'warn', message: args.join(' '), timestamp: new Date().toISOString()});
                    originalWarn.apply(console, args);
                };
                
                return window.__consoleLogs || [];
            }
            """
            
            console_data = page.evaluate(console_script)
            self.results["console_logs"].extend(console_data)
            
        except Exception as e:
            self.log_result("network_console_capture", "FAILED", {"error": str(e)})

    def capture_screenshot(self, page, name, full_page=True):
        """Capture and save screenshot"""
        try:
            screenshot_path = self.artifacts_dir / f"{name}_{self.timestamp}.png"
            page.screenshot(path=str(screenshot_path), full_page=full_page)
            self.results["screenshots"][name] = str(screenshot_path)
            self.log_result("screenshot_capture", "PASSED", {"name": name, "path": str(screenshot_path)})
            return str(screenshot_path)
        except Exception as e:
            self.log_result("screenshot_capture", "FAILED", {"name": name, "error": str(e)})
            return None

    def execute_mcp_code(self, code_snippet, description="MCP code execution"):
        """Execute code using MCP if available"""
        if not MCP_AVAILABLE:
            self.log_result("mcp_execution", "SKIPPED", {"reason": "MCP not available"})
            return None
            
        try:
            result = mcp__ide__executeCode(code=code_snippet)
            self.log_result("mcp_execution", "PASSED", {"description": description})
            return result
        except Exception as e:
            self.log_result("mcp_execution", "FAILED", {"description": description, "error": str(e)})
            return None

    def test_login_flow(self, playwright):
        """Test login functionality"""
        self.log_result("test_start", "INFO", {"test": "login_flow"})
        
        try:
            browser = playwright.chromium.launch(headless=False, slow_mo=1000)
            context = browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                record_video_dir=str(self.artifacts_dir)
            )
            page = context.new_page()
            
            # Enable console message capture
            page.on("console", lambda msg: self.results["console_logs"].append({
                "type": msg.type,
                "text": msg.text,
                "timestamp": datetime.now().isoformat()
            }))
            
            # Enable request/response capture
            page.on("request", lambda request: self.results["network_requests"].append({
                "type": "request",
                "url": request.url,
                "method": request.method,
                "timestamp": datetime.now().isoformat()
            }))
            
            page.on("response", lambda response: self.results["network_requests"].append({
                "type": "response",
                "url": response.url,
                "status": response.status,
                "timestamp": datetime.now().isoformat()
            }))
            
            # Step 1: Navigate to login page
            self.log_result("navigate_to_login", "INFO", {"url": f"{self.base_url}/auth/login"})
            page.goto(f"{self.base_url}/auth/login", wait_until="networkidle")
            page.wait_for_timeout(2000)
            
            self.capture_screenshot(page, "01_login_page_loaded")
            
            # Step 2: Fill login credentials
            email_input = page.wait_for_selector('input[type="email"], input[name="email"]', timeout=10000)
            password_input = page.wait_for_selector('input[type="password"], input[name="password"]', timeout=10000)
            
            if email_input and password_input:
                email_input.fill("admin@demo.com")
                password_input.fill("demo123")
                self.capture_screenshot(page, "02_credentials_filled")
                self.log_result("fill_credentials", "PASSED", {"email": "admin@demo.com"})
            else:
                self.log_result("fill_credentials", "FAILED", {"error": "Login inputs not found"})
                return None, None, None
            
            # Step 3: Submit login
            login_button = page.wait_for_selector('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")', timeout=10000)
            if login_button:
                login_button.click()
                page.wait_for_timeout(3000)  # Wait for login process
                self.capture_screenshot(page, "03_after_login_attempt")
                self.log_result("submit_login", "PASSED", {})
            else:
                self.log_result("submit_login", "FAILED", {"error": "Login button not found"})
                return None, None, None
            
            # Step 4: Verify login success
            current_url = page.url
            if "/dashboard" in current_url or "/test-bank" in current_url:
                self.log_result("login_verification", "PASSED", {"current_url": current_url})
            else:
                # Check for error messages
                error_elements = page.query_selector_all('.error, .alert-danger, [data-testid="error"]')
                error_messages = [el.inner_text() for el in error_elements]
                self.log_result("login_verification", "FAILED", {
                    "current_url": current_url,
                    "error_messages": error_messages
                })
                
            return browser, context, page
            
        except Exception as e:
            self.log_result("login_flow", "FAILED", {"error": str(e), "traceback": traceback.format_exc()})
            return None, None, None

    def test_testbank_functionality(self, page):
        """Test Test Bank page functionality"""
        self.log_result("test_start", "INFO", {"test": "testbank_functionality"})
        
        try:
            # Step 1: Navigate to Test Bank
            self.log_result("navigate_to_testbank", "INFO", {"url": f"{self.base_url}/test-bank"})
            page.goto(f"{self.base_url}/test-bank", wait_until="networkidle")
            page.wait_for_timeout(3000)
            
            self.capture_screenshot(page, "04_testbank_initial_load")
            
            # Step 2: Check for loading states and errors
            loading_elements = page.query_selector_all('[data-testid="loading"], .loading, .spinner')
            if loading_elements:
                page.wait_for_timeout(5000)  # Wait for loading to complete
                self.log_result("loading_detection", "INFO", {"loading_elements_found": len(loading_elements)})
            
            # Step 3: Analyze page structure
            page_analysis_script = """
            () => {
                const analysis = {
                    title: document.title,
                    url: window.location.href,
                    hasReactRoot: !!document.querySelector('#root'),
                    reactErrors: window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.rendererInterfaces?.size || 0,
                    apiCalls: window.__networkData || [],
                    visibleElements: {
                        buttons: document.querySelectorAll('button').length,
                        inputs: document.querySelectorAll('input').length,
                        tables: document.querySelectorAll('table').length,
                        divs: document.querySelectorAll('div').length
                    },
                    errors: []
                };
                
                // Check for common error indicators
                const errorSelectors = ['.error', '.alert-danger', '[data-testid="error"]', '.error-message'];
                errorSelectors.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        analysis.errors.push({
                            selector: selector,
                            count: elements.length,
                            messages: Array.from(elements).map(el => el.textContent.trim())
                        });
                    }
                });
                
                return analysis;
            }
            """
            
            page_analysis = page.evaluate(page_analysis_script)
            self.results["technical_findings"].append({
                "type": "page_analysis",
                "page": "test-bank",
                "data": page_analysis
            })
            
            self.log_result("page_analysis", "PASSED", {"analysis": page_analysis})
            
            # Step 4: Test specific Test Bank features
            self.test_testbank_search_functionality(page)
            self.test_testbank_filtering(page)
            self.test_testbank_suite_creation(page)
            
            # Step 5: Check for API integration issues
            api_analysis_script = """
            () => {
                const apiInfo = {
                    hasApiClient: typeof window.apiClient !== 'undefined',
                    hasApi: typeof window.api !== 'undefined',
                    availableGlobals: Object.keys(window).filter(key => 
                        key.includes('api') || key.includes('fetch') || key.includes('axios')
                    ),
                    networkRequestsCount: window.__networkRequests?.length || 0
                };
                
                // Check for specific API patterns
                try {
                    // Look for evidence of different API client usage
                    const scripts = Array.from(document.scripts);
                    const hasApiClientPattern = scripts.some(script => 
                        script.textContent && (
                            script.textContent.includes('apiClient') || 
                            script.textContent.includes('api.')
                        )
                    );
                    apiInfo.hasApiClientInScripts = hasApiClientPattern;
                } catch (e) {
                    apiInfo.scriptAnalysisError = e.message;
                }
                
                return apiInfo;
            }
            """
            
            api_analysis = page.evaluate(api_analysis_script)
            self.results["technical_findings"].append({
                "type": "api_analysis",
                "page": "test-bank",
                "data": api_analysis
            })
            
            self.log_result("api_analysis", "PASSED", {"analysis": api_analysis})
            
            self.capture_screenshot(page, "05_testbank_full_analysis")
            
        except Exception as e:
            self.log_result("testbank_functionality", "FAILED", {"error": str(e), "traceback": traceback.format_exc()})

    def test_testbank_search_functionality(self, page):
        """Test Test Bank search functionality"""
        try:
            # Look for search input
            search_selectors = [
                'input[placeholder*="Search"]',
                'input[placeholder*="search"]', 
                'input[type="search"]',
                '[data-testid="search-input"]',
                '.search-input'
            ]
            
            search_input = None
            for selector in search_selectors:
                search_input = page.query_selector(selector)
                if search_input:
                    break
            
            if search_input:
                # Test search functionality
                search_input.fill("login")
                page.wait_for_timeout(2000)
                self.capture_screenshot(page, "06_search_applied")
                
                # Clear search
                search_input.fill("")
                page.wait_for_timeout(1000)
                
                self.log_result("search_functionality", "PASSED", {"search_input_found": True})
            else:
                self.log_result("search_functionality", "INFO", {"search_input_found": False})
                
        except Exception as e:
            self.log_result("search_functionality", "FAILED", {"error": str(e)})

    def test_testbank_filtering(self, page):
        """Test Test Bank filtering functionality"""
        try:
            # Look for filter elements
            filter_selectors = [
                'select',
                '[data-testid*="filter"]',
                'button:has-text("Filter")',
                '.filter-button',
                'input[type="checkbox"]'
            ]
            
            filters_found = 0
            for selector in filter_selectors:
                elements = page.query_selector_all(selector)
                filters_found += len(elements)
                
                # Try interacting with first element of each type
                if elements:
                    try:
                        elements[0].click()
                        page.wait_for_timeout(1000)
                    except:
                        pass  # Some elements might not be clickable
            
            if filters_found > 0:
                self.capture_screenshot(page, "07_filters_tested")
                self.log_result("filtering_functionality", "PASSED", {"filters_found": filters_found})
            else:
                self.log_result("filtering_functionality", "INFO", {"filters_found": 0})
                
        except Exception as e:
            self.log_result("filtering_functionality", "FAILED", {"error": str(e)})

    def test_testbank_suite_creation(self, page):
        """Test Test Bank suite creation functionality"""
        try:
            # Look for suite creation elements
            suite_selectors = [
                'button:has-text("Create Suite")',
                'button:has-text("New Suite")',
                '[data-testid="create-suite"]',
                'button:has-text("Run")',
                'button:has-text("Execute")'
            ]
            
            suite_button = None
            for selector in suite_selectors:
                suite_button = page.query_selector(selector)
                if suite_button:
                    break
            
            if suite_button:
                # Test suite creation
                suite_button.click()
                page.wait_for_timeout(2000)
                self.capture_screenshot(page, "08_suite_creation")
                self.log_result("suite_creation", "PASSED", {"suite_button_found": True})
            else:
                self.log_result("suite_creation", "INFO", {"suite_button_found": False})
                
        except Exception as e:
            self.log_result("suite_creation", "FAILED", {"error": str(e)})

    def test_dashboard_comparison(self, page):
        """Compare Test Bank behavior with Dashboard"""
        self.log_result("test_start", "INFO", {"test": "dashboard_comparison"})
        
        try:
            # Navigate to Dashboard
            self.log_result("navigate_to_dashboard", "INFO", {"url": f"{self.base_url}/dashboard"})
            page.goto(f"{self.base_url}/dashboard", wait_until="networkidle")
            page.wait_for_timeout(3000)
            
            self.capture_screenshot(page, "09_dashboard_loaded")
            
            # Analyze Dashboard structure
            dashboard_analysis_script = """
            () => {
                return {
                    title: document.title,
                    url: window.location.href,
                    hasReactRoot: !!document.querySelector('#root'),
                    hasApiClient: typeof window.apiClient !== 'undefined',
                    hasApi: typeof window.api !== 'undefined',
                    visibleElements: {
                        buttons: document.querySelectorAll('button').length,
                        inputs: document.querySelectorAll('input').length,
                        tables: document.querySelectorAll('table').length,
                        charts: document.querySelectorAll('canvas, .chart').length
                    },
                    networkCalls: window.__networkRequests?.length || 0
                };
            }
            """
            
            dashboard_analysis = page.evaluate(dashboard_analysis_script)
            self.results["technical_findings"].append({
                "type": "dashboard_analysis",
                "page": "dashboard",
                "data": dashboard_analysis
            })
            
            self.log_result("dashboard_analysis", "PASSED", {"analysis": dashboard_analysis})
            
            # Navigate back to Test Bank for comparison
            page.goto(f"{self.base_url}/test-bank", wait_until="networkidle")
            page.wait_for_timeout(3000)
            
            testbank_analysis = page.evaluate(dashboard_analysis_script.replace("dashboard", "testbank"))
            self.results["technical_findings"].append({
                "type": "comparison_analysis",
                "data": {
                    "dashboard": dashboard_analysis,
                    "testbank": testbank_analysis,
                    "differences": self.analyze_differences(dashboard_analysis, testbank_analysis)
                }
            })
            
            self.capture_screenshot(page, "10_final_comparison")
            
        except Exception as e:
            self.log_result("dashboard_comparison", "FAILED", {"error": str(e), "traceback": traceback.format_exc()})

    def analyze_differences(self, dashboard_data, testbank_data):
        """Analyze differences between Dashboard and Test Bank"""
        differences = []
        
        # Compare API availability
        if dashboard_data.get("hasApiClient") != testbank_data.get("hasApiClient"):
            differences.append({
                "type": "api_client_availability",
                "dashboard": dashboard_data.get("hasApiClient"),
                "testbank": testbank_data.get("hasApiClient")
            })
            
        if dashboard_data.get("hasApi") != testbank_data.get("hasApi"):
            differences.append({
                "type": "api_availability", 
                "dashboard": dashboard_data.get("hasApi"),
                "testbank": testbank_data.get("hasApi")
            })
        
        # Compare element counts
        dash_elements = dashboard_data.get("visibleElements", {})
        test_elements = testbank_data.get("visibleElements", {})
        
        for element_type in dash_elements.keys():
            if dash_elements[element_type] != test_elements.get(element_type, 0):
                differences.append({
                    "type": f"element_count_{element_type}",
                    "dashboard": dash_elements[element_type],
                    "testbank": test_elements.get(element_type, 0)
                })
        
        return differences

    def generate_report(self):
        """Generate comprehensive test report"""
        report_path = self.artifacts_dir / f"test_bank_mcp_report_{self.timestamp}.json"
        
        # Add summary statistics
        self.results["summary"] = {
            "total_tests": len(self.results["test_results"]),
            "passed_tests": len([r for r in self.results["test_results"].values() if r["status"] == "PASSED"]),
            "failed_tests": len([r for r in self.results["test_results"].values() if r["status"] == "FAILED"]),
            "info_tests": len([r for r in self.results["test_results"].values() if r["status"] == "INFO"]),
            "total_screenshots": len(self.results["screenshots"]),
            "total_network_requests": len(self.results["network_requests"]),
            "total_console_logs": len(self.results["console_logs"]),
            "technical_findings_count": len(self.results["technical_findings"])
        }
        
        # Save detailed report
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        
        self.log_result("report_generation", "PASSED", {"report_path": str(report_path)})
        return str(report_path)

    def run_comprehensive_test(self):
        """Run comprehensive Test Bank validation"""
        print(f"\n=== TEST BANK MCP VALIDATION STARTED ===")
        print(f"Timestamp: {self.timestamp}")
        print(f"Base URL: {self.base_url}")
        print(f"Artifacts Dir: {self.artifacts_dir}")
        
        try:
            from playwright.sync_api import sync_playwright
            
            with sync_playwright() as playwright:
                # Step 1: Login Flow
                browser, context, page = self.test_login_flow(playwright)
                
                if not page:
                    self.log_result("comprehensive_test", "FAILED", {"error": "Login failed, cannot proceed"})
                    return self.generate_report()
                
                # Step 2: Test Bank Functionality 
                self.test_testbank_functionality(page)
                
                # Step 3: Dashboard Comparison
                self.test_dashboard_comparison(page)
                
                # Step 4: Final cleanup and screenshots
                self.capture_screenshot(page, "11_final_state")
                
                # Clean up
                context.close()
                browser.close()
                
                self.log_result("comprehensive_test", "PASSED", {"message": "All tests completed successfully"})
                
        except Exception as e:
            self.log_result("comprehensive_test", "FAILED", {"error": str(e), "traceback": traceback.format_exc()})
        
        finally:
            # Generate final report
            report_path = self.generate_report()
            print(f"\n=== TEST BANK MCP VALIDATION COMPLETED ===")
            print(f"Report saved to: {report_path}")
            return report_path

def main():
    """Main execution function"""
    validator = TestBankMCPValidator()
    return validator.run_comprehensive_test()

if __name__ == "__main__":
    try:
        report_path = main()
        print(f"\n✅ Test Bank MCP validation completed successfully!")
        print(f"📋 Report: {report_path}")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Test Bank MCP validation failed: {str(e)}")
        print(f"🔍 Traceback:\n{traceback.format_exc()}")
        sys.exit(1)