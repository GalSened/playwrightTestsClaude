import asyncio
from playwright.async_api import async_playwright
import json

async def test_single_execution():
    """Simple test to verify single test execution behavior"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=1000)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Track network requests to API
        api_calls = []
        
        def track_request(request):
            if 'api/execute' in request.url:
                api_calls.append({
                    'url': request.url,
                    'method': request.method,
                    'timestamp': request.timing['request_start']
                })
                print(f"API CALL: {request.method} {request.url}")
        
        page.on("request", track_request)
        
        try:
            # Navigate to test bank
            await page.goto("http://localhost:3004/test-bank")
            await page.wait_for_timeout(3000)
            
            # Click on first run button
            first_run_button = page.locator('button:has-text("Run")').first
            await first_run_button.click()
            
            print("Clicked run button, monitoring for 15 seconds...")
            await page.wait_for_timeout(15000)
            
            print(f"\nAPI calls detected: {len(api_calls)}")
            for i, call in enumerate(api_calls):
                print(f"  {i+1}. {call['method']} {call['url']}")
            
            # Check if multiple /pytest calls were made
            pytest_calls = [call for call in api_calls if 'execute/pytest' in call['url']]
            print(f"\nPytest execution calls: {len(pytest_calls)}")
            
            if len(pytest_calls) > 1:
                print("ISSUE: Multiple pytest execution calls detected!")
            else:
                print("OK: Only one pytest execution call detected")
                
        except Exception as e:
            print(f"Error: {e}")
            
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(test_single_execution())