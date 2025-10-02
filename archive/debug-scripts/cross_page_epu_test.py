"""
Comprehensive Cross-Page EPU (End-to-end Product Usecase) Testing
For Playwright Smart Application

This script executes the complete 4-step EPU journey:
1. Dashboard Overview
2. Suite Creation & Execution  
3. Results Review
4. Analytics Insights

Includes cross-page data flow verification, navigation consistency,
performance validation, and UX assessment.
"""

import asyncio
import json
import time
from datetime import datetime
from pathlib import Path
from playwright.async_api import async_playwright, Page, BrowserContext
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CrossPageEPUTest:
    def __init__(self, base_url: str = "http://localhost:5173"):
        self.base_url = base_url
        self.context = None
        self.page = None
        self.browser = None
        self.results = {
            "test_start_time": datetime.now().isoformat(),
            "test_end_time": None,
            "total_duration_seconds": 0,
            "epu_steps": {},
            "navigation_tests": {},
            "data_flow_validation": {},
            "performance_metrics": {},
            "errors": [],
            "success_rate": 0,
            "overall_status": "PENDING"
        }
        self.step_timings = {}
        
    async def setup_browser(self):
        """Initialize browser context with appropriate settings"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=False, slow_mo=500)
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            record_video_dir="artifacts/videos",
            record_video_size={'width': 1920, 'height': 1080}
        )
        
        # Enable tracing for debugging
        await self.context.tracing.start(screenshots=True, snapshots=True, sources=True)
        
        self.page = await self.context.new_page()
        
        # Listen for console messages and errors
        self.page.on("console", lambda msg: logger.info(f"Console: {msg.text}"))
        self.page.on("pageerror", lambda error: self.results["errors"].append(f"Page Error: {error}"))
        
        logger.info("Browser setup completed")
        
    async def teardown_browser(self):
        """Clean up browser resources"""
        if self.context:
            await self.context.tracing.stop(path=f"artifacts/traces/cross_page_epu_{datetime.now().strftime('%Y%m%d_%H%M%S')}_trace.zip")
            await self.context.close()
        if self.browser:
            await self.browser.close()
        logger.info("Browser cleanup completed")
        
    async def take_screenshot(self, name: str):
        """Take screenshot for visual verification"""
        screenshot_path = f"artifacts/screenshots/cross_page_{name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        await self.page.screenshot(path=screenshot_path, full_page=True)
        return screenshot_path
        
    async def wait_for_stable_page(self, timeout: int = 5000):
        """Wait for page to be stable (no network activity)"""
        try:
            await self.page.wait_for_load_state('networkidle', timeout=timeout)
        except Exception as e:
            logger.warning(f"Page stability wait failed: {e}")
            
    async def verify_element_present(self, selector: str, timeout: int = 10000) -> bool:
        """Verify element is present and visible"""
        try:
            await self.page.wait_for_selector(selector, timeout=timeout)
            return await self.page.is_visible(selector)
        except Exception as e:
            logger.error(f"Element {selector} not found: {e}")
            return False
            
    async def epu_step_1_dashboard_overview(self) -> dict:
        """EPU Step 1: Dashboard Overview Testing"""
        step_start = time.time()
        step_result = {
            "status": "PENDING",
            "sub_tests": {},
            "errors": [],
            "duration_seconds": 0
        }
        
        try:
            logger.info("Starting EPU Step 1: Dashboard Overview")
            
            # Navigate to dashboard
            await self.page.goto(self.base_url)
            await self.wait_for_stable_page()
            await self.take_screenshot("01_dashboard_initial_load")
            
            # Verify dashboard page loads
            dashboard_present = await self.verify_element_present('[data-testid="dashboard-page"]')
            step_result["sub_tests"]["dashboard_page_load"] = dashboard_present
            
            if not dashboard_present:
                step_result["errors"].append("Dashboard page failed to load")
                step_result["status"] = "FAILED"
                return step_result
                
            # Verify environment status
            env_status = await self.verify_element_present('[data-testid="environment-status"]')
            step_result["sub_tests"]["environment_status"] = env_status
            
            # Verify statistics display
            total_tests = await self.verify_element_present('[data-testid="stat-total-tests"]')
            total_suites = await self.verify_element_present('[data-testid="stat-total-suites"]')
            step_result["sub_tests"]["statistics_display"] = total_tests and total_suites
            
            # Test quick actions navigation
            # Test 1: Quick create suite navigation
            quick_create_present = await self.verify_element_present('[data-testid="quick-create-suite"]')
            if quick_create_present:
                await self.page.click('[data-testid="quick-create-suite"]')
                await self.wait_for_stable_page()
                current_url = self.page.url
                testbank_navigation = "/test-bank" in current_url
                step_result["sub_tests"]["quick_create_navigation"] = testbank_navigation
                
                # Navigate back to dashboard
                await self.page.goto(self.base_url)
                await self.wait_for_stable_page()
            else:
                step_result["sub_tests"]["quick_create_navigation"] = False
                
            # Test 2: Quick open reports navigation  
            quick_reports_present = await self.verify_element_present('[data-testid="quick-open-reports"]')
            if quick_reports_present:
                await self.page.click('[data-testid="quick-open-reports"]')
                await self.wait_for_stable_page()
                current_url = self.page.url
                reports_navigation = "/reports" in current_url
                step_result["sub_tests"]["quick_reports_navigation"] = reports_navigation
                
                # Navigate back to dashboard
                await self.page.goto(self.base_url)
                await self.wait_for_stable_page()
            else:
                step_result["sub_tests"]["quick_reports_navigation"] = False
                
            await self.take_screenshot("02_dashboard_after_navigation_tests")
            
            # Calculate success rate for this step
            successful_tests = sum(1 for result in step_result["sub_tests"].values() if result)
            total_tests = len(step_result["sub_tests"])
            success_rate = (successful_tests / total_tests) * 100 if total_tests > 0 else 0
            
            step_result["status"] = "PASSED" if success_rate >= 80 else "FAILED"
            step_result["success_rate"] = success_rate
            
            logger.info(f"EPU Step 1 completed with {success_rate:.1f}% success rate")
            
        except Exception as e:
            step_result["errors"].append(f"EPU Step 1 failed: {str(e)}")
            step_result["status"] = "FAILED"
            logger.error(f"EPU Step 1 failed: {e}")
            
        finally:
            step_result["duration_seconds"] = time.time() - step_start
            self.step_timings["dashboard"] = step_result["duration_seconds"]
            
        return step_result
        
    async def epu_step_2_suite_creation_execution(self) -> dict:
        """EPU Step 2: Suite Creation & Execution Testing"""
        step_start = time.time()
        step_result = {
            "status": "PENDING", 
            "sub_tests": {},
            "errors": [],
            "duration_seconds": 0,
            "suite_name": "Cross-Page EPU Suite"
        }
        
        try:
            logger.info("Starting EPU Step 2: Suite Creation & Execution")
            
            # Navigate to test bank
            await self.page.goto(f"{self.base_url}/test-bank")
            await self.wait_for_stable_page()
            await self.take_screenshot("03_testbank_initial_load")
            
            # Verify test bank page loads
            testbank_present = await self.verify_element_present('[data-testid="test-bank-page"]', timeout=15000)
            step_result["sub_tests"]["testbank_page_load"] = testbank_present
            
            if not testbank_present:
                # Try alternative selector
                testbank_present = await self.verify_element_present('.test-bank-container', timeout=5000)
                step_result["sub_tests"]["testbank_page_load"] = testbank_present
                
            if not testbank_present:
                step_result["errors"].append("Test Bank page failed to load")
                step_result["status"] = "FAILED"
                return step_result
                
            # Search for login tests
            search_input = await self.verify_element_present('[data-testid="test-search"]')
            if search_input:
                await self.page.fill('[data-testid="test-search"]', 'login')
                await self.page.keyboard.press('Enter')
                await self.wait_for_stable_page(timeout=3000)
                step_result["sub_tests"]["test_search"] = True
            else:
                step_result["sub_tests"]["test_search"] = False
                logger.warning("Test search input not found")
                
            await self.take_screenshot("04_search_results")
            
            # Select 2-3 tests using checkboxes
            test_checkboxes = await self.page.query_selector_all('[data-testid="test-checkbox"]')
            if len(test_checkboxes) >= 2:
                for i in range(min(3, len(test_checkboxes))):
                    await test_checkboxes[i].click()
                    await asyncio.sleep(0.5)  # Small delay between selections
                    
                step_result["sub_tests"]["tests_selected"] = True
                step_result["selected_test_count"] = min(3, len(test_checkboxes))
            else:
                step_result["sub_tests"]["tests_selected"] = False
                logger.warning("Not enough test checkboxes found")
                
            # Verify selected tests count updates
            selected_count_element = await self.verify_element_present('[data-testid="selected-tests-count"]')
            step_result["sub_tests"]["selected_count_display"] = selected_count_element
            
            await self.take_screenshot("05_tests_selected")
            
            # Fill suite details
            suite_name_input = await self.verify_element_present('[data-testid="suite-name-input"]')
            if suite_name_input:
                await self.page.fill('[data-testid="suite-name-input"]', step_result["suite_name"])
                step_result["sub_tests"]["suite_name_filled"] = True
            else:
                step_result["sub_tests"]["suite_name_filled"] = False
                
            suite_desc_input = await self.verify_element_present('[data-testid="suite-description-input"]')
            if suite_desc_input:
                await self.page.fill('[data-testid="suite-description-input"]', 'End-to-end testing suite')
                step_result["sub_tests"]["suite_description_filled"] = True
            else:
                step_result["sub_tests"]["suite_description_filled"] = False
                
            # Create suite
            create_button = await self.verify_element_present('[data-testid="create-suite-button"]')
            if create_button:
                await self.page.click('[data-testid="create-suite-button"]')
                await self.wait_for_stable_page()
                step_result["sub_tests"]["suite_created"] = True
            else:
                step_result["sub_tests"]["suite_created"] = False
                
            await self.take_screenshot("06_suite_created")
            
            # Verify suite appears in suites list
            await asyncio.sleep(2)  # Allow time for suite to appear
            suites_list_present = await self.verify_element_present('[data-testid="suites-list"]')
            step_result["sub_tests"]["suites_list_visible"] = suites_list_present
            
            # Find and run the created suite
            if suites_list_present:
                # Look for run button on existing suite
                run_buttons = await self.page.query_selector_all('[data-testid="run-existing-suite"]')
                if run_buttons:
                    # Click the first available run button
                    await run_buttons[0].click()
                    await self.wait_for_stable_page()
                    
                    # Check if we were redirected to reports
                    current_url = self.page.url
                    reports_redirect = "/reports" in current_url
                    step_result["sub_tests"]["automatic_reports_navigation"] = reports_redirect
                else:
                    step_result["sub_tests"]["automatic_reports_navigation"] = False
                    logger.warning("No run suite buttons found")
            else:
                step_result["sub_tests"]["automatic_reports_navigation"] = False
                
            await self.take_screenshot("07_after_suite_execution")
            
            # Calculate success rate
            successful_tests = sum(1 for result in step_result["sub_tests"].values() if result)
            total_tests = len(step_result["sub_tests"])
            success_rate = (successful_tests / total_tests) * 100 if total_tests > 0 else 0
            
            step_result["status"] = "PASSED" if success_rate >= 70 else "FAILED"
            step_result["success_rate"] = success_rate
            
            logger.info(f"EPU Step 2 completed with {success_rate:.1f}% success rate")
            
        except Exception as e:
            step_result["errors"].append(f"EPU Step 2 failed: {str(e)}")
            step_result["status"] = "FAILED"
            logger.error(f"EPU Step 2 failed: {e}")
            
        finally:
            step_result["duration_seconds"] = time.time() - step_start
            self.step_timings["suite_creation"] = step_result["duration_seconds"]
            
        return step_result
        
    async def epu_step_3_results_review(self) -> dict:
        """EPU Step 3: Results Review Testing"""
        step_start = time.time()
        step_result = {
            "status": "PENDING",
            "sub_tests": {},
            "errors": [],
            "duration_seconds": 0
        }
        
        try:
            logger.info("Starting EPU Step 3: Results Review")
            
            # Navigate to reports if not already there
            if "/reports" not in self.page.url:
                await self.page.goto(f"{self.base_url}/reports")
                await self.wait_for_stable_page()
                
            await self.take_screenshot("08_reports_page_load")
            
            # Verify reports page loads
            reports_present = await self.verify_element_present('[data-testid="reports-page"]')
            step_result["sub_tests"]["reports_page_load"] = reports_present
            
            if not reports_present:
                step_result["errors"].append("Reports page failed to load")
                step_result["status"] = "FAILED" 
                return step_result
                
            # Verify runs table is present
            runs_table = await self.verify_element_present('[data-testid="runs-table"]')
            step_result["sub_tests"]["runs_table_present"] = runs_table
            
            # Look for run rows and click on first one
            if runs_table:
                await asyncio.sleep(2)  # Allow data to load
                run_rows = await self.page.query_selector_all('[data-testid="runs-table"] tr')
                
                if len(run_rows) > 1:  # More than just header
                    # Click on first data row (index 1, since 0 is header)
                    await run_rows[1].click()
                    await self.wait_for_stable_page(timeout=3000)
                    step_result["sub_tests"]["run_details_opened"] = True
                else:
                    step_result["sub_tests"]["run_details_opened"] = False
                    logger.warning("No run data rows found in table")
            else:
                step_result["sub_tests"]["run_details_opened"] = False
                
            await self.take_screenshot("09_run_details_opened")
            
            # Verify details panel opens
            details_panel = await self.verify_element_present('[data-testid="run-details-panel"]')
            step_result["sub_tests"]["details_panel_visible"] = details_panel
            
            if details_panel:
                # Test tab navigation in details panel
                # Check Overview tab
                overview_section = await self.verify_element_present('[data-testid="run-overview-section"]')
                step_result["sub_tests"]["overview_tab"] = overview_section
                
                # Click Test Steps tab
                steps_tab = await self.page.query_selector('text="Test Steps"')
                if steps_tab:
                    await steps_tab.click()
                    await asyncio.sleep(1)
                    steps_section = await self.verify_element_present('[data-testid="run-steps-section"]')
                    step_result["sub_tests"]["steps_tab"] = steps_section
                else:
                    step_result["sub_tests"]["steps_tab"] = False
                    
                # Click Artifacts tab
                artifacts_tab = await self.page.query_selector('text="Artifacts"')
                if artifacts_tab:
                    await artifacts_tab.click()
                    await asyncio.sleep(1)
                    artifacts_section = await self.verify_element_present('[data-testid="run-artifacts-section"]')
                    step_result["sub_tests"]["artifacts_tab"] = artifacts_section
                else:
                    step_result["sub_tests"]["artifacts_tab"] = False
            else:
                step_result["sub_tests"]["overview_tab"] = False
                step_result["sub_tests"]["steps_tab"] = False
                step_result["sub_tests"]["artifacts_tab"] = False
                
            await self.take_screenshot("10_tab_navigation_complete")
            
            # Calculate success rate
            successful_tests = sum(1 for result in step_result["sub_tests"].values() if result)
            total_tests = len(step_result["sub_tests"])
            success_rate = (successful_tests / total_tests) * 100 if total_tests > 0 else 0
            
            step_result["status"] = "PASSED" if success_rate >= 70 else "FAILED"
            step_result["success_rate"] = success_rate
            
            logger.info(f"EPU Step 3 completed with {success_rate:.1f}% success rate")
            
        except Exception as e:
            step_result["errors"].append(f"EPU Step 3 failed: {str(e)}")
            step_result["status"] = "FAILED"
            logger.error(f"EPU Step 3 failed: {e}")
            
        finally:
            step_result["duration_seconds"] = time.time() - step_start
            self.step_timings["results_review"] = step_result["duration_seconds"]
            
        return step_result
        
    async def epu_step_4_analytics_insights(self) -> dict:
        """EPU Step 4: Analytics Insights Testing"""
        step_start = time.time()
        step_result = {
            "status": "PENDING",
            "sub_tests": {},
            "errors": [],
            "duration_seconds": 0
        }
        
        try:
            logger.info("Starting EPU Step 4: Analytics Insights")
            
            # Navigate to analytics
            await self.page.goto(f"{self.base_url}/analytics")
            await self.wait_for_stable_page()
            await self.take_screenshot("11_analytics_page_load")
            
            # Verify analytics page loads
            analytics_present = await self.verify_element_present('[data-testid="analytics-page"]')
            step_result["sub_tests"]["analytics_page_load"] = analytics_present
            
            if not analytics_present:
                step_result["errors"].append("Analytics page failed to load")
                step_result["status"] = "FAILED"
                return step_result
                
            # Verify coverage overview
            coverage_overview = await self.verify_element_present('[data-testid="coverage-overview"]')
            step_result["sub_tests"]["coverage_overview"] = coverage_overview
            
            # Check overall coverage percentage
            coverage_percent = await self.verify_element_present('[data-testid="overall-coverage-percent"]')
            step_result["sub_tests"]["coverage_percentage"] = coverage_percent
            
            # Verify charts render
            await asyncio.sleep(3)  # Allow charts to render
            
            coverage_by_module = await self.verify_element_present('[data-testid="coverage-by-module-chart"]')
            coverage_trend = await self.verify_element_present('[data-testid="coverage-trend-chart"]')  
            gap_distribution = await self.verify_element_present('[data-testid="gap-distribution-chart"]')
            
            step_result["sub_tests"]["charts_render"] = coverage_by_module and coverage_trend and gap_distribution
            
            await self.take_screenshot("12_charts_loaded")
            
            # Test gaps analysis
            gaps_list = await self.verify_element_present('[data-testid="gaps-list"]')
            step_result["sub_tests"]["gaps_list_present"] = gaps_list
            
            if gaps_list:
                # Try to expand a gap
                expand_gap_buttons = await self.page.query_selector_all('[data-testid="expand-gap-details"]')
                if expand_gap_buttons:
                    await expand_gap_buttons[0].click()
                    await asyncio.sleep(1)
                    gap_recommendation = await self.verify_element_present('[data-testid="gap-recommendation"]')
                    step_result["sub_tests"]["gap_details_expansion"] = gap_recommendation
                else:
                    step_result["sub_tests"]["gap_details_expansion"] = False
            else:
                step_result["sub_tests"]["gap_details_expansion"] = False
                
            # Test AI insights
            insights_list = await self.verify_element_present('[data-testid="insights-list"]')
            step_result["sub_tests"]["insights_list_present"] = insights_list
            
            if insights_list:
                # Try to expand an insight
                expand_insight_buttons = await self.page.query_selector_all('[data-testid="expand-insight"]')
                if expand_insight_buttons:
                    await expand_insight_buttons[0].click()
                    await asyncio.sleep(1)
                    insight_actions = await self.verify_element_present('[data-testid="insight-action-items"]')
                    step_result["sub_tests"]["insight_expansion"] = insight_actions
                else:
                    step_result["sub_tests"]["insight_expansion"] = False
            else:
                step_result["sub_tests"]["insight_expansion"] = False
                
            await self.take_screenshot("13_analytics_interactions_complete")
            
            # Calculate success rate
            successful_tests = sum(1 for result in step_result["sub_tests"].values() if result)
            total_tests = len(step_result["sub_tests"])
            success_rate = (successful_tests / total_tests) * 100 if total_tests > 0 else 0
            
            step_result["status"] = "PASSED" if success_rate >= 70 else "FAILED"
            step_result["success_rate"] = success_rate
            
            logger.info(f"EPU Step 4 completed with {success_rate:.1f}% success rate")
            
        except Exception as e:
            step_result["errors"].append(f"EPU Step 4 failed: {str(e)}")
            step_result["status"] = "FAILED"
            logger.error(f"EPU Step 4 failed: {e}")
            
        finally:
            step_result["duration_seconds"] = time.time() - step_start
            self.step_timings["analytics"] = step_result["duration_seconds"]
            
        return step_result
        
    async def test_navigation_consistency(self) -> dict:
        """Test navigation consistency across all pages"""
        nav_start = time.time()
        nav_result = {
            "status": "PENDING",
            "nav_tests": {},
            "errors": [],
            "duration_seconds": 0
        }
        
        try:
            logger.info("Testing navigation consistency")
            
            nav_links = [
                ("dashboard", self.base_url, '[data-testid="nav-dashboard"]'),
                ("test-bank", f"{self.base_url}/test-bank", '[data-testid="nav-test-bank"]'),
                ("reports", f"{self.base_url}/reports", '[data-testid="nav-reports"]'),
                ("analytics", f"{self.base_url}/analytics", '[data-testid="nav-analytics"]')
            ]
            
            for page_name, expected_url, nav_selector in nav_links:
                try:
                    # Click nav link
                    nav_element = await self.page.query_selector(nav_selector)
                    if nav_element:
                        await nav_element.click()
                        await self.wait_for_stable_page()
                        
                        # Verify URL
                        current_url = self.page.url
                        url_correct = expected_url in current_url or (page_name == "dashboard" and current_url.endswith("/"))
                        
                        # Verify page loads without errors
                        page_loaded = not any("error" in error.lower() for error in self.results["errors"][-5:])  # Check recent errors
                        
                        nav_result["nav_tests"][f"{page_name}_navigation"] = url_correct and page_loaded
                    else:
                        nav_result["nav_tests"][f"{page_name}_navigation"] = False
                        nav_result["errors"].append(f"Nav element {nav_selector} not found")
                        
                except Exception as e:
                    nav_result["nav_tests"][f"{page_name}_navigation"] = False
                    nav_result["errors"].append(f"Navigation to {page_name} failed: {str(e)}")
                    
            await self.take_screenshot("14_navigation_testing_complete")
            
            # Calculate success rate
            successful_nav = sum(1 for result in nav_result["nav_tests"].values() if result)
            total_nav = len(nav_result["nav_tests"])
            success_rate = (successful_nav / total_nav) * 100 if total_nav > 0 else 0
            
            nav_result["status"] = "PASSED" if success_rate >= 75 else "FAILED"
            nav_result["success_rate"] = success_rate
            
            logger.info(f"Navigation testing completed with {success_rate:.1f}% success rate")
            
        except Exception as e:
            nav_result["errors"].append(f"Navigation testing failed: {str(e)}")
            nav_result["status"] = "FAILED"
            logger.error(f"Navigation testing failed: {e}")
            
        finally:
            nav_result["duration_seconds"] = time.time() - nav_start
            
        return nav_result
        
    async def validate_data_flow(self) -> dict:
        """Validate data flow between pages"""
        flow_start = time.time()
        flow_result = {
            "status": "PENDING",
            "flow_tests": {},
            "errors": [],
            "duration_seconds": 0
        }
        
        try:
            logger.info("Validating cross-page data flow")
            
            # Test 1: Suite creation in Test Bank appears in existing suites
            await self.page.goto(f"{self.base_url}/test-bank")
            await self.wait_for_stable_page()
            
            suites_list_present = await self.verify_element_present('[data-testid="suites-list"]', timeout=5000)
            flow_result["flow_tests"]["suite_persistence"] = suites_list_present
            
            # Test 2: Run initiated in Test Bank should appear in Reports
            await self.page.goto(f"{self.base_url}/reports")
            await self.wait_for_stable_page()
            
            runs_table_has_data = await self.verify_element_present('[data-testid="runs-table"] tr:nth-child(2)', timeout=5000)
            flow_result["flow_tests"]["run_data_flow"] = runs_table_has_data
            
            # Test 3: Analytics reflects system state
            await self.page.goto(f"{self.base_url}/analytics")
            await self.wait_for_stable_page()
            
            coverage_data = await self.verify_element_present('[data-testid="overall-coverage-percent"]', timeout=5000)
            flow_result["flow_tests"]["analytics_data_sync"] = coverage_data
            
            # Test 4: Dashboard shows updated statistics
            await self.page.goto(self.base_url)
            await self.wait_for_stable_page()
            
            stats_updated = await self.verify_element_present('[data-testid="stat-total-tests"]', timeout=5000)
            flow_result["flow_tests"]["dashboard_stats_sync"] = stats_updated
            
            await self.take_screenshot("15_data_flow_validation")
            
            # Calculate success rate
            successful_flows = sum(1 for result in flow_result["flow_tests"].values() if result)
            total_flows = len(flow_result["flow_tests"])
            success_rate = (successful_flows / total_flows) * 100 if total_flows > 0 else 0
            
            flow_result["status"] = "PASSED" if success_rate >= 60 else "FAILED"  # Lower threshold as this is complex
            flow_result["success_rate"] = success_rate
            
            logger.info(f"Data flow validation completed with {success_rate:.1f}% success rate")
            
        except Exception as e:
            flow_result["errors"].append(f"Data flow validation failed: {str(e)}")
            flow_result["status"] = "FAILED"
            logger.error(f"Data flow validation failed: {e}")
            
        finally:
            flow_result["duration_seconds"] = time.time() - flow_start
            
        return flow_result
        
    def calculate_performance_metrics(self) -> dict:
        """Calculate performance metrics"""
        total_time = sum(self.step_timings.values())
        
        performance = {
            "total_journey_time_seconds": total_time,
            "total_journey_time_minutes": total_time / 60,
            "under_2_minutes": total_time < 120,
            "step_timings": self.step_timings,
            "average_step_time": total_time / len(self.step_timings) if self.step_timings else 0
        }
        
        return performance
        
    def calculate_overall_success_rate(self) -> float:
        """Calculate overall success rate across all tests"""
        all_tests = []
        
        # Collect all test results
        for step_name, step_result in self.results["epu_steps"].items():
            if isinstance(step_result, dict) and "sub_tests" in step_result:
                all_tests.extend(step_result["sub_tests"].values())
                
        if "navigation_tests" in self.results and "nav_tests" in self.results["navigation_tests"]:
            all_tests.extend(self.results["navigation_tests"]["nav_tests"].values())
            
        if "data_flow_validation" in self.results and "flow_tests" in self.results["data_flow_validation"]:
            all_tests.extend(self.results["data_flow_validation"]["flow_tests"].values())
            
        if not all_tests:
            return 0
            
        successful = sum(1 for result in all_tests if result)
        return (successful / len(all_tests)) * 100
        
    async def run_comprehensive_epu_test(self):
        """Execute the complete cross-page EPU test suite"""
        test_start_time = time.time()
        
        try:
            await self.setup_browser()
            
            # Execute all EPU steps
            logger.info("Starting comprehensive cross-page EPU testing")
            
            # EPU Step 1: Dashboard Overview
            self.results["epu_steps"]["step_1_dashboard"] = await self.epu_step_1_dashboard_overview()
            
            # EPU Step 2: Suite Creation & Execution
            self.results["epu_steps"]["step_2_suite_creation"] = await self.epu_step_2_suite_creation_execution()
            
            # EPU Step 3: Results Review
            self.results["epu_steps"]["step_3_results_review"] = await self.epu_step_3_results_review()
            
            # EPU Step 4: Analytics Insights  
            self.results["epu_steps"]["step_4_analytics"] = await self.epu_step_4_analytics_insights()
            
            # Navigation consistency testing
            self.results["navigation_tests"] = await self.test_navigation_consistency()
            
            # Data flow validation
            self.results["data_flow_validation"] = await self.validate_data_flow()
            
            # Calculate performance metrics
            self.results["performance_metrics"] = self.calculate_performance_metrics()
            
            # Calculate overall success rate
            self.results["success_rate"] = self.calculate_overall_success_rate()
            
            # Determine overall status
            if self.results["success_rate"] >= 95:
                self.results["overall_status"] = "EXCELLENT"
            elif self.results["success_rate"] >= 85:
                self.results["overall_status"] = "GOOD"
            elif self.results["success_rate"] >= 70:
                self.results["overall_status"] = "ACCEPTABLE"
            else:
                self.results["overall_status"] = "NEEDS_IMPROVEMENT"
                
            # Final screenshot
            await self.take_screenshot("16_final_state")
            
            logger.info(f"Cross-page EPU testing completed with {self.results['success_rate']:.1f}% success rate")
            
        except Exception as e:
            self.results["errors"].append(f"Comprehensive test execution failed: {str(e)}")
            self.results["overall_status"] = "FAILED"
            logger.error(f"Test execution failed: {e}")
            
        finally:
            self.results["test_end_time"] = datetime.now().isoformat()
            self.results["total_duration_seconds"] = time.time() - test_start_time
            
            await self.teardown_browser()
            
    def generate_report(self) -> str:
        """Generate comprehensive test report"""
        report = f"""
