import asyncio
from playwright.async_api import async_playwright

async def debug_test_execution():
    """Debug test execution with real-time monitoring"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=1000)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Track network requests
        requests = []
        
        def track_request(request):
            if '/api/' in request.url:
                requests.append({
                    'method': request.method,
                    'url': request.url,
                    'timestamp': None
                })
                print(f"API REQUEST: {request.method} {request.url}")
        
        def track_response(response):
            if '/api/' in response.url:
                print(f"API RESPONSE: {response.status} {response.url}")
                if response.status != 200:
                    print(f"  ERROR STATUS: {response.status}")
        
        page.on("request", track_request)
        page.on("response", track_response)
        
        try:
            print("Starting test execution debug...")
            
            # Navigate to Test Bank
            await page.goto("http://localhost:3004/test-bank")
            await page.wait_for_timeout(3000)
            
            # Wait for tests to load
            await page.wait_for_selector('button:has-text("Run")', timeout=10000)
            
            # Get the first test row and extract details
            first_row = page.locator('tr').nth(1)  # Skip header row
            test_name_cell = first_row.locator('td').first
            test_name = await test_name_cell.text_content()
            print(f"Selected test: {test_name}")
            
            # Find and click the run button in this row
            run_button = first_row.locator('button:has-text("Run")')
            
            print("Clicking run button...")
            await run_button.click()
            
            # Monitor for changes in real-time
            print("Monitoring for execution changes...")
            
            for i in range(30):  # Monitor for 30 seconds
                await page.wait_for_timeout(1000)
                
                # Check for status changes in the row
                try:
                    status_cell = first_row.locator('td').nth(-1)  # Last cell is usually status
                    current_status = await status_cell.text_content()
                    
                    if i == 0:
                        initial_status = current_status
                        print(f"Initial status: {initial_status}")
                    elif current_status != initial_status:
                        print(f"Status changed to: {current_status}")
                        break
                        
                except Exception as e:
                    if i % 5 == 0:  # Print every 5 seconds
                        print(f"Monitoring... ({i}s)")
            
            # Check for any notifications or modals
            notifications = await page.locator('.notification, .alert, .toast, [role="alert"]').count()
            if notifications > 0:
                notification_text = await page.locator('.notification, .alert, .toast, [role="alert"]').first.text_content()
                print(f"Notification: {notification_text}")
            
            # Final screenshot
            await page.screenshot(path="debug_execution.png")
            print("Debug screenshot saved")
            
            # Keep browser open
            print("Keeping browser open for inspection...")
            await page.wait_for_timeout(10000)
            
        except Exception as e:
            print(f"Error: {e}")
            await page.screenshot(path="debug_execution_error.png")
            
        finally:
            print("Tracked API requests:")
            for req in requests[-5:]:  # Show last 5 requests
                print(f"  {req['method']} {req['url']}")
            
            await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_test_execution())