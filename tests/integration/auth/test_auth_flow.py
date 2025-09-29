#!/usr/bin/env python3
"""
Playwright Smart Dashboard - Complete Authentication Flow Test
Tests the complete authentication flow with detailed monitoring
"""

import asyncio
import json
import time
from playwright.async_api import async_playwright
from datetime import datetime

class DashboardTestRunner:
    def __init__(self):
        self.results = {
            'login_successful': False,
            'dashboard_accessible': False,
            'api_calls_made': False,
            'test_runs_endpoint': False,
            'analytics_endpoint': False,
            'console_errors': 0,
            'total_requests': 0,
            'network_requests': [],
            'console_messages': [],
            'screenshots_taken': []
        }
    
    async def run_test(self):
        """Run the complete authentication flow test"""
        print("Starting Playwright Smart Dashboard Authentication Test")
        print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        async with async_playwright() as p:
            # Launch browser with debugging enabled
            browser = await p.chromium.launch(
                headless=False, 
                devtools=True,
                args=['--start-maximized']
            )
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080}
            )
            
            page = await context.new_page()
            
            # Set up network and console monitoring
            await self.setup_monitoring(page)
            
            try:
                # Step 1: Test Login Flow
                await self.test_login_flow(page)
                
                # Step 2: Test Dashboard Access
                await self.test_dashboard_access(page)
                
                # Step 3: Monitor API Calls
                await self.analyze_api_calls()
                
                # Step 4: Check Console Errors
                await self.analyze_console_messages()
                
                # Step 5: Verify Dashboard Content
                await self.verify_dashboard_content(page)
                
                # Generate final summary
                await self.generate_summary()
                
            except Exception as e:
                print(f"❌ Test execution failed: {e}")
                await page.screenshot(path='test_execution_error.png')
                self.results['screenshots_taken'].append('test_execution_error.png')
            
            finally:
                print("\n⏳ Keeping browser open for 10 seconds for manual inspection...")
                await asyncio.sleep(10)
                await browser.close()
        
        return self.results
    
    async def setup_monitoring(self, page):
        """Set up network and console monitoring"""
        print("🔧 Setting up monitoring...")
        
        async def handle_request(request):
            self.results['network_requests'].append({
                'type': 'request',
                'url': request.url,
                'method': request.method,
                'headers': dict(request.headers),
                'timestamp': datetime.now().isoformat()
            })
        
        async def handle_response(response):
            try:
                self.results['network_requests'].append({
                    'type': 'response',
                    'url': response.url,
                    'status': response.status,
                    'status_text': response.status_text,
                    'headers': dict(response.headers),
                    'timestamp': datetime.now().isoformat()
                })
            except Exception as e:
                print(f"⚠️ Error handling response: {e}")
        
        async def handle_console(msg):
            self.results['console_messages'].append({
                'type': msg.type,
                'text': msg.text,
                'location': str(msg.location) if msg.location else None,
                'timestamp': datetime.now().isoformat()
            })
        
        page.on('request', handle_request)
        page.on('response', handle_response)
        page.on('console', handle_console)
        
        print("✅ Monitoring setup complete")
    
    async def test_login_flow(self, page):
        """Test the login flow"""
        print("\n📝 STEP 1: Testing Login Flow")
        print("-" * 40)
        
        try:
            # Navigate to login page
            print("🌐 Navigating to login page...")
            await page.goto('http://localhost:5180/auth/login')
            await page.wait_for_load_state('networkidle', timeout=10000)
            
            # Take screenshot of login page
            await page.screenshot(path='01_login_page.png')
            self.results['screenshots_taken'].append('01_login_page.png')
            print("✅ Login page loaded successfully")
            
            # Check for login form elements
            email_input = page.locator('input[type="email"]').or_(page.locator('input[name="email"]'))
            password_input = page.locator('input[type="password"]').or_(page.locator('input[name="password"]'))
            
            await email_input.wait_for(timeout=5000)
            print("✅ Found email input field")
            
            await password_input.wait_for(timeout=5000)
            print("✅ Found password input field")
            
            # Fill in demo credentials
            print("🔑 Filling in demo credentials...")
            await email_input.fill('admin@demo.com')
            await password_input.fill('demo123')
            
            # Find and click login button
            login_button = page.locator('button[type="submit"]').or_(
                page.locator('button:has-text("Login")').or_(
                    page.locator('button:has-text("Sign in")')
                )
            )
            
            await login_button.wait_for(timeout=5000)
            print("🖱️ Clicking login button...")
            await login_button.click()
            
            # Wait for authentication to complete
            print("⏳ Waiting for authentication...")
            await asyncio.sleep(3)
            
            # Check if redirected away from login page
            current_url = page.url
            print(f"📍 Current URL after login: {current_url}")
            
            if '/auth/login' not in current_url and 'localhost:5180' in current_url:
                print("✅ Successfully redirected after login")
                self.results['login_successful'] = True
            else:
                print("❌ Login may have failed - still on login page or unexpected location")
                await page.screenshot(path='02_login_failed.png')
                self.results['screenshots_taken'].append('02_login_failed.png')
                
        except Exception as e:
            print(f"❌ Login flow failed: {e}")
            await page.screenshot(path='02_login_error.png')
            self.results['screenshots_taken'].append('02_login_error.png')
    
    async def test_dashboard_access(self, page):
        """Test dashboard access"""
        print("\n🏠 STEP 2: Testing Dashboard Access")
        print("-" * 40)
        
        try:
            # Navigate to dashboard if not already there
            current_url = page.url
            if current_url != 'http://localhost:5180/':
                print("🌐 Navigating to dashboard...")
                await page.goto('http://localhost:5180/')
            
            # Wait for dashboard to load
            await page.wait_for_load_state('networkidle', timeout=15000)
            await page.screenshot(path='03_dashboard_loaded.png')
            self.results['screenshots_taken'].append('03_dashboard_loaded.png')
            print("✅ Dashboard page accessed")
            
            # Check for key dashboard elements
            dashboard_checks = [
                {'selector': 'h1, h2, [data-testid="dashboard-title"], .dashboard-title', 'name': 'Dashboard title'},
                {'selector': '[data-testid*="test"], .test-run, .test-summary', 'name': 'Test run content'},
                {'selector': '.analytics, [data-testid*="analytics"], .chart', 'name': 'Analytics content'},
                {'selector': 'nav, .navigation, [role="navigation"], .nav', 'name': 'Navigation'},
                {'selector': 'table, .table, .data-table', 'name': 'Data tables'},
                {'selector': '.card, [data-testid*="card"], .metric', 'name': 'Dashboard cards'}
            ]
            
            for check in dashboard_checks:
                try:
                    elements = page.locator(check['selector'])
                    count = await elements.count()
                    if count > 0:
                        print(f"✅ Found {count} {check['name']} element(s)")
                    else:
                        print(f"⚠️ {check['name']} not found")
                except Exception as e:
                    print(f"⚠️ Error checking {check['name']}: {e}")
            
            self.results['dashboard_accessible'] = True
            
        except Exception as e:
            print(f"❌ Dashboard access failed: {e}")
            await page.screenshot(path='03_dashboard_error.png')
            self.results['screenshots_taken'].append('03_dashboard_error.png')
    
    async def analyze_api_calls(self):
        """Analyze API calls made"""
        print("\n🔌 STEP 3: Analyzing API Calls")
        print("-" * 40)
        
        # Wait a bit more for API calls to complete
        await asyncio.sleep(3)
        
        # Filter network requests
        api_requests = [req for req in self.results['network_requests'] if '/api/' in req.get('url', '')]
        self.results['total_requests'] = len(self.results['network_requests'])
        self.results['api_calls_made'] = len(api_requests) > 0
        
        print(f"📊 Total network requests: {self.results['total_requests']}")
        print(f"📡 API requests: {len(api_requests)}")
        
        # Check for specific endpoints
        test_runs_calls = [req for req in api_requests if '/api/test-runs' in req.get('url', '')]
        analytics_calls = [req for req in api_requests if '/api/analytics' in req.get('url', '')]
        
        self.results['test_runs_endpoint'] = len(test_runs_calls) > 0
        self.results['analytics_endpoint'] = len(analytics_calls) > 0
        
        print(f"\n🧪 /api/test-runs calls: {len(test_runs_calls)}")
        if test_runs_calls:
            print("   Recent test-runs calls:")
            for call in test_runs_calls[:3]:
                method = call.get('method', 'unknown')
                url = call.get('url', 'unknown')
                status = call.get('status', 'pending')
                print(f"   - {method} {url} -> {status}")
        
        print(f"\n📈 /api/analytics calls: {len(analytics_calls)}")
        if analytics_calls:
            print("   Recent analytics calls:")
            for call in analytics_calls[:3]:
                method = call.get('method', 'unknown')
                url = call.get('url', 'unknown')
                status = call.get('status', 'pending')
                print(f"   - {method} {url} -> {status}")
        
        # Check for failed API calls
        failed_api_calls = [req for req in api_requests if 
                          'status' in req and req['status'] >= 400]
        
        if failed_api_calls:
            print(f"\n❌ Failed API calls ({len(failed_api_calls)}):")
            for call in failed_api_calls[:5]:
                print(f"   - {call.get('method')} {call.get('url')} -> {call.get('status')} {call.get('status_text')}")
        else:
            print("✅ No failed API calls detected")
    
    async def analyze_console_messages(self):
        """Analyze console messages"""
        print("\n🖥️ STEP 4: Analyzing Console Messages")
        print("-" * 40)
        
        error_messages = [msg for msg in self.results['console_messages'] 
                         if msg['type'] in ['error', 'warning']]
        self.results['console_errors'] = len(error_messages)
        
        print(f"📝 Total console messages: {len(self.results['console_messages'])}")
        print(f"⚠️ Error/Warning messages: {len(error_messages)}")
        
        if error_messages:
            print("\n🚨 Console errors/warnings:")
            for i, msg in enumerate(error_messages[:10], 1):  # Show first 10
                print(f"   {i}. [{msg['type'].upper()}] {msg['text'][:100]}{'...' if len(msg['text']) > 100 else ''}")
        else:
            print("✅ No console errors detected")
        
        # Show info messages summary
        info_messages = [msg for msg in self.results['console_messages'] 
                        if msg['type'] == 'log']
        print(f"ℹ️ Info messages: {len(info_messages)}")
    
    async def verify_dashboard_content(self, page):
        """Verify dashboard shows data content"""
        print("\n📊 STEP 5: Verifying Dashboard Content")
        print("-" * 40)
        
        try:
            # Take final comprehensive screenshot
            await page.screenshot(path='04_dashboard_final.png', full_page=True)
            self.results['screenshots_taken'].append('04_dashboard_final.png')
            
            # Check for error messages
            error_selectors = [
                'div:has-text("Error")',
                'div:has-text("Failed")',
                'div:has-text("Loading failed")',
                '.error',
                '[data-testid*="error"]',
                '.alert-error'
            ]
            
            errors_found = []
            for selector in error_selectors:
                try:
                    elements = page.locator(selector)
                    count = await elements.count()
                    if count > 0:
                        errors_found.append(f"{selector} ({count} elements)")
                except:
                    pass
            
            if errors_found:
                print(f"⚠️ Found potential error elements:")
                for error in errors_found:
                    print(f"   - {error}")
            else:
                print("✅ No obvious error messages in dashboard")
            
            # Check for loading states
            loading_selectors = [
                'div:has-text("Loading")',
                '.loading',
                '.spinner',
                '[data-testid*="loading"]'
            ]
            
            loading_found = []
            for selector in loading_selectors:
                try:
                    elements = page.locator(selector)
                    count = await elements.count()
                    if count > 0:
                        loading_found.append(f"{selector} ({count} elements)")
                except:
                    pass
            
            if loading_found:
                print(f"⏳ Found loading elements (might indicate ongoing requests):")
                for loading in loading_found:
                    print(f"   - {loading}")
            
            # Check for data content indicators
            data_indicators = [
                {'selector': 'table, .table, .data-table', 'name': 'Data tables'},
                {'selector': 'chart, .chart, svg', 'name': 'Charts/graphs'},
                {'selector': '[data-testid*="count"], .count, .metric, .number', 'name': 'Metrics/numbers'},
                {'selector': '.card, [data-testid*="card"], .dashboard-card', 'name': 'Dashboard cards'},
                {'selector': 'li, .list-item', 'name': 'List items'},
                {'selector': 'tr, .table-row', 'name': 'Table rows'}
            ]
            
            data_found = []
            for indicator in data_indicators:
                try:
                    elements = page.locator(indicator['selector'])
                    count = await elements.count()
                    if count > 0:
                        data_found.append(f"{indicator['name']}: {count}")
                        print(f"✅ Found {count} {indicator['name']}")
                except:
                    pass
            
            if data_found:
                print("✅ Dashboard appears to contain data content")
            else:
                print("⚠️ Limited data content visible in dashboard")
                
        except Exception as e:
            print(f"❌ Dashboard content verification failed: {e}")
    
    async def generate_summary(self):
        """Generate test summary"""
        print("\n📋 TEST SUMMARY")
        print("=" * 60)
        
        # Calculate success metrics
        total_checks = 6
        passed_checks = sum([
            self.results['login_successful'],
            self.results['dashboard_accessible'],
            self.results['api_calls_made'],
            self.results['test_runs_endpoint'],
            self.results['analytics_endpoint'],
            self.results['console_errors'] == 0
        ])
        
        success_rate = (passed_checks / total_checks) * 100
        
        print(f"📊 Overall Success Rate: {success_rate:.1f}% ({passed_checks}/{total_checks})")
        print(f"⏰ Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        # Detailed results
        results_display = [
            ('🔐 Login successful', self.results['login_successful']),
            ('🏠 Dashboard accessible', self.results['dashboard_accessible']),
            ('📡 API calls made', self.results['api_calls_made']),
            ('🧪 Test runs endpoint called', self.results['test_runs_endpoint']),
            ('📈 Analytics endpoint called', self.results['analytics_endpoint']),
            ('🖥️ Console errors', f"{self.results['console_errors']} errors" if self.results['console_errors'] > 0 else "No errors")
        ]
        
        print("📋 Detailed Results:")
        for description, result in results_display:
            if isinstance(result, bool):
                status = "✅ PASS" if result else "❌ FAIL"
            else:
                status = f"ℹ️ {result}"
            print(f"   {description}: {status}")
        
        print(f"\n📊 Network Activity:")
        print(f"   Total requests: {self.results['total_requests']}")
        print(f"   API requests: {len([r for r in self.results['network_requests'] if '/api/' in r.get('url', '')])}")
        
        if self.results['screenshots_taken']:
            print(f"\n📸 Screenshots taken:")
            for screenshot in self.results['screenshots_taken']:
                print(f"   - {screenshot}")
        
        # Final recommendation
        if success_rate >= 80:
            print(f"\n🎉 OVERALL: EXCELLENT - Dashboard authentication flow is working well!")
        elif success_rate >= 60:
            print(f"\n👍 OVERALL: GOOD - Minor issues detected, but core functionality works")
        else:
            print(f"\n⚠️ OVERALL: NEEDS ATTENTION - Significant issues detected")


async def main():
    """Main test execution function"""
    runner = DashboardTestRunner()
    results = await runner.run_test()
    
    # Save results to JSON file
    with open('test_results.json', 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\n💾 Detailed results saved to: test_results.json")
    return results

if __name__ == "__main__":
    asyncio.run(main())