import asyncio
from playwright.async_api import async_playwright

async def quick_browser_check():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Listen to console messages
        def handle_console(msg):
            print(f"Console {msg.type}: {msg.text}")
        
        page.on("console", handle_console)
        
        # Navigate and check for errors
        await page.goto("http://localhost:3000")
        await page.wait_for_timeout(5000)
        
        # Check if React has mounted
        react_root = await page.locator('#root').count()
        print(f"React root element found: {react_root}")
        
        # Check page content
        body_text = await page.locator('body').text_content()
        print(f"Body text length: {len(body_text) if body_text else 0}")
        
        await page.wait_for_timeout(10000)
        await browser.close()

asyncio.run(quick_browser_check())