"""
Debug Current UI Error
Check what's happening when trying to run tests from the UI
"""

import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

async def debug_ui_error():
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False, slow_mo=500)
    page = await browser.new_page()
    
    # Capture console errors
    console_errors = []
    def handle_console(msg):
        if msg.type in ['error', 'warning']:
            console_errors.append(f"[{msg.type.upper()}] {msg.text}")
            print(f"BROWSER {msg.type.upper()}: {msg.text}")
    
    page.on("console", handle_console)
    
    # Track API calls
    api_calls = []
    def track_requests(request):
        if '/api/' in request.url:
            api_calls.append({
                'method': request.method,
                'url': request.url,
                'time': datetime.now().strftime('%H:%M:%S')
            })
            print(f"API: {request.method} {request.url}")
    
    def track_responses(response):
        if '/api/' in response.url:
            print(f"API RESPONSE: {response.status} {response.url}")
    
    page.on("request", track_requests)
    page.on("response", track_responses)
    
    print("=== DEBUGGING CURRENT UI ERRORS ===")
    
    try:
        # Navigate to test bank
        print("1. Loading Test Bank page...")
        await page.goto("http://localhost:3000/test-bank")
        await page.wait_for_load_state('networkidle', timeout=10000)
        await asyncio.sleep(3)
        
        timestamp = datetime.now().strftime('%H%M%S')
        await page.screenshot(path=f"debug_ui_{timestamp}_loaded.png")
        
        print("2. Checking page state...")
        
        # Check if page loaded properly
        page_title = await page.title()
        print(f"   Page title: {page_title}")
        
        # Check for error elements
        error_elements = await page.query_selector_all('[class*="error"]')
        print(f"   Error elements found: {len(error_elements)}")
        
        # Check for run buttons
        run_buttons = await page.query_selector_all('[data-testid="run-single-test"]')
        print(f"   Run buttons found: {len(run_buttons)}")
        
        # Check table content
        table_rows = await page.query_selector_all('tbody tr')
        print(f"   Table rows: {len(table_rows)}")
        
        if len(console_errors) > 0:
            print("3. Console errors detected:")
            for error in console_errors:
                print(f"   {error}")
        else:
            print("3. No console errors detected")
        
        # Try clicking a run button if available
        if len(run_buttons) > 0:
            print("4. Attempting to click Run button...")
            api_calls.clear()  # Clear previous calls
            
            await run_buttons[0].click()
            await asyncio.sleep(5)  # Wait for response
            
            print(f"   API calls after button click: {len(api_calls)}")
            for call in api_calls:
                print(f"     {call['time']}: {call['method']} {call['url']}")
        else:
            print("4. No run buttons available to test")
        
        await page.screenshot(path=f"debug_ui_{timestamp}_final.png")
        
        # Keep browser open for manual inspection
        print("5. Keeping browser open for 15 seconds...")
        await asyncio.sleep(15)
        
        return {
            'page_loaded': True,
            'console_errors': len(console_errors),
            'run_buttons': len(run_buttons),
            'api_calls': len(api_calls),
            'errors': console_errors
        }
        
    except Exception as e:
        print(f"ERROR: {e}")
        await page.screenshot(path=f"debug_ui_error_{datetime.now().strftime('%H%M%S')}.png")
        return {'error': str(e)}
    
    finally:
        await browser.close()

if __name__ == "__main__":
    result = asyncio.run(debug_ui_error())
    
    print("\n" + "="*40)
    print("UI DEBUG RESULTS")
    print("="*40)
    
    if 'error' in result:
        print(f"MAIN ERROR: {result['error']}")
    else:
        print(f"Page Loaded: {result.get('page_loaded', False)}")
        print(f"Console Errors: {result.get('console_errors', 0)}")
        print(f"Run Buttons: {result.get('run_buttons', 0)}")
        print(f"API Calls: {result.get('api_calls', 0)}")
        
        if result.get('errors'):
            print("\nConsole Errors:")
            for error in result['errors']:
                print(f"  - {error}")
    
    print("="*40)