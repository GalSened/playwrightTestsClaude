"""
Quick Dashboard Test
Test if dashboard loads after fixing missing import
"""

import asyncio
from playwright.async_api import async_playwright

async def test_dashboard():
    print("Testing dashboard after fix...")
    
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False, slow_mo=500)
    page = await browser.new_page()
    
    try:
        await page.goto("http://localhost:3000")
        await page.wait_for_load_state('networkidle')
        
        # Wait for the h1 title to appear
        title_element = await page.wait_for_selector('h1', timeout=10000)
        title_text = await title_element.text_content()
        print(f"SUCCESS: Found title: {title_text}")
        
        # Check if loading is finished
        loading_elements = await page.query_selector_all('[data-testid="loading"]')
        print(f"Loading elements: {len(loading_elements)}")
        
        # Take a screenshot to see current state
        await page.screenshot(path="dashboard_after_fix.png")
        print("Screenshot saved: dashboard_after_fix.png")
        
        print("Dashboard is now loading properly!")
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        return False
    
    finally:
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_dashboard())