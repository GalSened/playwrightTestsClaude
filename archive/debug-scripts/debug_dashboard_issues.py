"""
Debug Dashboard Issues
Comprehensive check for dashboard problems
"""

import asyncio
from playwright.async_api import async_playwright
import requests

async def debug_dashboard():
    print("=== DASHBOARD DEBUG ==")
    
    # Check if services are running
    try:
        backend_response = requests.get("http://localhost:8081/api/tests/all", timeout=5)
        print(f"✅ Backend: HTTP {backend_response.status_code}")
    except Exception as e:
        print(f"❌ Backend: {e}")
        return
    
    # Check dashboard with browser
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False)
    page = await browser.new_page()
    
    # Listen for console errors
    errors = []
    page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
    page.on('pageerror', lambda error: errors.append(f"Page Error: {error}"))
    
    try:
        print("🔍 Loading dashboard...")
        await page.goto("http://localhost:3000", wait_until='networkidle')
        
        # Wait for main content
        await page.wait_for_timeout(3000)
        
        # Check for key elements
        title = await page.text_content('h1')
        print(f"📊 Dashboard title: {title}")
        
        # Check for loading states
        loading_elements = await page.query_selector_all('[data-loading]')
        print(f"⏳ Loading elements: {len(loading_elements)}")
        
        # Check for error states
        error_elements = await page.query_selector_all('[role="alert"], .error, .alert-error')
        print(f"🚨 Error elements: {len(error_elements)}")
        
        # Check console errors
        if errors:
            print(f"❌ Console errors ({len(errors)}):")
            for error in errors[:5]:  # Show first 5 errors
                print(f"   - {error}")
        else:
            print("✅ No console errors")
            
        # Take screenshot for visual inspection
        await page.screenshot(path="dashboard_debug.png")
        print("📸 Screenshot saved as dashboard_debug.png")
        
    except Exception as e:
        print(f"❌ Browser test failed: {e}")
    
    finally:
        await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_dashboard())