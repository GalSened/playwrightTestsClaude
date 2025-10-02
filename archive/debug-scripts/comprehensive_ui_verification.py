"""
Comprehensive QA Intelligence UI Verification with Real Data
Page-by-page testing focusing on Scheduler and Test Bank modules
"""

import asyncio
import json
import time
from datetime import datetime
from playwright.async_api import async_playwright, Page, Browser, BrowserContext
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class QAIntelligenceUIVerification:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.browser = None
        self.context = None
        self.page = None
        self.verification_results = {
            "timestamp": datetime.now().isoformat(),
            "base_url": base_url,
            "pages_tested": [],
            "issues_found": [],
            "scheduler_tests": [],
            "test_bank_tests": [],
            "summary": {}
        }

    async def setup(self):
        """Initialize browser and context"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=False, args=['--start-maximized'])
        self.context = await self.browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) QA Intelligence Verification Bot"
        )
        self.page = await self.context.new_page()
        
        # Enable request/response logging
        self.page.on("request", lambda request: logger.info(f"REQUEST: {request.method} {request.url}"))
        self.page.on("response", lambda response: logger.info(f"RESPONSE: {response.status} {response.url}"))
        
        logger.info("Browser setup completed")

    async def teardown(self):
        """Clean up browser resources"""
        if self.browser:
            await self.browser.close()
        logger.info("Browser teardown completed")

    async def take_screenshot(self, name: str):
        """Take a screenshot for documentation"""
        filename = f"verification_{name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        await self.page.screenshot(path=filename, full_page=True)
        logger.info(f"Screenshot saved: {filename}")
        return filename

    async def wait_for_loading(self, timeout: int = 30000):
        """Wait for page loading to complete"""
        try:
            # Wait for network idle
            await self.page.wait_for_load_state('networkidle', timeout=timeout)
            
            # Wait for any loading spinners to disappear
            loading_selectors = [
                '[data-testid="loading"]',
                '.loading',
                '.spinner',
                '[role="progressbar"]'
            ]
            
            for selector in loading_selectors:
                try:
                    await self.page.wait_for_selector(selector, state='detached', timeout=2000)
                except:
                    pass  # Selector not found, which is fine
            
        except Exception as e:
            logger.warning(f"Loading wait timeout: {e}")

    async def verify_page_basics(self, page_name: str, expected_title: str = None):
        """Verify basic page functionality"""
        result = {
            "page": page_name,
            "timestamp": datetime.now().isoformat(),
            "url": self.page.url,
            "title": await self.page.title(),
            "issues": [],
            "elements_verified": []
        }

        try:
            # Verify page loads
            await self.wait_for_loading()
            
            # Check for error messages
            error_selectors = [
                '[role="alert"]',
                '.error',
                '.error-message',
                '[data-testid="error"]'
            ]
            
            for selector in error_selectors:
                error_elements = await self.page.query_selector_all(selector)
                for element in error_elements:
                    error_text = await element.text_content()
                    if error_text and error_text.strip():
                        result["issues"].append({
                            "type": "error_message",
                            "message": error_text.strip(),
                            "selector": selector
                        })

            # Verify title if expected
            if expected_title and expected_title not in result["title"]:
                result["issues"].append({
                    "type": "title_mismatch",
                    "expected": expected_title,
                    "actual": result["title"]
                })

            # Check for basic navigation elements
            nav_elements = [
                'nav',
                '[role="navigation"]',
                '.navigation',
                '.nav-menu'
            ]
            
            for selector in nav_elements:
                if await self.page.query_selector(selector):
                    result["elements_verified"].append(f"Navigation: {selector}")
                    break

            logger.info(f"Page verification completed for {page_name}: {len(result['issues'])} issues found")
            
        except Exception as e:
            result["issues"].append({
                "type": "verification_error",
                "message": str(e)
            })
            logger.error(f"Error verifying {page_name}: {e}")

        self.verification_results["pages_tested"].append(result)
        return result

    async def verify_dashboard_page(self):
        """Verify main dashboard functionality"""
        logger.info("Verifying Dashboard Page...")
        
        await self.page.goto(self.base_url)
        await self.take_screenshot("01_dashboard_initial")
        
        result = await self.verify_page_basics("Dashboard", "QA Intelligence")
        
        # Dashboard-specific verifications
        dashboard_elements = [
            ('[data-testid="dashboard-stats"]', "Dashboard statistics"),
            ('[data-testid="recent-tests"]', "Recent tests section"),
            ('[data-testid="test-overview"]', "Test overview"),
            ('.stats-card', "Statistics cards"),
            ('nav', "Navigation menu")
        ]
        
        for selector, description in dashboard_elements:
            try:
                element = await self.page.query_selector(selector)
                if element:
                    result["elements_verified"].append(f"Found: {description}")
                else:
                    result["issues"].append({
                        "type": "missing_element",
                        "element": description,
                        "selector": selector
                    })
            except Exception as e:
                result["issues"].append({
                    "type": "element_check_error",
                    "element": description,
                    "error": str(e)
                })

        await self.take_screenshot("02_dashboard_verified")
        logger.info(f"Dashboard verification completed: {len(result['issues'])} issues")
        return result

    async def verify_test_bank_page(self):
        """Verify Test Bank functionality - Critical focus area"""
        logger.info("Verifying Test Bank Page - CRITICAL MODULE...")
        
        # Navigate to test bank
        await self.page.goto(f"{self.base_url}/test-bank")
        await self.take_screenshot("03_test_bank_initial")
        
        result = await self.verify_page_basics("Test Bank", "Test Bank")
        
        # Test Bank specific verifications
        test_bank_elements = [
            ('[data-testid="test-suite-list"]', "Test suite list"),
            ('[data-testid="test-search"]', "Test search functionality"),
            ('[data-testid="test-filter"]', "Test filtering options"),
            ('[data-testid="create-test"]', "Create test button"),
            ('.test-suite-card', "Test suite cards"),
            ('.test-count', "Test count display")
        ]
        
        for selector, description in test_bank_elements:
            try:
                elements = await self.page.query_selector_all(selector)
                if elements:
                    result["elements_verified"].append(f"Found {len(elements)}: {description}")
                    
                    # Special handling for test suite cards - check for real data
                    if 'card' in selector:
                        for i, element in enumerate(elements[:3]):  # Check first 3
                            text_content = await element.text_content()
                            if text_content and len(text_content.strip()) > 0:
                                result["elements_verified"].append(f"Test suite {i+1} has content: {text_content[:50]}...")
                            else:
                                result["issues"].append({
                                    "type": "empty_test_data",
                                    "element": f"Test suite card {i+1}",
                                    "message": "No content found in test suite card"
                                })
                else:
                    result["issues"].append({
                        "type": "missing_critical_element",
                        "element": description,
                        "selector": selector,
                        "severity": "high"
                    })
            except Exception as e:
                result["issues"].append({
                    "type": "test_bank_verification_error",
                    "element": description,
                    "error": str(e),
                    "severity": "high"
                })

        # Test interaction with test bank
        try:
            # Try to click on a test suite if available
            test_suites = await self.page.query_selector_all('.test-suite-card, [data-testid="test-suite"]')
            if test_suites:
                logger.info(f"Found {len(test_suites)} test suites, attempting to interact with first one")
                await test_suites[0].click()
                await self.wait_for_loading()
                await self.take_screenshot("04_test_bank_suite_details")
                result["elements_verified"].append("Successfully clicked on test suite")
            else:
                result["issues"].append({
                    "type": "no_test_suites",
                    "message": "No test suites found to interact with",
                    "severity": "high"
                })

            # Try search functionality
            search_input = await self.page.query_selector('input[type="search"], [data-testid="search"], .search-input')
            if search_input:
                await search_input.fill("test")
                await self.page.keyboard.press('Enter')
                await self.wait_for_loading(timeout=10000)
                await self.take_screenshot("05_test_bank_search")
                result["elements_verified"].append("Search functionality tested")
            else:
                result["issues"].append({
                    "type": "missing_search",
                    "message": "Search functionality not found"
                })

        except Exception as e:
            result["issues"].append({
                "type": "test_bank_interaction_error",
                "error": str(e),
                "severity": "medium"
            })

        self.verification_results["test_bank_tests"].append(result)
        logger.info(f"Test Bank verification completed: {len(result['issues'])} issues")
        return result

    async def verify_scheduler_page(self):
        """Verify Scheduler functionality - Critical focus area"""
        logger.info("Verifying Scheduler Page - CRITICAL MODULE...")
        
        # Navigate to scheduler
        await self.page.goto(f"{self.base_url}/scheduler")
        await self.take_screenshot("06_scheduler_initial")
        
        result = await self.verify_page_basics("Scheduler", "Scheduler")
        
        # Scheduler specific verifications
        scheduler_elements = [
            ('[data-testid="create-schedule"]', "Create schedule button"),
            ('[data-testid="schedule-list"]', "Schedule list"),
            ('[data-testid="schedule-form"]', "Schedule form"),
            ('.schedule-card', "Schedule cards"),
            ('.schedule-status', "Schedule status indicators"),
            ('select[name="testSuite"], [data-testid="test-suite-selector"]', "Test suite selector")
        ]
        
        for selector, description in scheduler_elements:
            try:
                elements = await self.page.query_selector_all(selector)
                if elements:
                    result["elements_verified"].append(f"Found {len(elements)}: {description}")
                    
                    # Check for real data in schedule cards
                    if 'card' in selector:
                        for i, element in enumerate(elements[:3]):
                            text_content = await element.text_content()
                            if text_content and len(text_content.strip()) > 0:
                                result["elements_verified"].append(f"Schedule {i+1} content: {text_content[:50]}...")
                            else:
                                result["issues"].append({
                                    "type": "empty_schedule_data",
                                    "element": f"Schedule card {i+1}",
                                    "message": "No content found in schedule card"
                                })
                else:
                    result["issues"].append({
                        "type": "missing_scheduler_element",
                        "element": description,
                        "selector": selector,
                        "severity": "high"
                    })
            except Exception as e:
                result["issues"].append({
                    "type": "scheduler_verification_error",
                    "element": description,
                    "error": str(e),
                    "severity": "high"
                })

        # Test scheduler interactions
        try:
            # Try to create a new schedule
            create_button = await self.page.query_selector('[data-testid="create-schedule"], .create-schedule, button:has-text("Create")')
            if create_button:
                await create_button.click()
                await self.wait_for_loading()
                await self.take_screenshot("07_scheduler_create_form")
                
                # Check if form opened
                form_elements = await self.page.query_selector_all('form, [data-testid="schedule-form"], .schedule-form')
                if form_elements:
                    result["elements_verified"].append("Schedule creation form opened successfully")
                    
                    # Try to interact with form elements
                    test_suite_selector = await self.page.query_selector('select[name="testSuite"], [data-testid="test-suite-select"]')
                    if test_suite_selector:
                        # Check if there are options
                        options = await self.page.query_selector_all('select[name="testSuite"] option, [data-testid="test-suite-select"] option')
                        if len(options) > 1:  # More than just placeholder
                            result["elements_verified"].append(f"Found {len(options)} test suite options")
                        else:
                            result["issues"].append({
                                "type": "no_test_suite_options",
                                "message": "No test suite options available for scheduling",
                                "severity": "high"
                            })
                    else:
                        result["issues"].append({
                            "type": "missing_test_suite_selector",
                            "message": "Test suite selector not found in scheduler form",
                            "severity": "high"
                        })
                        
                else:
                    result["issues"].append({
                        "type": "scheduler_form_not_opening",
                        "message": "Schedule creation form did not open",
                        "severity": "high"
                    })
            else:
                result["issues"].append({
                    "type": "no_create_button",
                    "message": "Create schedule button not found",
                    "severity": "high"
                })

        except Exception as e:
            result["issues"].append({
                "type": "scheduler_interaction_error",
                "error": str(e),
                "severity": "high"
            })

        self.verification_results["scheduler_tests"].append(result)
        logger.info(f"Scheduler verification completed: {len(result['issues'])} issues")
        return result

    async def verify_reports_page(self):
        """Verify Reports page functionality"""
        logger.info("Verifying Reports Page...")
        
        await self.page.goto(f"{self.base_url}/reports")
        await self.take_screenshot("08_reports_initial")
        
        result = await self.verify_page_basics("Reports", "Reports")
        
        # Reports specific verifications
        report_elements = [
            ('[data-testid="report-list"]', "Report list"),
            ('[data-testid="report-filters"]', "Report filters"),
            ('.report-card', "Report cards"),
            ('.report-summary', "Report summaries"),
            ('chart, canvas, svg', "Charts/visualizations")
        ]
        
        for selector, description in report_elements:
            try:
                elements = await self.page.query_selector_all(selector)
                if elements:
                    result["elements_verified"].append(f"Found {len(elements)}: {description}")
                else:
                    result["issues"].append({
                        "type": "missing_report_element",
                        "element": description,
                        "selector": selector
                    })
            except Exception as e:
                result["issues"].append({
                    "type": "report_verification_error",
                    "element": description,
                    "error": str(e)
                })

        await self.take_screenshot("09_reports_verified")
        return result

    async def verify_analytics_page(self):
        """Verify Analytics page functionality"""
        logger.info("Verifying Analytics Page...")
        
        await self.page.goto(f"{self.base_url}/analytics")
        await self.take_screenshot("10_analytics_initial")
        
        result = await self.verify_page_basics("Analytics", "Analytics")
        
        # Analytics specific verifications
        analytics_elements = [
            ('chart, canvas, svg', "Charts/visualizations"),
            ('[data-testid="analytics-dashboard"]', "Analytics dashboard"),
            ('.metric-card', "Metric cards"),
            ('.chart-container', "Chart containers"),
            ('[data-testid="date-filter"]', "Date filters")
        ]
        
        for selector, description in analytics_elements:
            try:
                elements = await self.page.query_selector_all(selector)
                if elements:
                    result["elements_verified"].append(f"Found {len(elements)}: {description}")
                else:
                    result["issues"].append({
                        "type": "missing_analytics_element",
                        "element": description,
                        "selector": selector
                    })
            except Exception as e:
                result["issues"].append({
                    "type": "analytics_verification_error",
                    "element": description,
                    "error": str(e)
                })

        await self.take_screenshot("11_analytics_verified")
        return result

    async def verify_ai_assistant_page(self):
        """Verify AI Assistant page functionality"""
        logger.info("Verifying AI Assistant Page...")
        
        await self.page.goto(f"{self.base_url}/ai-assistant")
        await self.take_screenshot("12_ai_assistant_initial")
        
        result = await self.verify_page_basics("AI Assistant", "AI Assistant")
        
        # AI Assistant specific verifications
        ai_elements = [
            ('[data-testid="chat-interface"]', "Chat interface"),
            ('[data-testid="message-input"]', "Message input"),
            ('.chat-message', "Chat messages"),
            ('.ai-suggestions', "AI suggestions"),
            ('button[type="submit"], .send-button', "Send button")
        ]
        
        for selector, description in ai_elements:
            try:
                elements = await self.page.query_selector_all(selector)
                if elements:
                    result["elements_verified"].append(f"Found {len(elements)}: {description}")
                else:
                    result["issues"].append({
                        "type": "missing_ai_element",
                        "element": description,
                        "selector": selector
                    })
            except Exception as e:
                result["issues"].append({
                    "type": "ai_verification_error",
                    "element": description,
                    "error": str(e)
                })

        await self.take_screenshot("13_ai_assistant_verified")
        return result

    async def generate_summary(self):
        """Generate verification summary"""
        total_pages = len(self.verification_results["pages_tested"])
        total_issues = sum(len(page["issues"]) for page in self.verification_results["pages_tested"])
        critical_issues = sum(1 for page in self.verification_results["pages_tested"] 
                            for issue in page["issues"] 
                            if issue.get("severity") == "high")
        
        self.verification_results["summary"] = {
            "total_pages_tested": total_pages,
            "total_issues_found": total_issues,
            "critical_issues": critical_issues,
            "scheduler_issues": len(self.verification_results["scheduler_tests"][0]["issues"]) if self.verification_results["scheduler_tests"] else 0,
            "test_bank_issues": len(self.verification_results["test_bank_tests"][0]["issues"]) if self.verification_results["test_bank_tests"] else 0,
            "status": "PASS" if critical_issues == 0 else "FAIL_CRITICAL" if critical_issues > 5 else "ISSUES_FOUND"
        }
        
        logger.info(f"Verification Summary: {total_pages} pages, {total_issues} total issues, {critical_issues} critical issues")

    async def save_results(self):
        """Save verification results to file"""
        filename = f"qa_intelligence_verification_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.verification_results, f, indent=2, ensure_ascii=False)
        logger.info(f"Verification results saved to: {filename}")
        return filename

    async def run_full_verification(self):
        """Run complete UI verification"""
        logger.info("Starting QA Intelligence UI Verification...")
        
        try:
            await self.setup()
            
            # Core pages verification
            await self.verify_dashboard_page()
            
            # Critical modules - focus areas
            await self.verify_test_bank_page()
            await self.verify_scheduler_page()
            
            # Additional pages
            await self.verify_reports_page()
            await self.verify_analytics_page()
            await self.verify_ai_assistant_page()
            
            # Generate summary and save results
            await self.generate_summary()
            results_file = await self.save_results()
            
            logger.info("=== VERIFICATION COMPLETE ===")
            logger.info(f"Status: {self.verification_results['summary']['status']}")
            logger.info(f"Critical Issues: {self.verification_results['summary']['critical_issues']}")
            logger.info(f"Scheduler Issues: {self.verification_results['summary']['scheduler_issues']}")
            logger.info(f"Test Bank Issues: {self.verification_results['summary']['test_bank_issues']}")
            logger.info(f"Results saved to: {results_file}")
            
            return self.verification_results
            
        except Exception as e:
            logger.error(f"Verification failed: {e}")
            self.verification_results["fatal_error"] = str(e)
            return self.verification_results
        finally:
            await self.teardown()

async def main():
    """Main execution function"""
    verifier = QAIntelligenceUIVerification("http://localhost:3000")
    results = await verifier.run_full_verification()
    
    # Print critical findings
    print("\n" + "="*80)
    print("QA INTELLIGENCE UI VERIFICATION RESULTS")
    print("="*80)
    print(f"Status: {results['summary']['status']}")
    print(f"Pages Tested: {results['summary']['total_pages_tested']}")
    print(f"Total Issues: {results['summary']['total_issues_found']}")
    print(f"Critical Issues: {results['summary']['critical_issues']}")
    print(f"Scheduler Issues: {results['summary']['scheduler_issues']}")
    print(f"Test Bank Issues: {results['summary']['test_bank_issues']}")
    
    if results["summary"]["critical_issues"] > 0:
        print("\n⚠️  CRITICAL ISSUES FOUND:")
        for page in results["pages_tested"]:
            for issue in page["issues"]:
                if issue.get("severity") == "high":
                    print(f"  - {page['page']}: {issue.get('message', issue.get('type', 'Unknown issue'))}")
    else:
        print("\n✅ No critical issues found!")
    
    print("="*80)

if __name__ == "__main__":
    asyncio.run(main())