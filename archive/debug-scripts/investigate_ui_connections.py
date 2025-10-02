import asyncio
from playwright.async_api import async_playwright

async def investigate_ui_connections():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Track all network requests and console messages
        network_requests = []
        console_messages = []
        
        def handle_request(request):
            network_requests.append({
                'url': request.url,
                'method': request.method
            })
        
        def handle_response(response):
            if 'localhost:8081' in response.url:
                print(f"API CALL: {response.status} {response.request.method} {response.url}")
        
        def handle_console(msg):
            console_messages.append(f"{msg.type}: {msg.text}")
            if 'error' in msg.type.lower():
                print(f"Console ERROR: {msg.text}")
        
        page.on("request", handle_request)
        page.on("response", handle_response)
        page.on("console", handle_console)
        
        pages_to_test = [
            ("Dashboard", "http://localhost:3004/"),
            ("Analytics", "http://localhost:3004/analytics"),
            ("AI Assistant", "http://localhost:3004/ai-assistant"), 
            ("Knowledge Base", "http://localhost:3004/knowledge-upload"),
            ("Test Bank", "http://localhost:3004/test-bank"),
            ("Reports", "http://localhost:3004/reports")
        ]
        
        for page_name, url in pages_to_test:
            print(f"\n{'='*50}")
            print(f"TESTING: {page_name}")
            print(f"URL: {url}")
            print(f"{'='*50}")
            
            # Reset tracking
            network_requests.clear()
            console_messages.clear()
            
            try:
                await page.goto(url)
                await page.wait_for_timeout(5000)  # Wait for page to fully load
                
                # Check for API calls to backend
                api_calls = [req for req in network_requests if 'localhost:8081' in req['url']]
                print(f"API calls made: {len(api_calls)}")
                for api in api_calls:
                    print(f"  {api['method']} {api['url']}")
                
                # Check page content
                page_text = await page.text_content('body')
                content_indicators = {
                    'has_data': '311' in page_text if page_text else False,
                    'has_forms': await page.locator('input, button').count() > 0,
                    'has_content': len(page_text) > 100 if page_text else False,
                    'content_length': len(page_text) if page_text else 0
                }
                
                print(f"Page indicators:")
                for key, value in content_indicators.items():
                    print(f"  {key}: {value}")
                
                # Look for loading states
                loading_elements = await page.locator('[class*="loading"], [class*="spinner"]').count()
                error_elements = await page.locator('[class*="error"], .error').count()
                
                print(f"Loading elements: {loading_elements}")
                print(f"Error elements: {error_elements}")
                
                # Check for specific page features
                if page_name == "Analytics":
                    metrics = await page.locator('[class*="metric"], [class*="stat"], .card').count()
                    print(f"  Metric cards: {metrics}")
                
                elif page_name == "AI Assistant":
                    chat_inputs = await page.locator('input[placeholder*="message"], textarea').count()
                    print(f"  Chat inputs: {chat_inputs}")
                
                elif page_name == "Knowledge Base":
                    upload_buttons = await page.locator('input[type="file"], button:has-text("Upload")').count()
                    print(f"  Upload elements: {upload_buttons}")
                
                elif page_name == "Test Bank":
                    test_rows = await page.locator('tr, [class*="test"]').count()
                    run_buttons = await page.locator('button:has-text("Run")').count()
                    print(f"  Test rows: {test_rows}")
                    print(f"  Run buttons: {run_buttons}")
                
            except Exception as e:
                print(f"ERROR loading {page_name}: {e}")
            
            await page.wait_for_timeout(2000)
        
        print(f"\n{'='*50}")
        print("INVESTIGATION COMPLETE")
        print(f"{'='*50}")
        
        await page.wait_for_timeout(10000)  # Keep browser open for inspection
        await browser.close()

asyncio.run(investigate_ui_connections())