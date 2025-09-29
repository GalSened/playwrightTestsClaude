#!/usr/bin/env python3
"""
Manual Authentication Flow Test - Simplified version to complete testing
"""

import time
from playwright.sync_api import sync_playwright

def manual_auth_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()
        
        try:
            print("=== MANUAL AUTHENTICATION FLOW TEST ===")
            
            # Test 1: Homepage Load
            print("\n1. Testing homepage load...")
            page.goto('http://localhost:5180', wait_until='networkidle')
            page.wait_for_timeout(2000)
            page.screenshot(path='test_evidence/manual_01_homepage.png', full_page=True)
            print(f"   Homepage Title: {page.title()}")
            print(f"   Current URL: {page.url}")
            
            # Test 2: Login Form
            print("\n2. Testing login form...")
            
            # Fill in demo credentials
            email_input = page.locator('input[placeholder*="you@company.com"]').first
            password_input = page.locator('input[type="password"]').first
            
            email_input.fill('admin@demo.com')
            password_input.fill('demo123')
            
            page.screenshot(path='test_evidence/manual_02_login_filled.png', full_page=True)
            
            # Click login
            login_button = page.locator('button:has-text("Sign In")').first
            login_button.click()
            
            # Wait for response
            page.wait_for_timeout(5000)
            page.screenshot(path='test_evidence/manual_03_after_login.png', full_page=True)
            
            print(f"   After login URL: {page.url}")
            
            # Test 3: Check for dashboard or redirect
            print("\n3. Checking post-login state...")
            
            # Try to access dashboard directly
            try:
                page.goto('http://localhost:5180/dashboard', wait_until='networkidle')
                page.wait_for_timeout(3000)
                page.screenshot(path='test_evidence/manual_04_dashboard.png', full_page=True)
                print(f"   Dashboard URL: {page.url}")
                print(f"   Dashboard Title: {page.title()}")
                
                # Look for dashboard elements
                dashboard_elements = [
                    'nav', 'main', '[role="navigation"]', '.sidebar', '.dashboard'
                ]
                
                found_elements = []
                for selector in dashboard_elements:
                    if page.locator(selector).count() > 0:
                        found_elements.append(selector)
                
                print(f"   Dashboard elements found: {found_elements}")
                
            except Exception as e:
                print(f"   Dashboard access error: {str(e)}")
            
            # Test 4: API Connectivity Check
            print("\n4. Testing API connectivity...")
            
            # Monitor network requests
            api_requests = []
            
            def capture_request(request):
                if 'localhost:8080' in request.url:
                    api_requests.append({
                        'method': request.method,
                        'url': request.url,
                        'headers': dict(request.headers)
                    })
            
            def capture_response(response):
                if 'localhost:8080' in response.url:
                    print(f"   API Response: {response.status} {response.url}")
            
            page.on('request', capture_request)
            page.on('response', capture_response)
            
            # Reload page to trigger API calls
            page.reload(wait_until='networkidle')
            page.wait_for_timeout(5000)
            
            print(f"   API requests captured: {len(api_requests)}")
            for req in api_requests:
                print(f"   - {req['method']} {req['url']}")
            
            # Test 5: Registration Form Check
            print("\n5. Checking registration form...")
            try:
                # Check if there's a "Sign up" link
                signup_link = page.locator('a:has-text("Sign up")').first
                if signup_link.count() > 0:
                    signup_link.click()
                    page.wait_for_timeout(2000)
                    page.screenshot(path='test_evidence/manual_05_signup.png', full_page=True)
                    print(f"   Registration page URL: {page.url}")
                else:
                    print("   No registration link found on current page")
            except Exception as e:
                print(f"   Registration check error: {str(e)}")
            
            # Final screenshot
            page.screenshot(path='test_evidence/manual_06_final.png', full_page=True)
            
            print("\n=== TEST COMPLETED ===")
            print("Evidence saved to test_evidence/ directory")
            
        except Exception as e:
            print(f"Test failed: {str(e)}")
            page.screenshot(path='test_evidence/manual_error.png', full_page=True)
            
        finally:
            input("Press Enter to close browser...")
            browser.close()

if __name__ == "__main__":
    manual_auth_test()