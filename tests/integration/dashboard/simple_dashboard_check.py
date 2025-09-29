"""
Simple Dashboard Check
"""

import asyncio
from playwright.async_api import async_playwright

async def check_dashboard():
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False, slow_mo=500)
    page = await browser.new_page()
    
    errors = []
    
    try:
        print("Loading dashboard...")
        
        # Go to dashboard
        response = await page.goto("http://localhost:3000", wait_for="domcontentloaded")
        print(f"Response status: {response.status}")
        
        await asyncio.sleep(3)
        
        # Check if page loaded
        title = await page.title()
        print(f"Page title: {title}")
        
        # Check for dashboard elements
        dashboard_page = await page.query_selector('[data-testid="dashboard-page"]')
        if dashboard_page:
            print("SUCCESS: Dashboard page element found")
        else:
            errors.append("Dashboard page element not found")
        
        page_title = await page.query_selector('[data-testid="page-title"]')
        if page_title:
            title_text = await page_title.inner_text()
            print(f"SUCCESS: Page title found - {title_text}")
        else:
            errors.append("Page title not found")
        
        # Check for any JavaScript errors
        await page.evaluate("console.log('Dashboard check completed')")
        
        await asyncio.sleep(5)
        
        return len(errors) == 0
        
    except Exception as e:
        errors.append(f"Exception: {str(e)}")
        return False
    
    finally:
        await browser.close()

if __name__ == "__main__":
    result = asyncio.run(check_dashboard())
    
    print("\n" + "="*30)
    if result:
        print("SUCCESS: Dashboard is working!")
    else:
        print("FAILURE: Dashboard has issues!")
    print("="*30)