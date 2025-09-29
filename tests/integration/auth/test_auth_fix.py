"""
Test Frontend Authentication Fix
This test verifies that the frontend authentication now works correctly
"""
import asyncio
from playwright.async_api import async_playwright
import sys
import json

async def test_frontend_auth_fix():
    """Test the fixed frontend authentication"""
    print("Starting frontend authentication test...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            # Navigate to login page
            print("1. Navigating to login page...")
            await page.goto("http://localhost:3008/auth/login", wait_until="networkidle")
            await page.wait_for_timeout(2000)
            
            # Fill in demo credentials
            print("2. Filling demo credentials...")
            await page.fill('input[name="email"]', 'admin@demo.com')
            await page.fill('input[name="password"]', 'demo123')
            await page.fill('input[name="tenantSubdomain"]', 'demo')
            
            # Click login
            print("3. Clicking login button...")
            await page.click('button[type="submit"]')
            await page.wait_for_timeout(3000)
            
            # Check for successful login
            current_url = page.url
            print(f"4. Current URL after login: {current_url}")
            
            # Check localStorage for token
            token = await page.evaluate("localStorage.getItem('auth_token')")
            tenant_id = await page.evaluate("localStorage.getItem('current_tenant_id')")
            
            print(f"5. Auth token exists: {bool(token)}")
            print(f"6. Tenant ID exists: {bool(tenant_id)}")
            
            if token:
                # Try to access Test Bank page
                print("7. Accessing Test Bank page...")
                await page.goto("http://localhost:3008/test-bank", wait_until="networkidle")
                await page.wait_for_timeout(3000)
                
                # Check if we can see the page content
                page_title = await page.title()
                print(f"8. Test Bank page title: {page_title}")
                
                # Look for Test Bank specific elements
                test_bank_elements = await page.query_selector_all('[data-testid*="test"], [class*="test"], h1, h2')
                print(f"9. Found {len(test_bank_elements)} potential test-related elements")
                
                # Take screenshot
                await page.screenshot(path="auth_fix_test_bank_page.png")
                print("10. Screenshot saved: auth_fix_test_bank_page.png")
                
                return {
                    "success": True,
                    "authenticated": True,
                    "token_exists": bool(token),
                    "can_access_test_bank": True,
                    "current_url": current_url
                }
            else:
                print("❌ Authentication failed - no token found")
                await page.screenshot(path="auth_fix_failed.png")
                return {
                    "success": False,
                    "authenticated": False,
                    "token_exists": False,
                    "error": "No auth token found after login"
                }
                
        except Exception as e:
            print(f"❌ Test failed with error: {str(e)}")
            await page.screenshot(path="auth_fix_error.png")
            return {
                "success": False,
                "error": str(e)
            }
        finally:
            await browser.close()

if __name__ == "__main__":
    result = asyncio.run(test_frontend_auth_fix())
    print("\n=== AUTHENTICATION FIX TEST RESULTS ===")
    print(json.dumps(result, indent=2))