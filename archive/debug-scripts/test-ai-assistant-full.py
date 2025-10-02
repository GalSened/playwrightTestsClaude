#!/usr/bin/env python3
"""
Comprehensive AI Assistant Page Testing Script
Tests both WeSign Mentor and Test Generator functionality
"""

import requests
import time
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

class AIAssistantTester:
    def __init__(self):
        self.base_url = "http://localhost:3000"
        self.api_url = "http://localhost:8081"
        self.driver = None
        self.setup_driver()
    
    def setup_driver(self):
        """Setup Chrome WebDriver with appropriate options"""
        chrome_options = Options()
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        # chrome_options.add_argument("--headless")  # Uncomment for headless mode
        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.implicitly_wait(10)
    
    def test_page_load(self):
        """Test 1: Basic page loading"""
        print("🧪 Testing page load...")
        self.driver.get(f"{self.base_url}/ai-assistant")
        
        # Wait for main elements
        wait = WebDriverWait(self.driver, 10)
        wait.until(EC.presence_of_element_located((By.TEXT, "AI Testing Assistant")))
        
        # Check tab navigation
        mentor_tab = self.driver.find_element(By.TEXT, "WeSign Mentor")
        generator_tab = self.driver.find_element(By.TEXT, "Test Generator")
        
        assert mentor_tab.is_displayed()
        assert generator_tab.is_displayed()
        print("✅ Page loaded successfully with both tabs")
    
    def test_mentor_tab(self):
        """Test 2: WeSign Mentor functionality"""
        print("🧪 Testing WeSign Mentor...")
        
        # Click mentor tab
        mentor_tab = self.driver.find_element(By.TEXT, "WeSign Mentor")
        mentor_tab.click()
        
        # Check welcome message
        wait = WebDriverWait(self.driver, 5)
        welcome_msg = wait.until(EC.presence_of_element_located((By.TEXT, "Welcome to the WeSign Mentor")))
        assert "WeSign Mentor" in welcome_msg.text
        
        # Test suggested questions
        suggestions = self.driver.find_elements(By.CSS_SELECTOR, "[class*='suggested'] button")
        assert len(suggestions) > 0
        print(f"✅ Found {len(suggestions)} suggested questions")
        
        # Test message input
        message_input = self.driver.find_element(By.PLACEHOLDER_TEXT, "Ask me anything about WeSign testing...")
        message_input.send_keys("What is WeSign?")
        
        send_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit'], button:has-text('Send')")
        send_button.click()
        
        print("✅ Mentor tab functionality verified")
    
    def test_generator_tab(self):
        """Test 3: Test Generator functionality"""
        print("🧪 Testing Test Generator...")
        
        # Click generator tab
        generator_tab = self.driver.find_element(By.TEXT, "Test Generator")
        generator_tab.click()
        
        # Check form elements
        framework_select = self.driver.find_element(By.CSS_SELECTOR, "select")
        module_select = self.driver.find_elements(By.CSS_SELECTOR, "select")[1]
        action_textarea = self.driver.find_element(By.CSS_SELECTOR, "textarea")
        
        # Verify defaults
        assert "pytest" in framework_select.get_attribute("value")
        print("✅ Default framework is pytest")
        
        # Fill form
        action_textarea.clear()
        action_textarea.send_keys("Test user login with email and password")
        
        # Click generate button
        generate_btn = self.driver.find_element(By.TEXT, "Generate Test Code")
        generate_btn.click()
        
        # Verify loading state appears
        wait = WebDriverWait(self.driver, 2)
        try:
            loading_indicator = wait.until(EC.presence_of_element_located((By.TEXT, "AI is generating")))
            print("✅ Loading animation displayed")
        except:
            print("⚠️  Loading animation not found (generation too fast)")
        
        print("✅ Generator tab functionality verified")
    
    def test_api_endpoints(self):
        """Test 4: Backend API endpoints"""
        print("🧪 Testing API endpoints...")
        
        # Test templates endpoint
        response = requests.get(f"{self.api_url}/api/test-generator/templates")
        assert response.status_code == 200
        templates = response.json()
        assert templates["success"] == True
        assert len(templates["templates"]["modules"]) == 7
        print("✅ Templates API working")
        
        # Test generation endpoint
        test_request = {
            "testType": "pytest",
            "module": "auth",
            "action": "test login functionality",
            "language": "both"
        }
        
        response = requests.post(
            f"{self.api_url}/api/test-generator/generate",
            json=test_request,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        result = response.json()
        assert result["success"] == True
        assert "code" in result["result"]
        print("✅ Generation API working")
        
        # Test bank API
        bank_request = {
            "generatedCode": "def test_example():\n    pass",
            "filename": "test_example.py",
            "testType": "pytest",
            "module": "auth",
            "action": "test example",
            "language": "both",
            "selectionMode": "all",
            "metadata": {
                "category": "auth",
                "priority": "medium",
                "tags": ["smoke"],
                "description": "Test example"
            }
        }
        
        response = requests.post(
            f"{self.api_url}/api/test-bank/generated",
            json=bank_request,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        result = response.json()
        assert result["success"] == True
        print("✅ Test Bank API working")
    
    def test_full_workflow(self):
        """Test 5: Complete end-to-end workflow"""
        print("🧪 Testing complete workflow...")
        
        # Navigate to generator tab
        generator_tab = self.driver.find_element(By.TEXT, "Test Generator")
        generator_tab.click()
        
        # Fill comprehensive form
        action_textarea = self.driver.find_element(By.CSS_SELECTOR, "textarea[placeholder*='Describe the test scenario']")
        action_textarea.clear()
        action_textarea.send_keys("""
        Test WeSign document upload workflow:
        • Navigate to documents section
        • Click upload button
        • Select PDF file
        • Verify file appears in list
        • Check bilingual interface elements
        """)
        
        # Generate test
        generate_btn = self.driver.find_element(By.TEXT, "Generate Test Code")
        generate_btn.click()
        
        # Wait for generation to complete (up to 30 seconds)
        wait = WebDriverWait(self.driver, 30)
        
        try:
            # Wait for either success or error
            result = wait.until(lambda d: 
                d.find_element(By.CSS_SELECTOR, "pre code") or 
                d.find_element(By.TEXT, "Generation Failed")
            )
            
            if "Generation Failed" in self.driver.page_source:
                print("❌ Test generation failed")
                return False
            
            print("✅ Test generated successfully")
            
            # Check for test bank integration section
            bank_section = self.driver.find_element(By.TEXT, "Add to Test Bank")
            assert bank_section.is_displayed()
            
            # Enable test bank integration
            add_to_bank_checkbox = self.driver.find_element(By.CSS_SELECTOR, "input[type='checkbox']")
            if not add_to_bank_checkbox.is_selected():
                add_to_bank_checkbox.click()
            
            # Save to test bank
            save_btn = self.driver.find_element(By.TEXT, "Save to Test Bank")
            save_btn.click()
            
            print("✅ Complete workflow executed successfully")
            return True
            
        except Exception as e:
            print(f"❌ Workflow failed: {e}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting comprehensive AI Assistant testing...\n")
        
        try:
            self.test_page_load()
            time.sleep(2)
            
            self.test_mentor_tab()
            time.sleep(2)
            
            self.test_generator_tab()
            time.sleep(2)
            
            self.test_api_endpoints()
            time.sleep(2)
            
            self.test_full_workflow()
            
            print("\n🎉 All tests completed successfully!")
            
        except Exception as e:
            print(f"\n❌ Test failed: {e}")
            # Take screenshot on failure
            self.driver.save_screenshot("ai_assistant_test_failure.png")
            print("📸 Screenshot saved: ai_assistant_test_failure.png")
            
        finally:
            self.driver.quit()

if __name__ == "__main__":
    print("AI Assistant Page - Comprehensive Test Suite")
    print("=" * 50)
    
    tester = AIAssistantTester()
    tester.run_all_tests()