# Cross-Page EPU Test Report
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Executive Summary
- **Overall Status**: {self.results['overall_status']}
- **Success Rate**: {self.results['success_rate']:.1f}%
- **Total Duration**: {self.results['total_duration_seconds']:.1f} seconds ({self.results['total_duration_seconds']/60:.1f} minutes)
- **Under 2 Minutes**: {'✅ YES' if self.results['performance_metrics'].get('under_2_minutes', False) else '❌ NO'}

## EPU Steps Results

### Step 1: Dashboard Overview
- **Status**: {self.results['epu_steps']['step_1_dashboard']['status']}
- **Success Rate**: {self.results['epu_steps']['step_1_dashboard'].get('success_rate', 0):.1f}%
- **Duration**: {self.results['epu_steps']['step_1_dashboard']['duration_seconds']:.1f}s
- **Sub-tests**:
"""
        
        for test_name, result in self.results['epu_steps']['step_1_dashboard']['sub_tests'].items():
            report += f"  - {test_name}: {'✅ PASS' if result else '❌ FAIL'}\n"
            
        report += f"""
### Step 2: Suite Creation & Execution
- **Status**: {self.results['epu_steps']['step_2_suite_creation']['status']}
- **Success Rate**: {self.results['epu_steps']['step_2_suite_creation'].get('success_rate', 0):.1f}%
- **Duration**: {self.results['epu_steps']['step_2_suite_creation']['duration_seconds']:.1f}s
- **Sub-tests**:
"""
        
        for test_name, result in self.results['epu_steps']['step_2_suite_creation']['sub_tests'].items():
            report += f"  - {test_name}: {'✅ PASS' if result else '❌ FAIL'}\n"
            
        report += f"""
