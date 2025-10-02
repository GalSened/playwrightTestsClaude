#!/usr/bin/env python3
"""
Playwright Smart Dashboard - Simple Authentication Flow Test
"""

import asyncio
import json
import time
from playwright.async_api import async_playwright
from datetime import datetime

async def test_dashboard():
    """Test the complete authentication flow"""
    print("Starting Playwright Dashboard Test")
    print("=" * 50)
    
    results = {
        'login_successful': False,
        'dashboard_accessible': False,
        'api_calls_made': False,
        'test_runs_endpoint': False,
        'analytics_endpoint': False,
        'console_errors': 0,
        'network_requests': [],
        'console_messages': []
    }
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, devtools=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Monitor network and console
        def handle_request(request):
            results['network_requests'].append({
                'url': request.url,
                'method': request.method
            })
        
        def handle_response(response):
            results['network_requests'].append({
                'type': 'response',
                'url': response.url,
                'status': response.status
            })
        
        def handle_console(msg):
            results['console_messages'].append({
                'type': msg.type,
                'text': msg.text
            })
        
        page.on('request', handle_request)
        page.on('response', handle_response)
        page.on('console', handle_console)
        
        try:
            print("\nSTEP 1: Testing Login Flow")
            print("-" * 30)
            
            # Navigate to login page
            print("Navigating to login page...")
            await page.goto('http://localhost:5180/auth/login')
            await page.wait_for_load_state('networkidle')
            await page.screenshot(path='login_page.png')
            print("Login page loaded")
            
            # Fill credentials
            email_field = page.locator('input[type="email"]')
            password_field = page.locator('input[type="password"]')
            
            await email_field.fill('admin@demo.com')
            await password_field.fill('demo123')
            print("Credentials filled")
            
            # Click login
            login_btn = page.locator('button[type="submit"]')
            await login_btn.click()
            print("Login button clicked")
            
            # Wait for redirect
            await asyncio.sleep(3)
            current_url = page.url
            print(f"Current URL: {current_url}")
            
            if '/auth/login' not in current_url:
                results['login_successful'] = True
                print("SUCCESS: Login successful")
            else:
                print("FAILED: Still on login page")
                await page.screenshot(path='login_failed.png')
            
            print("\nSTEP 2: Testing Dashboard Access")
            print("-" * 30)
            
            # Go to dashboard
            if current_url != 'http://localhost:5180/':
                await page.goto('http://localhost:5180/')
            
            await page.wait_for_load_state('networkidle', timeout=15000)
            await page.screenshot(path='dashboard.png')
            results['dashboard_accessible'] = True
            print("Dashboard loaded")
            
            print("\nSTEP 3: Waiting for API calls...")
            print("-" * 30)
            
            # Wait for API calls
            await asyncio.sleep(5)
            
            # Analyze network requests
            api_requests = [r for r in results['network_requests'] if '/api/' in r.get('url', '')]
            test_runs_calls = [r for r in api_requests if '/api/test-runs' in r.get('url', '')]
            analytics_calls = [r for r in api_requests if '/api/analytics' in r.get('url', '')]
            
            results['api_calls_made'] = len(api_requests) > 0
            results['test_runs_endpoint'] = len(test_runs_calls) > 0
            results['analytics_endpoint'] = len(analytics_calls) > 0
            
            print(f"Total API calls: {len(api_requests)}")
            print(f"Test runs calls: {len(test_runs_calls)}")
            print(f"Analytics calls: {len(analytics_calls)}")
            
            # Show some API calls
            if test_runs_calls:
                print("Test runs API calls:")
                for call in test_runs_calls[:3]:
                    print(f"  {call.get('method', 'GET')} {call.get('url', 'unknown')}")
            
            if analytics_calls:
                print("Analytics API calls:")
                for call in analytics_calls[:3]:
                    print(f"  {call.get('method', 'GET')} {call.get('url', 'unknown')}")
            
            print("\nSTEP 4: Console Analysis")
            print("-" * 30)
            
            error_messages = [m for m in results['console_messages'] if m['type'] in ['error', 'warning']]
            results['console_errors'] = len(error_messages)
            
            print(f"Total console messages: {len(results['console_messages'])}")
            print(f"Errors/warnings: {len(error_messages)}")
            
            if error_messages:
                print("Console errors:")
                for msg in error_messages[:5]:
                    print(f"  [{msg['type']}] {msg['text'][:100]}")
            
            print("\nSTEP 5: Final Screenshot")
            print("-" * 30)
            await page.screenshot(path='final_dashboard.png', full_page=True)
            print("Final screenshot taken")
            
        except Exception as e:
            print(f"Test failed: {e}")
            await page.screenshot(path='error.png')
        
        print("\nTEST SUMMARY")
        print("=" * 50)
        
        checks = [
            ('Login successful', results['login_successful']),
            ('Dashboard accessible', results['dashboard_accessible']),
            ('API calls made', results['api_calls_made']),
            ('Test runs endpoint', results['test_runs_endpoint']),
            ('Analytics endpoint', results['analytics_endpoint']),
            ('No console errors', results['console_errors'] == 0)
        ]
        
        passed = sum(1 for _, result in checks if result)
        total = len(checks)
        
        print(f"Overall: {passed}/{total} checks passed")
        print()
        
        for description, result in checks:
            status = "PASS" if result else "FAIL"
            print(f"{description}: {status}")
        
        # Wait for manual inspection
        print(f"\nPress Enter to close browser...")
        input()
        
        await browser.close()
        
        # Save results
        with open('test_results.json', 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        print("Results saved to test_results.json")
        return results

if __name__ == "__main__":
    asyncio.run(test_dashboard())