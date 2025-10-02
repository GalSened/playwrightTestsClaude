"""
Simple Dashboard Debug
Check for dashboard issues without unicode characters
"""

import asyncio
from playwright.async_api import async_playwright
import requests

async def debug_dashboard():
    print("=== DASHBOARD DEBUG ===")
    
    # Check backend
    try:
        backend_response = requests.get("http://localhost:8081/api/tests/all", timeout=5)
        print(f"Backend: HTTP {backend_response.status_code}")
    except Exception as e:
        print(f"Backend Error: {e}")
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
        print("Loading dashboard...")
        await page.goto("http://localhost:3000", wait_until='networkidle')
        
        # Wait for content to load
        await page.wait_for_timeout(3000)
        
        # Check title
        title = await page.text_content('h1')
        print(f"Dashboard title: {title}")
        
        # Check for loading states
        loading_elements = await page.query_selector_all('[data-loading]')
        print(f"Loading elements: {len(loading_elements)}")
        
        # Check for error elements
        error_elements = await page.query_selector_all('[role="alert"], .error, .alert-error')
        print(f"Error elements: {len(error_elements)}")
        
        # Check console errors
        if errors:
            print(f"Console errors ({len(errors)}):")
            for i, error in enumerate(errors[:5]):
                print(f"  {i+1}. {error}")
        else:
            print("No console errors")
        
        # Check if main dashboard components are present
        dashboard_sections = await page.query_selector_all('.dashboard-section, .hero-section, .kpi-section')
        print(f"Dashboard sections found: {len(dashboard_sections)}")
        
        # Take screenshot
        await page.screenshot(path="dashboard_debug.png")
        print("Screenshot saved: dashboard_debug.png")
        
    except Exception as e:
        print(f"Browser test failed: {e}")
    
    finally:
        await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_dashboard())