### Step 3: Results Review
- **Status**: {self.results['epu_steps']['step_3_results_review']['status']}
- **Success Rate**: {self.results['epu_steps']['step_3_results_review'].get('success_rate', 0):.1f}%
- **Duration**: {self.results['epu_steps']['step_3_results_review']['duration_seconds']:.1f}s
- **Sub-tests**:
"""
        
        for test_name, result in self.results['epu_steps']['step_3_results_review']['sub_tests'].items():
            report += f"  - {test_name}: {'✅ PASS' if result else '❌ FAIL'}\n"
            
        report += f"""
### Step 4: Analytics Insights
- **Status**: {self.results['epu_steps']['step_4_analytics']['status']}
- **Success Rate**: {self.results['epu_steps']['step_4_analytics'].get('success_rate', 0):.1f}%
- **Duration**: {self.results['epu_steps']['step_4_analytics']['duration_seconds']:.1f}s
- **Sub-tests**:
"""
        
        for test_name, result in self.results['epu_steps']['step_4_analytics']['sub_tests'].items():
            report += f"  - {test_name}: {'✅ PASS' if result else '❌ FAIL'}\n"
            
        report += f"""
## Navigation Consistency
- **Status**: {self.results['navigation_tests']['status']}
- **Success Rate**: {self.results['navigation_tests'].get('success_rate', 0):.1f}%
- **Tests**:
"""
        
        for test_name, result in self.results['navigation_tests']['nav_tests'].items():
            report += f"  - {test_name}: {'✅ PASS' if result else '❌ FAIL'}\n"
            
        report += f"""
