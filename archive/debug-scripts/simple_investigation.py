"""
ULTRA DETAILED DASHBOARD AND TEST BANK INVESTIGATION
Real-Data, Test-First, Zero-Mock Investigation Script
"""

import asyncio
from playwright.async_api import async_playwright, Page, BrowserContext
import json
import os
from datetime import datetime
import time

class UltraDetailedInvestigator:
    def __init__(self):
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.evidence_dir = f"artifacts/screenshots"
        self.results_dir = "artifacts/reports"
        self.results = {
            "timestamp": self.timestamp,
            "frontend_url": "http://localhost:5180",
            "backend_url": "http://localhost:8080",
            "demo_credentials": {"email": "admin@demo.com", "password": "demo123"},
            "dashboard_analysis": {},
            "test_bank_analysis": {},
            "api_analysis": {},
            "errors": [],
            "fix_plans": {}
        }
        os.makedirs(self.evidence_dir, exist_ok=True)
        os.makedirs(self.results_dir, exist_ok=True)
        
    async def capture_screenshot(self, page: Page, name: str, description: str = ""):
        """Capture screenshot with descriptive naming"""
        filepath = f"{self.evidence_dir}/ultra_{name}_{self.timestamp}.png"
        await page.screenshot(path=filepath, full_page=True)
        print(f"[SCREENSHOT] Captured screenshot: {filepath} - {description}")
        return filepath
        
    async def capture_network_logs(self, page: Page):
        """Capture network requests and responses"""
        network_logs = []
        
        def log_request(request):
            network_logs.append({
                "type": "request",
                "url": request.url,
                "method": request.method,
                "headers": dict(request.headers),
                "timestamp": datetime.now().isoformat()
            })
            
        def log_response(response):
            network_logs.append({
                "type": "response", 
                "url": response.url,
                "status": response.status,
                "headers": dict(response.headers),
                "timestamp": datetime.now().isoformat()
            })
            
        page.on("request", log_request)
        page.on("response", log_response)
        return network_logs
        
    async def capture_console_logs(self, page: Page):
        """Capture all console messages"""
        console_logs = []
        
        def log_console(msg):
            console_logs.append({
                "type": msg.type,
                "text": msg.text,
                "location": msg.location,
                "timestamp": datetime.now().isoformat()
            })
            print(f"[CONSOLE] {msg.type}: {msg.text}")
            
        page.on("console", log_console)
        return console_logs
        
    async def analyze_page_errors(self, page: Page):
        """Capture page errors and exceptions"""
        page_errors = []
        
        def log_error(error):
            error_info = {
                "message": str(error),
                "timestamp": datetime.now().isoformat()
            }
            page_errors.append(error_info)
            print(f"[ERROR] Page Error: {error}")
            
        page.on("pageerror", log_error)
        return page_errors
        
    async def check_element_exists(self, page: Page, selector: str, timeout: int = 3000):
        """Check if element exists without throwing error"""
        try:
            await page.wait_for_selector(selector, timeout=timeout)
            return True
        except:
            return False
            
    async def get_element_details(self, page: Page, selector: str):
        """Get detailed information about an element"""
        try:
            element = page.locator(selector).first
            if await element.count() > 0:
                return {
                    "exists": True,
                    "visible": await element.is_visible(),
                    "enabled": await element.is_enabled(),
                    "text": await element.text_content(),
                    "inner_html": await element.inner_html()
                }
        except Exception as e:
            return {"exists": False, "error": str(e)}
        return {"exists": False}
        
    async def test_authentication_flow(self, page: Page):
        """Test authentication with demo credentials"""
        print("\n[AUTH] TESTING AUTHENTICATION FLOW")
        
        auth_results = {
            "login_success": False,
            "dashboard_accessible": False,
            "test_bank_accessible": False,
            "errors": []
        }
        
        try:
            # Go to login page
            print("[NAV] Navigating to login page...")
            await page.goto("http://localhost:5180/login")
            await page.wait_for_timeout(2000)
            await self.capture_screenshot(page, "00_login_page", "Login page initial state")
            
            # Fill credentials
            email_selector = "input[type='email'], input[name='email'], #email"
            password_selector = "input[type='password'], input[name='password'], #password"
            
            if await self.check_element_exists(page, email_selector):
                await page.fill(email_selector, "admin@demo.com")
                print("[AUTH] Email filled")
            else:
                auth_results["errors"].append("Email input not found")
                
            if await self.check_element_exists(page, password_selector):
                await page.fill(password_selector, "demo123")
                print("[AUTH] Password filled")
            else:
                auth_results["errors"].append("Password input not found")
                
            await self.capture_screenshot(page, "00_login_filled", "Login form filled")
            
            # Submit form
            login_button = "button[type='submit'], .btn-login, button:has-text('Login')"
            if await self.check_element_exists(page, login_button):
                await page.click(login_button)
                print("[AUTH] Login button clicked")
                
                # Wait for redirect
                await page.wait_for_timeout(5000)
                await self.capture_screenshot(page, "00_after_login", "After login attempt")
                
                # Check if on dashboard
                current_url = page.url
                if "dashboard" in current_url or current_url == "http://localhost:5180/":
                    auth_results["login_success"] = True
                    auth_results["dashboard_accessible"] = True
                    print("[AUTH] Login successful - redirected to dashboard")
                else:
                    print(f"[AUTH] Login may have failed - current URL: {current_url}")
                    
            else:
                auth_results["errors"].append("Login button not found")
                
        except Exception as e:
            auth_results["errors"].append(f"Authentication error: {str(e)}")
            print(f"[ERROR] Authentication error: {str(e)}")
            
        return auth_results
        
    async def investigate_dashboard_deep(self, page: Page):
        """Ultra detailed Dashboard investigation"""
        print("\n[DASHBOARD] STARTING DASHBOARD ULTRA INVESTIGATION")
        
        dashboard_analysis = {
            "url": "http://localhost:5180/dashboard",
            "components": {},
            "api_calls": [],
            "errors": [],
            "dom_structure": {},
            "data_flow": {}
        }
        
        # Navigate to dashboard
        print("[NAV] Navigating to Dashboard...")
        try:
            await page.goto("http://localhost:5180/dashboard")
            await page.wait_for_timeout(3000)
            await self.capture_screenshot(page, "01_dashboard_initial", "Dashboard initial load")
            
            # Check if properly loaded
            title = await page.title()
            dashboard_analysis["page_title"] = title
            print(f"[INFO] Page title: {title}")
            
            # Get full page HTML for analysis
            page_content = await page.content()
            dashboard_analysis["page_size"] = len(page_content)
            
            # Check main dashboard components
            main_selectors = [
                "main",
                ".dashboard-container", 
                "[data-testid='dashboard']",
                ".grid",
                ".card",
                "h1, h2, h3",
                ".stat",
                ".chart-container",
                "#root",
                "[data-reactroot]"
            ]
            
            for selector in main_selectors:
                details = await self.get_element_details(page, selector)
                dashboard_analysis["components"][selector] = details
                print(f"[CHECK] {selector}: {'FOUND' if details['exists'] else 'MISSING'}")
                
            # Check for loading states
            loading_indicators = [
                ".loading",
                ".spinner", 
                "[data-testid='loading']",
                ".skeleton",
                ".animate-pulse"
            ]
            
            for selector in loading_indicators:
                exists = await self.check_element_exists(page, selector, 1000)
                dashboard_analysis["components"][f"loading_{selector}"] = exists
                if exists:
                    print(f"[LOADING] Loading indicator found: {selector}")
                    
            # Check for error messages
            error_selectors = [
                ".error",
                ".alert-error",
                "[role='alert']",
                ".text-red-500",
                ".text-danger",
                ".alert"
            ]
            
            for selector in error_selectors:
                details = await self.get_element_details(page, selector)
                if details["exists"]:
                    dashboard_analysis["errors"].append({
                        "selector": selector,
                        "text": details["text"],
                        "html": details["inner_html"]
                    })
                    print(f"[ERROR] Error element found: {selector} - {details['text']}")
                    
            # Wait longer and capture final state
            await page.wait_for_timeout(5000)
            await self.capture_screenshot(page, "02_dashboard_detailed", "Dashboard after detailed analysis")
            
        except Exception as e:
            error_msg = f"Dashboard navigation error: {str(e)}"
            dashboard_analysis["errors"].append(error_msg)
            print(f"[ERROR] {error_msg}")
            await self.capture_screenshot(page, "02_dashboard_error", "Dashboard error state")
            
        return dashboard_analysis
        
    async def investigate_test_bank_deep(self, page: Page):
        """Ultra detailed Test Bank investigation"""
        print("\n[TESTBANK] STARTING TEST BANK ULTRA INVESTIGATION")
        
        test_bank_analysis = {
            "url": "http://localhost:5180/test-bank",
            "components": {},
            "api_calls": [],
            "errors": [],
            "dom_structure": {},
            "data_flow": {}
        }
        
        # Navigate to test bank
        print("[NAV] Navigating to Test Bank...")
        try:
            await page.goto("http://localhost:5180/test-bank")
            await page.wait_for_timeout(3000)
            await self.capture_screenshot(page, "03_testbank_initial", "Test Bank initial load")
            
            # Check if properly loaded
            title = await page.title()
            test_bank_analysis["page_title"] = title
            print(f"[INFO] Page title: {title}")
            
            # Get full page HTML for analysis
            page_content = await page.content()
            test_bank_analysis["page_size"] = len(page_content)
            
            # Check main test bank components
            main_selectors = [
                "main",
                ".test-bank-container",
                "[data-testid='test-bank']",
                ".test-grid",
                ".test-card",
                ".search-bar",
                ".filter-controls",
                "table",
                ".pagination",
                "#root",
                "[data-reactroot]"
            ]
            
            for selector in main_selectors:
                details = await self.get_element_details(page, selector)
                test_bank_analysis["components"][selector] = details
                print(f"[CHECK] {selector}: {'FOUND' if details['exists'] else 'MISSING'}")
                
            # Check for test bank specific elements
            test_specific_selectors = [
                "button[title*='Create']",
                "button[title*='Run']",
                ".test-suite-builder",
                ".test-categories",
                ".test-status",
                "input[placeholder*='search']"
            ]
            
            for selector in test_specific_selectors:
                details = await self.get_element_details(page, selector)
                test_bank_analysis["components"][f"test_{selector}"] = details
                print(f"[CHECK] Test-specific {selector}: {'FOUND' if details['exists'] else 'MISSING'}")
                
            # Check for error messages
            error_selectors = [
                ".error",
                ".alert-error", 
                "[role='alert']",
                ".text-red-500",
                ".text-danger",
                ".alert"
            ]
            
            for selector in error_selectors:
                details = await self.get_element_details(page, selector)
                if details["exists"]:
                    test_bank_analysis["errors"].append({
                        "selector": selector,
                        "text": details["text"],
                        "html": details["inner_html"]
                    })
                    print(f"[ERROR] Error element found: {selector} - {details['text']}")
                    
            # Wait longer and capture final state
            await page.wait_for_timeout(5000)
            await self.capture_screenshot(page, "04_testbank_detailed", "Test Bank after detailed analysis")
            
        except Exception as e:
            error_msg = f"Test Bank navigation error: {str(e)}"
            test_bank_analysis["errors"].append(error_msg)
            print(f"[ERROR] {error_msg}")
            await self.capture_screenshot(page, "04_testbank_error", "Test Bank error state")
            
        return test_bank_analysis
        
    async def run_investigation(self):
        """Run the complete ultra detailed investigation"""
        print("[INVESTIGATION] STARTING ULTRA DETAILED INVESTIGATION")
        print("=" * 60)
        
        async with async_playwright() as p:
            # Launch browser with detailed options
            browser = await p.chromium.launch(
                headless=False,  # Show browser for better debugging
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-first-run",
                    "--disable-extensions",
                    "--disable-default-apps"
                ]
            )
            
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            
            page = await context.new_page()
            
            # Set up monitoring
            network_logs = await self.capture_network_logs(page)
            console_logs = await self.capture_console_logs(page)
            page_errors = await self.analyze_page_errors(page)
            
            try:
                # Test authentication first
                auth_results = await self.test_authentication_flow(page)
                self.results["auth_test"] = auth_results
                
                # Proceed with page investigations regardless of auth
                # Investigate Dashboard
                dashboard_analysis = await self.investigate_dashboard_deep(page)
                self.results["dashboard_analysis"] = dashboard_analysis
                
                # Investigate Test Bank
                test_bank_analysis = await self.investigate_test_bank_deep(page)
                self.results["test_bank_analysis"] = test_bank_analysis
                    
            except Exception as e:
                self.results["errors"].append(f"Investigation error: {str(e)}")
                print(f"[ERROR] Investigation error: {str(e)}")
                
            finally:
                # Capture all logs
                self.results["network_logs"] = network_logs
                self.results["console_logs"] = console_logs 
                self.results["page_errors"] = page_errors
                
                await browser.close()
                
        # Save results
        results_file = f"{self.results_dir}/ultra_investigation_{self.timestamp}.json"
        with open(results_file, 'w') as f:
            json.dump(self.results, f, indent=2)
            
        print(f"\n[RESULTS] Investigation complete! Results saved to: {results_file}")
        return self.results

async def main():
    investigator = UltraDetailedInvestigator()
    results = await investigator.run_investigation()
    
    # Print summary
    print("\n" + "="*60)
    print("[SUMMARY] ULTRA DETAILED INVESTIGATION SUMMARY")
    print("="*60)
    
    print(f"[AUTH] Authentication: {'SUCCESS' if results.get('auth_test', {}).get('login_success') else 'FAILED'}")
    
    dashboard_errors = len(results.get('dashboard_analysis', {}).get('errors', []))
    test_bank_errors = len(results.get('test_bank_analysis', {}).get('errors', []))
    
    print(f"[DASHBOARD] Dashboard Errors: {dashboard_errors}")
    print(f"[TESTBANK] Test Bank Errors: {test_bank_errors}")
    print(f"[TOTAL] Total Errors: {len(results.get('errors', []))}")
    print(f"[CONSOLE] Console Messages: {len(results.get('console_logs', []))}")
    print(f"[NETWORK] Network Requests: {len(results.get('network_logs', []))}")

if __name__ == "__main__":
    asyncio.run(main())