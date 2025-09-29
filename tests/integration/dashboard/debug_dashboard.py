"""
Debug Dashboard Issues
"""

import asyncio
from playwright.async_api import async_playwright

async def debug_dashboard():
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False, slow_mo=500)
    page = await browser.new_page()
    
    js_errors = []
    network_errors = []
    
    # Capture JavaScript errors
    page.on("console", lambda msg: 
        js_errors.append(f"Console {msg.type}: {msg.text}") 
        if msg.type in ["error", "warning"] else None
    )
    
    # Capture network errors
    page.on("response", lambda response: 
        network_errors.append(f"HTTP {response.status}: {response.url}") 
        if response.status >= 400 else None
    )
    
    try:
        print("Debugging dashboard loading...")
        
        # Go to dashboard with extended timeout
        await page.goto("http://localhost:3000", wait_until="domcontentloaded", timeout=60000)
        
        # Wait and capture any errors
        await asyncio.sleep(5)
        
        # Check what actually loaded
        body_content = await page.content()
        print(f"Page content length: {len(body_content)}")
        
        # Look for React root
        react_root = await page.query_selector("#root")
        if react_root:
            root_html = await react_root.inner_html()
            print(f"React root content length: {len(root_html)}")
            if "QA Intelligence Dashboard" in root_html:
                print("SUCCESS: Dashboard title found in DOM")
            else:
                print("WARNING: Dashboard title not found in DOM")
        else:
            print("ERROR: React root not found")
        
        # Check for loading states
        loading_indicators = await page.query_selector_all('text=Loading')
        if loading_indicators:
            print(f"Found {len(loading_indicators)} loading indicators")
        
        # Check current URL
        current_url = page.url
        print(f"Current URL: {current_url}")
        
        print("Waiting 10 seconds for full load...")
        await asyncio.sleep(10)
        
    except Exception as e:
        print(f"Exception during debug: {str(e)}")
    
    finally:
        print(f"\nJavaScript errors: {len(js_errors)}")
        for error in js_errors:
            print(f"  - {error}")
        
        print(f"\nNetwork errors: {len(network_errors)}")
        for error in network_errors:
            print(f"  - {error}")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_dashboard())