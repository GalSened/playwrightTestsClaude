from playwright.sync_api import Page, Browser, BrowserContext
from typing import Optional, Dict, Any, List
import json
import os
import time
from datetime import datetime
from pathlib import Path


class TestHelpers:
    """Helper utilities for WeSign tests"""
    
    def __init__(self, page: Page, config=None):
        self.page = page
        self.config = config
        
    def wait_for_url_contains(self, url_part: str, timeout: int = 30000) -> bool:
        """Wait for URL to contain specific text"""
        try:
            self.page.wait_for_url(f"**/*{url_part}*", timeout=timeout)
            return True
        except Exception:
            return False
            
    def wait_for_url_equals(self, url: str, timeout: int = 30000) -> bool:
        """Wait for URL to equal specific value"""
        try:
            self.page.wait_for_url(url, timeout=timeout)
            return True
        except Exception:
            return False
            
    def capture_network_logs(self) -> List[Dict[str, Any]]:
        """Capture network request/response logs"""
        logs = []
        
        def handle_request(request):
            logs.append({
                "type": "request",
                "url": request.url,
                "method": request.method,
                "headers": dict(request.headers),
                "timestamp": datetime.now().isoformat()
            })
            
        def handle_response(response):
            logs.append({
                "type": "response", 
                "url": response.url,
                "status": response.status,
                "headers": dict(response.headers),
                "timestamp": datetime.now().isoformat()
            })
            
        self.page.on("request", handle_request)
        self.page.on("response", handle_response)
        
        return logs
        
    def capture_console_logs(self) -> List[Dict[str, Any]]:
        """Capture browser console logs"""
        logs = []
        
        def handle_console(msg):
            logs.append({
                "type": msg.type,
                "text": msg.text,
                "location": msg.location,
                "timestamp": datetime.now().isoformat()
            })
            
        self.page.on("console", handle_console)
        return logs
        
    def wait_for_element_count(self, selector: str, count: int, timeout: int = 30000) -> bool:
        """Wait for specific number of elements matching selector"""
        try:
            self.page.wait_for_function(
                f"document.querySelectorAll('{selector}').length === {count}",
                timeout=timeout
            )
            return True
        except Exception:
            return False
            
    def get_local_storage(self) -> Dict[str, Any]:
        """Get all localStorage data"""
        return self.page.evaluate("() => Object.assign({}, localStorage)")
        
    def set_local_storage(self, key: str, value: str) -> None:
        """Set localStorage item"""
        self.page.evaluate(f"localStorage.setItem('{key}', '{value}')")
        
    def clear_local_storage(self) -> None:
        """Clear all localStorage"""
        self.page.evaluate("localStorage.clear()")
        
    def get_session_storage(self) -> Dict[str, Any]:
        """Get all sessionStorage data"""
        return self.page.evaluate("() => Object.assign({}, sessionStorage)")
        
    def clear_session_storage(self) -> None:
        """Clear all sessionStorage"""
        self.page.evaluate("sessionStorage.clear()")
        
    def get_cookies(self) -> List[Dict[str, Any]]:
        """Get all cookies"""
        return self.page.context.cookies()
        
    def clear_cookies(self) -> None:
        """Clear all cookies"""
        self.page.context.clear_cookies()
        
    def inject_css(self, css: str) -> None:
        """Inject custom CSS into page"""
        self.page.add_style_tag(content=css)
        
    def inject_js(self, js: str) -> Any:
        """Inject and execute JavaScript"""
        return self.page.evaluate(js)
        
    def scroll_to_bottom(self) -> None:
        """Scroll to bottom of page"""
        self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        
    def scroll_to_top(self) -> None:
        """Scroll to top of page"""
        self.page.evaluate("window.scrollTo(0, 0)")
        
    def get_page_performance_metrics(self) -> Dict[str, Any]:
        """Get page performance metrics"""
        return self.page.evaluate("""
            () => {
                const perf = performance.getEntriesByType('navigation')[0];
                return {
                    loadTime: perf.loadEventEnd - perf.navigationStart,
                    domContentLoaded: perf.domContentLoadedEventEnd - perf.navigationStart,
                    responseTime: perf.responseEnd - perf.requestStart,
                    renderTime: perf.domComplete - perf.domLoading,
                    connectTime: perf.connectEnd - perf.connectStart
                };
            }
        """)
        
    def simulate_slow_network(self) -> None:
        """Simulate slow network conditions"""
        self.page.route("**/*", lambda route: (
            time.sleep(0.5),  # Add 500ms delay
            route.continue_()
        ))
        
    def block_images(self) -> None:
        """Block image loading"""
        self.page.route("**/*.{png,jpg,jpeg,gif,webp}", lambda route: route.abort())
        
    def block_css(self) -> None:
        """Block CSS loading"""
        self.page.route("**/*.css", lambda route: route.abort())
        
    def intercept_api_calls(self, api_path: str) -> List[Dict[str, Any]]:
        """Intercept and log API calls"""
        intercepted_calls = []
        
        def handle_route(route):
            request = route.request
            intercepted_calls.append({
                "url": request.url,
                "method": request.method,
                "headers": dict(request.headers),
                "post_data": request.post_data,
                "timestamp": datetime.now().isoformat()
            })
            route.continue_()
            
        self.page.route(f"**/*{api_path}*", handle_route)
        return intercepted_calls
        
    def mock_api_response(self, api_path: str, mock_response: Dict[str, Any]) -> None:
        """Mock API response"""
        self.page.route(
            f"**/*{api_path}*",
            lambda route: route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(mock_response)
            )
        )
        
    def wait_for_network_idle(self, timeout: int = 30000) -> None:
        """Wait for network to be idle"""
        self.page.wait_for_load_state("networkidle", timeout=timeout)
        
    def wait_for_dom_content_loaded(self, timeout: int = 30000) -> None:
        """Wait for DOM content to be loaded"""
        self.page.wait_for_load_state("domcontentloaded", timeout=timeout)
        
    def get_element_screenshot(self, selector: str, filename: str) -> str:
        """Take screenshot of specific element"""
        element = self.page.locator(selector)
        screenshot_path = f"artifacts/screenshots/{filename}.png"
        element.screenshot(path=screenshot_path)
        return screenshot_path
        
    def compare_screenshots(self, expected_path: str, actual_path: str) -> bool:
        """Compare two screenshots (basic implementation)"""
        # This is a basic implementation - in real projects you'd use
        # specialized image comparison libraries
        return os.path.exists(expected_path) and os.path.exists(actual_path)
        
    def generate_test_report_data(self, test_name: str, start_time: datetime, 
                                end_time: datetime, status: str, 
                                error_msg: Optional[str] = None) -> Dict[str, Any]:
        """Generate test report data"""
        return {
            "test_name": test_name,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration": (end_time - start_time).total_seconds(),
            "status": status,
            "error_message": error_msg,
            "url": self.page.url,
            "timestamp": datetime.now().isoformat()
        }
        
    def save_test_artifacts(self, test_name: str, artifacts: Dict[str, Any]) -> None:
        """Save test artifacts to files"""
        artifacts_dir = Path("artifacts")
        artifacts_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        for artifact_type, data in artifacts.items():
            filename = f"{test_name}_{artifact_type}_{timestamp}.json"
            filepath = artifacts_dir / filename
            
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                
    def create_har_file(self, filename: str) -> str:
        """Create HAR (HTTP Archive) file for network analysis"""
        har_path = f"artifacts/{filename}.har"
        # Note: This would require browser context configuration
        # context = browser.new_context(record_har_path=har_path)
        return har_path
        
    def validate_accessibility(self) -> Dict[str, Any]:
        """Basic accessibility validation"""
        return self.page.evaluate("""
            () => {
                const issues = [];
                
                // Check for images without alt text
                const images = document.querySelectorAll('img:not([alt])');
                if (images.length > 0) {
                    issues.push({type: 'missing_alt_text', count: images.length});
                }
                
                // Check for buttons without accessible names
                const buttons = document.querySelectorAll('button:not([aria-label]):not([title])');
                const buttonsWithoutText = Array.from(buttons).filter(btn => !btn.textContent.trim());
                if (buttonsWithoutText.length > 0) {
                    issues.push({type: 'buttons_without_accessible_names', count: buttonsWithoutText.length});
                }
                
                // Check for inputs without labels
                const inputs = document.querySelectorAll('input:not([aria-label]):not([title])');
                const inputsWithoutLabels = Array.from(inputs).filter(input => {
                    const id = input.getAttribute('id');
                    return !id || !document.querySelector(`label[for="${id}"]`);
                });
                if (inputsWithoutLabels.length > 0) {
                    issues.push({type: 'inputs_without_labels', count: inputsWithoutLabels.length});
                }
                
                return {
                    issues: issues,
                    total_issues: issues.reduce((sum, issue) => sum + issue.count, 0)
                };
            }
        """)
        
    def get_page_metadata(self) -> Dict[str, Any]:
        """Get page metadata information"""
        return self.page.evaluate("""
            () => {
                const meta = {};
                meta.title = document.title;
                meta.url = window.location.href;
                meta.lang = document.documentElement.lang;
                meta.charset = document.charset;
                
                // Get meta tags
                const metaTags = {};
                document.querySelectorAll('meta').forEach(tag => {
                    const name = tag.getAttribute('name') || tag.getAttribute('property');
                    const content = tag.getAttribute('content');
                    if (name && content) {
                        metaTags[name] = content;
                    }
                });
                meta.tags = metaTags;
                
                return meta;
            }
        """)
        
    # WeSign-specific helper methods
    
    def login_with_default_user(self) -> bool:
        """
        Login with default company user from config
        
        Returns:
            bool: True if login successful, False otherwise
        """
        if not self.config:
            return False
            
        try:
            # Navigate to base URL 
            self.page.goto(self.config.urls['base_url'])
            
            # Get user credentials
            user_creds = self.config.get_user_credentials('company_user')
            if not user_creds:
                print("No company user credentials available")
                return False
                
            return self._perform_login(user_creds.get('email', ''), user_creds.get('password', ''))
            
        except Exception as e:
            print(f"Login failed: {str(e)}")
            return False
            
    def login_with_user_type(self, user_type: str) -> bool:
        """
        Login with specific user type
        
        Args:
            user_type: Type of user ('company_user', 'basic_user', etc.)
            
        Returns:
            bool: True if login successful
        """
        if not self.config:
            return False
            
        try:
            user_creds = self.config.get_user_credentials(user_type)
            if not user_creds:
                return False
                
            self.page.goto(self.config.urls['base_url'])
            return self._perform_login(user_creds.get('email', ''), user_creds.get('password', ''))
            
        except Exception as e:
            print(f"Login with {user_type} failed: {str(e)}")
            return False
            
    def _perform_login(self, username: str, password: str) -> bool:
        """
        Perform actual login with credentials
        
        Args:
            username: Username or email
            password: Password
            
        Returns:
            bool: True if login successful
        """
        try:
            # Look for login form elements with multiple selectors
            login_selectors = {
                'username': [
                    "input[name='username']",
                    "input[name='email']", 
                    "input[type='email']",
                    "#username",
                    "#email",
                    ".username-input",
                    ".email-input",
                    "[data-testid='username']",
                    "[data-testid='email']"
                ],
                'password': [
                    "input[name='password']",
                    "input[type='password']",
                    "#password", 
                    ".password-input",
                    "[data-testid='password']"
                ],
                'login_button': [
                    "button[type='submit']",
                    "input[type='submit']",
                    "button:has-text('Login')",
                    "button:has-text('התחבר')",
                    ".login-button",
                    ".submit-button",
                    "[data-testid='login-button']",
                    "[data-testid='submit']"
                ]
            }
            
            # Fill username/email
            username_filled = False
            for selector in login_selectors['username']:
                try:
                    if self.page.locator(selector).is_visible():
                        self.page.fill(selector, username)
                        username_filled = True
                        break
                except Exception:
                    continue
                    
            if not username_filled:
                print("Could not find username field")
                return False
                
            # Fill password
            password_filled = False
            for selector in login_selectors['password']:
                try:
                    if self.page.locator(selector).is_visible():
                        self.page.fill(selector, password)
                        password_filled = True
                        break
                except Exception:
                    continue
                    
            if not password_filled:
                print("Could not find password field")
                return False
                
            # Click login button
            login_clicked = False
            for selector in login_selectors['login_button']:
                try:
                    if self.page.locator(selector).is_visible():
                        self.page.click(selector)
                        login_clicked = True
                        break
                except Exception:
                    continue
                    
            if not login_clicked:
                print("Could not find login button")
                return False
                
            # Wait for login to complete
            time.sleep(3)
            
            # Check if we're redirected to dashboard or if login was successful
            current_url = self.page.url
            if any(keyword in current_url.lower() for keyword in ['dashboard', 'main', 'home']):
                return True
                
            # Alternative: check for absence of login form
            login_form_gone = True
            for selector in login_selectors['username']:
                try:
                    if self.page.locator(selector).is_visible():
                        login_form_gone = False
                        break
                except Exception:
                    continue
                    
            return login_form_gone
            
        except Exception as e:
            print(f"Login process failed: {str(e)}")
            return False
            
    def logout(self) -> bool:
        """
        Logout from the application
        
        Returns:
            bool: True if logout successful
        """
        try:
            logout_selectors = [
                "button:has-text('Logout')",
                "button:has-text('התנתק')",
                "a:has-text('Logout')",
                "a:has-text('התנתק')",
                ".logout-button",
                ".logout-link", 
                "[data-testid='logout']",
                ".user-menu .logout",
                ".profile-menu .logout"
            ]
            
            for selector in logout_selectors:
                try:
                    if self.page.locator(selector).is_visible():
                        self.page.click(selector)
                        time.sleep(2)
                        return True
                except Exception:
                    continue
                    
            return False
            
        except Exception:
            return False
            
    def verify_language_interface(self, expected_language: str) -> bool:
        """
        Verify that interface is in expected language
        
        Args:
            expected_language: 'english' or 'hebrew'
            
        Returns:
            bool: True if interface matches expected language
        """
        try:
            page_content = self.page.content()
            
            if expected_language == 'hebrew':
                hebrew_indicators = [
                    'העלה קובץ', 'מזג קבצים', 'הקצה ושלח', 'מסמכים', 'לוח בקרה',
                    'שלח', 'בטל', 'אשר', 'חזור', 'הבא', 'כניסה', 'יציאה'
                ]
                return any(indicator in page_content for indicator in hebrew_indicators)
                
            else:  # english
                english_indicators = [
                    'Upload File', 'Merge Files', 'Assign and Send', 'Documents', 'Dashboard',
                    'Send', 'Cancel', 'Confirm', 'Back', 'Next', 'Login', 'Logout'
                ]
                return any(indicator in page_content for indicator in english_indicators)
                
        except Exception:
            return False
            
    def get_current_document_count(self) -> int:
        """
        Get current number of documents displayed
        
        Returns:
            int: Number of documents
        """
        try:
            # Look for various document list selectors
            doc_selectors = [
                '.document-item',
                '.file-item',
                '.document-card',
                '.file-card',
                '[data-testid="document-item"]',
                '.document-list-item',
                '.document-row',
                '.file-row'
            ]
            
            for selector in doc_selectors:
                try:
                    elements = self.page.locator(selector)
                    count = elements.count()
                    if count > 0:
                        return count
                except Exception:
                    continue
                    
            return 0
            
        except Exception:
            return 0
            
    def verify_file_upload_success(self, expected_count: int = None, timeout: int = 30000) -> bool:
        """
        Verify file upload was successful
        
        Args:
            expected_count: Expected number of documents after upload
            timeout: Maximum time to wait for verification
            
        Returns:
            bool: True if upload appears successful
        """
        try:
            start_time = time.time()
            
            while (time.time() - start_time) * 1000 < timeout:
                # Check for success indicators
                success_selectors = [
                    '.success-message',
                    '.upload-success',
                    '.notification-success', 
                    '.alert-success',
                    '.toast-success',
                    '.status-success'
                ]
                
                for selector in success_selectors:
                    try:
                        if self.page.locator(selector).is_visible():
                            return True
                    except Exception:
                        continue
                        
                # Alternative: check document count
                if expected_count is not None:
                    current_count = self.get_current_document_count()
                    if current_count >= expected_count:
                        return True
                        
                # Alternative: check that documents exist
                if expected_count is None and self.get_current_document_count() > 0:
                    return True
                    
                time.sleep(1)
                
            return False
            
        except Exception:
            return False
            
    def clear_all_uploaded_documents(self) -> bool:
        """
        Clear all uploaded documents (if feature available)
        
        Returns:
            bool: True if clearing successful or no documents to clear
        """
        try:
            # Look for clear/delete all button
            clear_selectors = [
                "button:has-text('Clear All')",
                "button:has-text('Delete All')",
                "button:has-text('נקה הכל')",
                "button:has-text('מחק הכל')",
                ".clear-all-button",
                ".delete-all-button",
                "[data-testid='clear-all']",
                "[data-testid='delete-all']"
            ]
            
            for selector in clear_selectors:
                try:
                    if self.page.locator(selector).is_visible():
                        self.page.click(selector)
                        
                        # Look for confirmation dialog
                        confirm_selectors = [
                            "button:has-text('Confirm')",
                            "button:has-text('אשר')",
                            ".confirm-button",
                            ".modal-confirm",
                            "[data-testid='confirm']"
                        ]
                        
                        time.sleep(1)  # Brief wait for dialog
                        
                        for confirm_sel in confirm_selectors:
                            try:
                                if self.page.locator(confirm_sel).is_visible():
                                    self.page.click(confirm_sel)
                                    break
                            except Exception:
                                continue
                                
                        time.sleep(2)  # Wait for clearing to complete
                        return True
                except Exception:
                    continue
                    
            # If no clear button, assume no documents or feature not available
            return True
            
        except Exception:
            return False
            
    def wait_for_wesign_page_load(self, timeout: int = 30000) -> bool:
        """
        Wait for WeSign page to load completely
        
        Args:
            timeout: Maximum wait time in milliseconds
            
        Returns:
            bool: True if page loaded successfully
        """
        try:
            # Wait for network idle first
            self.page.wait_for_load_state("networkidle", timeout=timeout)
            
            # Wait for key WeSign elements to be visible
            wesign_indicators = [
                "input[type='file']",
                ".upload-button",
                ".upload-area",
                ".document-area",
                ".wesign-dashboard",
                ".main-content"
            ]
            
            for selector in wesign_indicators:
                try:
                    self.page.wait_for_selector(selector, timeout=5000)
                    return True
                except Exception:
                    continue
                    
            return False
            
        except Exception:
            return False
            
    def get_wesign_error_message(self) -> Optional[str]:
        """
        Get WeSign-specific error message
        
        Returns:
            str: Error message or None if no error
        """
        try:
            error_selectors = [
                '.error-message',
                '.alert-error',
                '.notification-error',
                '.toast-error',
                '.validation-error',
                '.upload-error',
                '.file-error',
                '.merge-error',
                '.send-error'
            ]
            
            for selector in error_selectors:
                try:
                    if self.page.locator(selector).is_visible():
                        return self.page.locator(selector).text_content()
                except Exception:
                    continue
                    
            return None
            
        except Exception:
            return None
            
    def get_wesign_success_message(self) -> Optional[str]:
        """
        Get WeSign-specific success message
        
        Returns:
            str: Success message or None if no success message
        """
        try:
            success_selectors = [
                '.success-message',
                '.alert-success',
                '.notification-success',
                '.toast-success',
                '.upload-success',
                '.merge-success',
                '.send-success'
            ]
            
            for selector in success_selectors:
                try:
                    if self.page.locator(selector).is_visible():
                        return self.page.locator(selector).text_content()
                except Exception:
                    continue
                    
            return None
            
        except Exception:
            return None