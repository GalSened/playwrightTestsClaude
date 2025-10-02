import pytest
from playwright.sync_api import Page
import time

class TestRunButtonFix:
    """Test to verify the fixed Run button functionality"""
    
    def test_run_button_calls_execution_api(self, page: Page):
        """Verify Run button now calls the execution API with correct file path"""
        
        # Monitor network requests
        requests = []
        def capture_request(request):
            requests.append({
                'url': request.url,
                'method': request.method,
                'post_data': request.post_data
            })
        
        page.on('request', capture_request)
        
        # Navigate to Test Bank
        page.goto("http://localhost:3001/test-bank")
        
        # Wait for page to load and tests to display
        page.wait_for_selector('[data-testid="test-row"]', timeout=30000)
        
        # Find the first Run button and click it
        run_button = page.locator('[data-testid="run-single-test-button"]').first
        assert run_button.is_visible(), "Run button should be visible"
        
        # Clear previous requests
        requests.clear()
        
        # Click the Run button
        run_button.click()
        
        # Wait a moment for the API call
        time.sleep(2)
        
        # Verify API call was made to execution endpoint
        execution_requests = [req for req in requests if '/api/execute/pytest' in req['url']]
        
        assert len(execution_requests) > 0, f"Run button should call execution API. Actual requests: {[req['url'] for req in requests]}"
        
        execution_request = execution_requests[0]
        assert execution_request['method'] == 'POST', "Should be POST request"
        assert execution_request['post_data'] is not None, "Should have POST data"
        
        print(f"✅ SUCCESS: Run button called execution API")
        print(f"Request URL: {execution_request['url']}")
        print(f"Request method: {execution_request['method']}")
        print(f"Request data: {execution_request['post_data']}")
        
    def test_run_button_uses_correct_file_path(self, page: Page):
        """Verify Run button uses the correct file path from backend data"""
        
        # Monitor network requests
        requests = []
        def capture_request(request):
            if '/api/execute/pytest' in request.url:
                requests.append({
                    'url': request.url,
                    'method': request.method,
                    'post_data': request.post_data
                })
        
        page.on('request', capture_request)
        
        # Navigate to Test Bank
        page.goto("http://localhost:3001/test-bank")
        
        # Wait for page to load and tests to display
        page.wait_for_selector('[data-testid="test-row"]', timeout=30000)
        
        # Get the first test's file path from the UI
        first_test_row = page.locator('[data-testid="test-row"]').first
        test_name = first_test_row.locator('td').nth(1).text_content()
        
        # Click the first Run button
        run_button = first_test_row.locator('[data-testid="run-single-test-button"]')
        run_button.click()
        
        # Wait for API call
        time.sleep(2)
        
        assert len(requests) > 0, "Should have made execution API call"
        
        request_data = requests[0]['post_data']
        assert 'tests/' in request_data, f"Should contain proper test file path. Data: {request_data}"
        assert '.py' in request_data, f"Should reference Python test file. Data: {request_data}"
        
        print(f"✅ SUCCESS: Run button uses correct file path")
        print(f"Test: {test_name}")
        print(f"Request data: {request_data}")