import asyncio
from playwright.async_api import async_playwright

async def debug_single_test_execution():
    """Debug why single test runs multiple times"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=500)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Track API calls
        requests = []
        responses = []
        
        def track_request(request):
            if '/api/execute' in request.url:
                requests.append({
                    'url': request.url,
                    'method': request.method,
                    'timestamp': request.timing['request_start'],
                    'body': None  # Can't access body directly
                })
                print(f"REQUEST: {request.method} {request.url}")
        
        def track_response(response):
            if '/api/execute' in response.url:
                responses.append({
                    'url': response.url,
                    'status': response.status,
                    'timestamp': response.timing['response_end']
                })
                print(f"RESPONSE: {response.status} {response.url}")
        
        page.on("request", track_request)
        page.on("response", track_response)
        
        try:
            print("=== DEBUGGING SINGLE TEST EXECUTION ===")
            
            # Navigate to test bank
            await page.goto("http://localhost:3004/test-bank")
            await page.wait_for_timeout(3000)
            
            # Wait for tests to load
            await page.wait_for_selector('button:has-text("Run")', timeout=10000)
            print("SUCCESS: Test Bank loaded")
            
            # Find first test and its run button
            first_run_button = page.locator('button:has-text("Run")').first
            
            # Get test info before clicking
            test_row = first_run_button.locator('xpath=ancestor::tr').first
            test_name_cell = test_row.locator('td').first
            test_name = await test_name_cell.text_content()
            print(f"Target test: {test_name}")
            
            # Monitor for multiple clicks or rapid API calls
            click_count = 0
            
            async def monitor_button_clicks():
                nonlocal click_count
                click_count += 1
                print(f"CLICK #{click_count} detected on run button")
            
            # Set up click monitoring
            await page.evaluate("""
                () => {
                    window.runButtonClicks = 0;
                    document.addEventListener('click', (event) => {
                        if (event.target.textContent === 'Run') {
                            window.runButtonClicks++;
                            console.log('Run button click #' + window.runButtonClicks);
                        }
                    });
                }
            """)
            
            print("Clicking run button once...")
            await first_run_button.click()
            
            # Wait and monitor for activity
            await page.wait_for_timeout(1000)
            
            # Check how many clicks were registered
            click_count = await page.evaluate("window.runButtonClicks || 0")
            print(f"Total clicks detected: {click_count}")
            
            # Monitor API calls for 10 seconds
            print("Monitoring API calls for 10 seconds...")
            for i in range(10):
                await page.wait_for_timeout(1000)
                if i % 2 == 0:  # Print every 2 seconds
                    print(f"  Monitoring... {i+1}s - API requests so far: {len(requests)}")
            
            # Check if multiple execution requests were made
            execute_requests = [r for r in requests if 'execute/pytest' in r['url']]
            status_requests = [r for r in requests if 'execute/status' in r['url']]
            
            print(f"\n=== ANALYSIS ===")
            print(f"Execute requests: {len(execute_requests)}")
            print(f"Status requests: {len(status_requests)}")
            print(f"Total API requests: {len(requests)}")
            
            if len(execute_requests) > 1:
                print("ISSUE FOUND: Multiple execute requests!")
                for i, req in enumerate(execute_requests):
                    print(f"  Execute #{i+1}: {req['method']} {req['url']}")
            else:
                print("SUCCESS: Only one execute request detected")
            
            # Take screenshot
            await page.screenshot(path="single_test_debug.png")
            print("Screenshot saved")
            
            # Keep open for inspection
            await page.wait_for_timeout(5000)
            
        except Exception as e:
            print(f"Error: {e}")
            await page.screenshot(path="single_test_debug_error.png")
            
        finally:
            await browser.close()
            print("Debug completed")

if __name__ == "__main__":
    asyncio.run(debug_single_test_execution())