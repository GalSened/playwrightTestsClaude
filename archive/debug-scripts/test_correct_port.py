import asyncio
from playwright.async_api import async_playwright

async def test_correct_port():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        failed_requests = []
        
        def handle_response(response):
            if response.status >= 400:
                failed_requests.append(f"{response.status} {response.url}")
                print(f"FAILED: {response.status} {response.url}")
        
        def handle_console(msg):
            if msg.type in ['error', 'warning']:
                print(f"Console {msg.type.upper()}: {msg.text}")
        
        page.on("response", handle_response)
        page.on("console", handle_console)
        
        print("Testing http://localhost:3004...")
        await page.goto("http://localhost:3004")
        await page.wait_for_timeout(5000)
        
        print(f"Failed requests: {len(failed_requests)}")
        
        # Check page content
        root_content = await page.locator('#root').inner_html()
        print(f"Root content length: {len(root_content)}")
        
        if len(root_content) > 50:
            print("SUCCESS: App is rendering!")
            print(f"Content preview: {root_content[:200]}...")
        else:
            print("Still not rendering properly")
        
        await page.wait_for_timeout(10000)
        await browser.close()

asyncio.run(test_correct_port())