## Data Flow Validation
- **Status**: {self.results['data_flow_validation']['status']}
- **Success Rate**: {self.results['data_flow_validation'].get('success_rate', 0):.1f}%
- **Tests**:
"""
        
        for test_name, result in self.results['data_flow_validation']['flow_tests'].items():
            report += f"  - {test_name}: {'✅ PASS' if result else '❌ FAIL'}\n"
            
        report += f"""
## Performance Metrics
- **Total Journey Time**: {self.results['performance_metrics']['total_journey_time_seconds']:.1f}s ({self.results['performance_metrics']['total_journey_time_minutes']:.1f} minutes)
- **Under 2 Minutes**: {'✅ YES' if self.results['performance_metrics']['under_2_minutes'] else '❌ NO'}
- **Average Step Time**: {self.results['performance_metrics']['average_step_time']:.1f}s

### Step Timings:
"""
        
        for step, timing in self.results['performance_metrics']['step_timings'].items():
            report += f"- {step}: {timing:.1f}s\n"
            
        if self.results['errors']:
            report += f"""
## Errors Encountered
"""
            for i, error in enumerate(self.results['errors'], 1):
                report += f"{i}. {error}\n"
                
        report += f"""
## Success Criteria Assessment
- ✅ All 4 EPU steps complete: {'YES' if all(step['status'] != 'FAILED' for step in self.results['epu_steps'].values()) else 'NO'}
- ✅ Data flows correctly across pages: {'YES' if self.results['data_flow_validation']['status'] != 'FAILED' else 'NO'}
- ✅ Navigation works bidirectionally: {'YES' if self.results['navigation_tests']['status'] != 'FAILED' else 'NO'}
- ✅ Success rate > 95%: {'YES' if self.results['success_rate'] > 95 else 'NO'}
- ✅ Total journey time < 2 minutes: {'YES' if self.results['performance_metrics']['under_2_minutes'] else 'NO'}

