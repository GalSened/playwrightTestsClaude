import asyncio
from playwright.async_api import async_playwright

async def check_exact_404s():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Collect all network requests and responses
        failed_requests = []
        
        def handle_response(response):
            if response.status >= 400:
                failed_requests.append({
                    'url': response.url,
                    'status': response.status,
                    'method': response.request.method
                })
                print(f"FAILED: {response.status} {response.request.method} {response.url}")
        
        def handle_console(msg):
            if msg.type in ['error', 'warning']:
                print(f"Console {msg.type.upper()}: {msg.text}")
        
        page.on("response", handle_response)
        page.on("console", handle_console)
        
        print("Navigating to http://localhost:3000...")
        await page.goto("http://localhost:3000")
        await page.wait_for_timeout(5000)
        
        print(f"\nTotal failed requests: {len(failed_requests)}")
        for req in failed_requests:
            print(f"  {req['status']} {req['method']} {req['url']}")
        
        # Check specific page content
        title = await page.title()
        print(f"\nPage title: {title}")
        
        # Check if main app div exists
        root_content = await page.locator('#root').inner_html()
        print(f"Root content length: {len(root_content)}")
        print(f"Root content preview: {root_content[:200]}...")
        
        await page.wait_for_timeout(5000)
        await browser.close()

asyncio.run(check_exact_404s())