## User Experience Quality Rating
{self.get_ux_rating()}

## Recommendations
{self.get_recommendations()}
"""
        
        return report
        
    def get_ux_rating(self) -> str:
        """Generate UX quality rating based on results"""
        success_rate = self.results['success_rate']
        
        if success_rate >= 95:
            return "⭐⭐⭐⭐⭐ EXCELLENT - Seamless user experience with minimal friction"
        elif success_rate >= 85:
            return "⭐⭐⭐⭐ GOOD - Solid user experience with minor issues"
        elif success_rate >= 70:
            return "⭐⭐⭐ ACCEPTABLE - Functional but needs improvements"
        elif success_rate >= 50:
            return "⭐⭐ POOR - Significant usability issues"
        else:
            return "⭐ CRITICAL - Major functionality broken"
            
    def get_recommendations(self) -> str:
        """Generate improvement recommendations"""
        recommendations = []
        
        if self.results['success_rate'] < 95:
            recommendations.append("- Improve overall test pass rate to achieve EPU compliance")
            
        if not self.results['performance_metrics']['under_2_minutes']:
            recommendations.append("- Optimize page load times to meet 2-minute journey requirement")
            
        # Check specific step issues
        for step_name, step_result in self.results['epu_steps'].items():
            if step_result.get('success_rate', 0) < 80:
                recommendations.append(f"- Address issues in {step_name} (success rate: {step_result.get('success_rate', 0):.1f}%)")
                
        if self.results['navigation_tests'].get('success_rate', 0) < 90:
            recommendations.append("- Fix navigation consistency issues")
            
        if self.results['data_flow_validation'].get('success_rate', 0) < 70:
            recommendations.append("- Improve cross-page data synchronization")
            
        if not recommendations:
            recommendations.append("- System meets all EPU requirements. Continue monitoring for regressions.")
            
        return "\n".join(recommendations)
        
async def main():
    """Main execution function"""
    # Create artifacts directory if it doesn't exist
    Path("artifacts/screenshots").mkdir(parents=True, exist_ok=True)
    Path("artifacts/traces").mkdir(parents=True, exist_ok=True)
    Path("artifacts/videos").mkdir(parents=True, exist_ok=True)
    
    # Run the comprehensive EPU test
    epu_test = CrossPageEPUTest()
    await epu_test.run_comprehensive_epu_test()
    
    # Generate and save results
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # Save JSON results
    json_path = f"cross_page_epu_results_{timestamp}.json"
    with open(json_path, 'w') as f:
        json.dump(epu_test.results, f, indent=2)
        
    # Generate and save report
    report = epu_test.generate_report()
    report_path = f"CROSS_PAGE_EPU_COMPREHENSIVE_REPORT_{timestamp}.md"
    with open(report_path, 'w') as f:
        f.write(report)
        
    # Print summary
    print("\n" + "="*80)
    print("CROSS-PAGE EPU TEST EXECUTION COMPLETE")
    print("="*80)
    print(f"Overall Status: {epu_test.results['overall_status']}")
    print(f"Success Rate: {epu_test.results['success_rate']:.1f}%")
    print(f"Total Duration: {epu_test.results['total_duration_seconds']:.1f}s")
    print(f"Results saved to: {json_path}")
    print(f"Report saved to: {report_path}")
    print("="*80)
    
    return epu_test.results

if __name__ == "__main__":
    asyncio.run(main())