"""
WeSign Dashboard Integration Testing Module

This module provides comprehensive testing for WeSign's dashboard integration workflows
using actual discovered selectors from system exploration.

Author: WeSign QA Automation Team
Created: 2025-09-28
Version: 1.0.0

Test Focus:
- Dashboard navigation workflows using real Hebrew interface selectors
- Module integration testing with actual WeSign elements
- Cross-module data flow validation
- Dashboard analytics and reporting features
- Integration between all discovered modules
"""

import pytest
import asyncio
from typing import Dict, List, Any, Optional, Tuple
from playwright.async_api import Page, Browser, BrowserContext, expect
import time
import json
import sys
import os

# Add foundation to path for imports
foundation_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'foundation')
sys.path.append(foundation_path)

from authentication import WeSignTestFoundation
from navigation import WeSignNavigationUtils
from data_management import WeSignTestDataManager
from wesign_selectors import (
    NAVIGATION_SELECTORS, DASHBOARD_SELECTORS, DOCUMENT_SELECTORS,
    TEMPLATE_SELECTORS, CONTACT_SELECTORS, get_selector, get_hebrew_text_selector
)


class TestDashboardIntegration:
    """
    Comprehensive testing for WeSign's dashboard integration system.

    Features Tested:
    - Dashboard navigation workflows with real Hebrew interface
    - Module integration testing (Documents, Templates, Contacts)
    - Cross-module data flow validation
    - Dashboard analytics and central hub functionality
    - Integration workflows using actual discovered selectors

    Discovery Context:
    During comprehensive system exploration, discovered dashboard serves as central
    integration hub with Hebrew RTL interface connecting all WeSign modules.
    """

    def __init__(self):
        """Initialize dashboard integration testing with real WeSign selectors."""
        self.foundation = WeSignTestFoundation()
        self.navigation = WeSignNavigationUtils()
        self.data_manager = WeSignTestDataManager()

        # Real WeSign interface elements discovered during exploration
        self.dashboard_elements = {
            "navigation": {
                "dashboard": NAVIGATION_SELECTORS["dashboard"],  # "ראשי"
                "contacts": NAVIGATION_SELECTORS["contacts"],    # "אנשי קשר"
                "templates": NAVIGATION_SELECTORS["templates"],  # "תבניות"
                "documents": NAVIGATION_SELECTORS["documents"]   # "מסמכים"
            },
            "main_functions": {
                "upload_file": DASHBOARD_SELECTORS["upload_file"],      # "העלאת קובץ"
                "server_signature": DASHBOARD_SELECTORS["server_signature"],  # "חתימת שרת Signer 1"
                "merge_files": DASHBOARD_SELECTORS["merge_files"],      # "איחוד קבצים"
                "assign_send": DASHBOARD_SELECTORS["assign_send"]       # "שיוך ושליחה"
            },
            "footer_links": DASHBOARD_SELECTORS["footer_links"],
            "system_info": DASHBOARD_SELECTORS["version_info"]
        }

        # Module-specific discovered elements
        self.module_elements = {
            "documents": {
                "title": DOCUMENT_SELECTORS["page_title"],           # "המסמכים שלי"
                "search": DOCUMENT_SELECTORS["search_box"],          # חיפוש מסמכים
                "table": DOCUMENT_SELECTORS["document_list"]["table"],
                "count": DOCUMENT_SELECTORS["document_count"]        # "סך המסמכים:"
            },
            "templates": {
                "title": TEMPLATE_SELECTORS["page_title"],           # "תבניות"
                "search": TEMPLATE_SELECTORS["search_box"],          # חיפוש תבניות
                "table": TEMPLATE_SELECTORS["template_list"]["table"],
                "add_new": TEMPLATE_SELECTORS["add_template"]        # "הוסף תבנית חדשה"
            },
            "contacts": {
                "title": CONTACT_SELECTORS["page_title"],            # "אנשי קשר"
                "search": CONTACT_SELECTORS["search_box"],
                "table": CONTACT_SELECTORS["contact_list"]
            }
        }

        # Integration workflow patterns discovered
        self.integration_workflows = {
            "document_to_template": {
                "flow": ["documents", "template_creation", "documents"],
                "expected_elements": ["document_list", "template_editor", "updated_list"]
            },
            "template_to_document": {
                "flow": ["templates", "document_creation", "documents"],
                "expected_elements": ["template_list", "document_editor", "new_document"]
            },
            "contact_integration": {
                "flow": ["contacts", "document_assignment", "documents"],
                "expected_elements": ["contact_list", "assignment_interface", "assigned_documents"]
            },
            "dashboard_overview": {
                "flow": ["dashboard", "all_modules", "dashboard"],
                "expected_elements": ["dashboard_stats", "module_summaries", "activity_feed"]
            }
        }

        # Performance benchmarks for dashboard operations
        self.dashboard_performance = {
            "navigation_speed": {"max_time_seconds": 2, "modules": 4},
            "data_loading": {"max_time_seconds": 3, "elements_count": 10},
            "search_response": {"max_time_seconds": 2, "min_results": 1},
            "integration_flow": {"max_time_seconds": 10, "steps": 3}
        }

    async def test_dashboard_navigation_integration(self, page: Page) -> Dict[str, Any]:
        """
        Test dashboard navigation integration with all modules using real selectors.

        This test validates the complete navigation system discovered during exploration.
        """
        results = {
            "test_name": "Dashboard Navigation Integration",
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "navigation_tested": [],
            "module_access": {},
            "hebrew_interface": False,
            "integration_flows": {},
            "discovered_elements": [],
            "status": "running"
        }

        try:
            # Start from dashboard and verify Hebrew interface
            await self.navigation.navigate_to_module(page, "dashboard")
            await page.wait_for_timeout(2000)

            # Verify Hebrew RTL interface
            hebrew_elements = await page.query_selector_all(get_hebrew_text_selector("עברית"))
            if hebrew_elements:
                results["hebrew_interface"] = True
                results["discovered_elements"].append("Hebrew RTL interface confirmed")

            # Test navigation to each module using real selectors
            for module_name, selector in self.dashboard_elements["navigation"].items():
                navigation_result = await self._test_module_navigation(page, module_name, selector)
                results["navigation_tested"].append(module_name)
                results["module_access"][module_name] = navigation_result

                # Test return to dashboard
                dashboard_return = await self._test_dashboard_return(page)
                results["module_access"][module_name]["dashboard_return"] = dashboard_return

            # Test main dashboard functions using real selectors
            dashboard_functions = await self._test_dashboard_functions(page)
            results["integration_flows"]["dashboard_functions"] = dashboard_functions

            # Test cross-module integration workflows
            integration_flows = await self._test_cross_module_integration(page)
            results["integration_flows"]["cross_module"] = integration_flows

            results["status"] = "completed"
            results["summary"] = f"Tested navigation to {len(results['navigation_tested'])} modules with Hebrew interface"

        except Exception as e:
            results["status"] = "error"
            results["error"] = str(e)
            results["summary"] = f"Dashboard navigation integration failed: {str(e)}"

        return results

    async def _test_module_navigation(self, page: Page, module_name: str, selector: str) -> Dict[str, Any]:
        """Test navigation to specific module using real WeSign selectors."""
        navigation_result = {
            "module": module_name,
            "selector_used": selector,
            "navigation_successful": False,
            "page_loaded": False,
            "expected_elements": [],
            "response_time": 0
        }

        start_time = time.time()

        try:
            # Click module navigation button using real selector
            module_button = await page.query_selector(selector)
            if module_button:
                await module_button.click()
                await page.wait_for_timeout(2000)

                navigation_result["navigation_successful"] = True
                navigation_result["response_time"] = round(time.time() - start_time, 2)

                # Verify module-specific elements loaded
                if module_name in self.module_elements:
                    module_config = self.module_elements[module_name]

                    # Check for page title
                    title_element = await page.query_selector(module_config["title"])
                    if title_element:
                        navigation_result["page_loaded"] = True
                        navigation_result["expected_elements"].append("page_title")

                    # Check for search functionality
                    search_element = await page.query_selector(module_config["search"])
                    if search_element:
                        navigation_result["expected_elements"].append("search_functionality")

                    # Check for data table
                    table_element = await page.query_selector(module_config["table"])
                    if table_element:
                        navigation_result["expected_elements"].append("data_table")

        except Exception as e:
            navigation_result["error"] = str(e)

        return navigation_result

    async def _test_dashboard_return(self, page: Page) -> Dict[str, Any]:
        """Test return to dashboard functionality."""
        return_result = {
            "return_successful": False,
            "dashboard_elements_loaded": [],
            "response_time": 0
        }

        start_time = time.time()

        try:
            # Click dashboard navigation button
            dashboard_button = await page.query_selector(NAVIGATION_SELECTORS["dashboard"])
            if dashboard_button:
                await dashboard_button.click()
                await page.wait_for_timeout(1500)

                return_result["return_successful"] = True
                return_result["response_time"] = round(time.time() - start_time, 2)

                # Verify dashboard elements are present
                for function_name, selector in self.dashboard_elements["main_functions"].items():
                    element = await page.query_selector(selector)
                    if element:
                        return_result["dashboard_elements_loaded"].append(function_name)

        except Exception as e:
            return_result["error"] = str(e)

        return return_result

    async def _test_dashboard_functions(self, page: Page) -> Dict[str, Any]:
        """Test main dashboard functions using real selectors."""
        functions_result = {
            "functions_tested": [],
            "function_accessibility": {},
            "hebrew_labels_verified": False
        }

        try:
            # Test each main dashboard function
            for function_name, selector in self.dashboard_elements["main_functions"].items():
                function_test = await self._test_dashboard_function(page, function_name, selector)
                functions_result["functions_tested"].append(function_name)
                functions_result["function_accessibility"][function_name] = function_test

            # Verify Hebrew labels are present
            hebrew_elements = []
            hebrew_texts = ["העלאת קובץ", "חתימת שרת", "איחוד קבצים", "שיוך ושליחה"]
            for text in hebrew_texts:
                element = await page.query_selector(get_hebrew_text_selector(text))
                if element:
                    hebrew_elements.append(text)

            functions_result["hebrew_labels_verified"] = len(hebrew_elements) > 0
            functions_result["hebrew_elements_found"] = hebrew_elements

        except Exception as e:
            functions_result["error"] = str(e)

        return functions_result

    async def _test_dashboard_function(self, page: Page, function_name: str, selector: str) -> Dict[str, Any]:
        """Test individual dashboard function accessibility."""
        function_result = {
            "function": function_name,
            "accessible": False,
            "clickable": False,
            "response_detected": False
        }

        try:
            function_element = await page.query_selector(selector)
            if function_element:
                function_result["accessible"] = True

                # Check if element is clickable
                is_enabled = await function_element.is_enabled()
                if is_enabled:
                    function_result["clickable"] = True

                    # Test click response (without full execution)
                    await function_element.click()
                    await page.wait_for_timeout(1000)

                    # Look for any response (modal, navigation, etc.)
                    response_indicators = [
                        'dialog',
                        '.modal',
                        '.popup',
                        'input[type="file"]',
                        '.upload-interface'
                    ]

                    for indicator in response_indicators:
                        response_element = await page.query_selector(indicator)
                        if response_element:
                            function_result["response_detected"] = True
                            break

        except Exception as e:
            function_result["error"] = str(e)

        return function_result

    async def _test_cross_module_integration(self, page: Page) -> Dict[str, Any]:
        """Test integration workflows between modules."""
        integration_result = {
            "workflows_tested": [],
            "integration_success": {},
            "data_flow_verified": False,
            "cross_module_features": []
        }

        try:
            # Test document to template workflow
            doc_template_flow = await self._test_document_template_integration(page)
            integration_result["workflows_tested"].append("document_template")
            integration_result["integration_success"]["document_template"] = doc_template_flow

            # Test template to document workflow
            template_doc_flow = await self._test_template_document_integration(page)
            integration_result["workflows_tested"].append("template_document")
            integration_result["integration_success"]["template_document"] = template_doc_flow

            # Test contact integration workflows
            contact_integration = await self._test_contact_integration_workflows(page)
            integration_result["workflows_tested"].append("contact_integration")
            integration_result["integration_success"]["contact_integration"] = contact_integration

            # Verify data flow between modules
            data_flow = await self._verify_cross_module_data_flow(page)
            integration_result["data_flow_verified"] = data_flow["successful"]
            integration_result["cross_module_features"] = data_flow["features_discovered"]

        except Exception as e:
            integration_result["error"] = str(e)

        return integration_result

    async def _test_document_template_integration(self, page: Page) -> Dict[str, Any]:
        """Test integration between documents and templates modules."""
        integration_result = {
            "workflow": "document_to_template",
            "steps_completed": [],
            "integration_successful": False
        }

        try:
            # Navigate to documents
            await page.click(NAVIGATION_SELECTORS["documents"])
            await page.wait_for_timeout(1500)
            integration_result["steps_completed"].append("navigated_to_documents")

            # Look for template creation from document
            template_creation_buttons = [
                'button:has-text("צור תבנית")',
                'button:has-text("שמור כתבנית")',
                '.create-template'
            ]

            for selector in template_creation_buttons:
                element = await page.query_selector(selector)
                if element:
                    integration_result["steps_completed"].append("template_creation_option_found")
                    integration_result["integration_successful"] = True
                    break

            # Navigate to templates to verify integration
            await page.click(NAVIGATION_SELECTORS["templates"])
            await page.wait_for_timeout(1500)
            integration_result["steps_completed"].append("verified_templates_access")

        except Exception as e:
            integration_result["error"] = str(e)

        return integration_result

    async def _test_template_document_integration(self, page: Page) -> Dict[str, Any]:
        """Test integration between templates and documents modules."""
        integration_result = {
            "workflow": "template_to_document",
            "steps_completed": [],
            "integration_successful": False
        }

        try:
            # Navigate to templates
            await page.click(NAVIGATION_SELECTORS["templates"])
            await page.wait_for_timeout(1500)
            integration_result["steps_completed"].append("navigated_to_templates")

            # Look for document creation from template
            document_creation_buttons = [
                'button:has-text("צור מסמך")',
                'button:has-text("השתמש בתבנית")',
                '.use-template'
            ]

            for selector in document_creation_buttons:
                element = await page.query_selector(selector)
                if element:
                    integration_result["steps_completed"].append("document_creation_option_found")
                    integration_result["integration_successful"] = True
                    break

            # Check for template action buttons (actual discovered elements)
            action_buttons = await page.query_selector_all(TEMPLATE_SELECTORS["template_list"]["action_buttons"])
            if action_buttons:
                integration_result["steps_completed"].append("template_actions_available")
                integration_result["integration_successful"] = True

        except Exception as e:
            integration_result["error"] = str(e)

        return integration_result

    async def _test_contact_integration_workflows(self, page: Page) -> Dict[str, Any]:
        """Test contact integration with documents and templates."""
        integration_result = {
            "workflow": "contact_integration",
            "steps_completed": [],
            "integration_features": []
        }

        try:
            # Navigate to contacts (will be implemented when we discover contact selectors)
            await page.click(NAVIGATION_SELECTORS["contacts"])
            await page.wait_for_timeout(1500)
            integration_result["steps_completed"].append("navigated_to_contacts")

            # Look for contact-related integration features
            integration_features = [
                'button:has-text("שלח מסמך")',
                'button:has-text("הקצה חותם")',
                '.assign-signer',
                '.send-document'
            ]

            for selector in integration_features:
                element = await page.query_selector(selector)
                if element:
                    integration_result["integration_features"].append(selector)

            integration_result["steps_completed"].append("contact_integration_features_checked")

        except Exception as e:
            integration_result["error"] = str(e)

        return integration_result

    async def _verify_cross_module_data_flow(self, page: Page) -> Dict[str, Any]:
        """Verify data flow and consistency across modules."""
        data_flow_result = {
            "successful": False,
            "features_discovered": [],
            "consistency_checks": {}
        }

        try:
            # Check for shared data elements across modules
            shared_elements = [
                "Updated User Name",  # Common user name seen in exploration
                "גרסה:",              # Version info
                "ComsignTrust"        # Brand consistency
            ]

            for element_text in shared_elements:
                # Check documents module
                await page.click(NAVIGATION_SELECTORS["documents"])
                await page.wait_for_timeout(1000)
                doc_element = await page.query_selector(f'text:has-text("{element_text}")')

                # Check templates module
                await page.click(NAVIGATION_SELECTORS["templates"])
                await page.wait_for_timeout(1000)
                template_element = await page.query_selector(f'text:has-text("{element_text}")')

                if doc_element and template_element:
                    data_flow_result["features_discovered"].append(f"Consistent data: {element_text}")
                    data_flow_result["consistency_checks"][element_text] = True

            data_flow_result["successful"] = len(data_flow_result["features_discovered"]) > 0

        except Exception as e:
            data_flow_result["error"] = str(e)

        return data_flow_result

    async def test_dashboard_performance_integration(self, page: Page) -> Dict[str, Any]:
        """
        Test dashboard performance and integration response times.
        """
        results = {
            "test_name": "Dashboard Performance Integration",
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "performance_metrics": {},
            "benchmark_compliance": {},
            "integration_timing": {},
            "status": "running"
        }

        try:
            # Test navigation performance across all modules
            navigation_performance = await self._test_navigation_performance(page)
            results["performance_metrics"]["navigation"] = navigation_performance

            # Test data loading performance
            data_loading_performance = await self._test_data_loading_performance(page)
            results["performance_metrics"]["data_loading"] = data_loading_performance

            # Test search response performance
            search_performance = await self._test_search_performance(page)
            results["performance_metrics"]["search"] = search_performance

            # Test integration workflow timing
            integration_timing = await self._test_integration_workflow_timing(page)
            results["integration_timing"] = integration_timing

            # Evaluate benchmark compliance
            for metric_name, metric_data in results["performance_metrics"].items():
                compliance = self._evaluate_performance_compliance(metric_data, metric_name)
                results["benchmark_compliance"][metric_name] = compliance

            results["status"] = "completed"
            results["summary"] = f"Performance tested across {len(results['performance_metrics'])} metrics"

        except Exception as e:
            results["status"] = "error"
            results["error"] = str(e)

        return results

    async def _test_navigation_performance(self, page: Page) -> Dict[str, Any]:
        """Test navigation performance between modules."""
        navigation_performance = {
            "modules_tested": [],
            "average_response_time": 0,
            "fastest_navigation": {"module": "", "time": float('inf')},
            "slowest_navigation": {"module": "", "time": 0},
            "benchmark_met": False
        }

        total_time = 0
        module_count = 0

        try:
            for module_name, selector in self.dashboard_elements["navigation"].items():
                start_time = time.time()

                # Navigate to module
                module_button = await page.query_selector(selector)
                if module_button:
                    await module_button.click()
                    await page.wait_for_timeout(1000)

                    response_time = round(time.time() - start_time, 2)
                    total_time += response_time
                    module_count += 1

                    navigation_performance["modules_tested"].append({
                        "module": module_name,
                        "response_time": response_time
                    })

                    # Track fastest and slowest
                    if response_time < navigation_performance["fastest_navigation"]["time"]:
                        navigation_performance["fastest_navigation"] = {"module": module_name, "time": response_time}

                    if response_time > navigation_performance["slowest_navigation"]["time"]:
                        navigation_performance["slowest_navigation"] = {"module": module_name, "time": response_time}

            # Calculate average
            if module_count > 0:
                navigation_performance["average_response_time"] = round(total_time / module_count, 2)
                benchmark_time = self.dashboard_performance["navigation_speed"]["max_time_seconds"]
                navigation_performance["benchmark_met"] = navigation_performance["average_response_time"] <= benchmark_time

        except Exception as e:
            navigation_performance["error"] = str(e)

        return navigation_performance

    async def _test_data_loading_performance(self, page: Page) -> Dict[str, Any]:
        """Test data loading performance in each module."""
        loading_performance = {
            "modules_tested": [],
            "loading_times": {},
            "data_elements_loaded": {},
            "benchmark_met": False
        }

        try:
            for module_name in ["documents", "templates"]:
                start_time = time.time()

                # Navigate to module
                if module_name == "documents":
                    await page.click(NAVIGATION_SELECTORS["documents"])
                    data_selector = DOCUMENT_SELECTORS["document_list"]["table"]
                else:
                    await page.click(NAVIGATION_SELECTORS["templates"])
                    data_selector = TEMPLATE_SELECTORS["template_list"]["table"]

                await page.wait_for_timeout(1500)

                # Wait for data table to load
                data_table = await page.wait_for_selector(data_selector, timeout=5000)
                loading_time = round(time.time() - start_time, 2)

                if data_table:
                    # Count loaded elements
                    rows = await page.query_selector_all(f'{data_selector} tr')
                    element_count = len(rows) if rows else 0

                    loading_performance["modules_tested"].append(module_name)
                    loading_performance["loading_times"][module_name] = loading_time
                    loading_performance["data_elements_loaded"][module_name] = element_count

            # Check benchmark compliance
            benchmark_time = self.dashboard_performance["data_loading"]["max_time_seconds"]
            all_times = list(loading_performance["loading_times"].values())
            loading_performance["benchmark_met"] = all(time <= benchmark_time for time in all_times)

        except Exception as e:
            loading_performance["error"] = str(e)

        return loading_performance

    async def _test_search_performance(self, page: Page) -> Dict[str, Any]:
        """Test search performance across modules."""
        search_performance = {
            "modules_tested": [],
            "search_times": {},
            "results_found": {},
            "benchmark_met": False
        }

        try:
            # Test search in documents module
            await page.click(NAVIGATION_SELECTORS["documents"])
            await page.wait_for_timeout(1000)

            search_start = time.time()
            search_box = await page.query_selector(DOCUMENT_SELECTORS["search_box"])
            if search_box:
                await search_box.fill("test")
                await page.wait_for_timeout(1000)
                doc_search_time = round(time.time() - search_start, 2)

                search_performance["modules_tested"].append("documents")
                search_performance["search_times"]["documents"] = doc_search_time

            # Test search in templates module
            await page.click(NAVIGATION_SELECTORS["templates"])
            await page.wait_for_timeout(1000)

            search_start = time.time()
            template_search_box = await page.query_selector(TEMPLATE_SELECTORS["search_box"])
            if template_search_box:
                await template_search_box.fill("template")
                await page.wait_for_timeout(1000)
                template_search_time = round(time.time() - search_start, 2)

                search_performance["modules_tested"].append("templates")
                search_performance["search_times"]["templates"] = template_search_time

            # Check benchmark compliance
            benchmark_time = self.dashboard_performance["search_response"]["max_time_seconds"]
            all_times = list(search_performance["search_times"].values())
            search_performance["benchmark_met"] = all(time <= benchmark_time for time in all_times)

        except Exception as e:
            search_performance["error"] = str(e)

        return search_performance

    async def _test_integration_workflow_timing(self, page: Page) -> Dict[str, Any]:
        """Test timing of integration workflows between modules."""
        workflow_timing = {
            "workflows_tested": [],
            "workflow_times": {},
            "successful_integrations": 0
        }

        try:
            # Test dashboard to documents to templates workflow
            workflow_start = time.time()

            # Dashboard → Documents
            await page.click(NAVIGATION_SELECTORS["dashboard"])
            await page.wait_for_timeout(1000)
            await page.click(NAVIGATION_SELECTORS["documents"])
            await page.wait_for_timeout(1500)

            # Documents → Templates
            await page.click(NAVIGATION_SELECTORS["templates"])
            await page.wait_for_timeout(1500)

            # Templates → Dashboard
            await page.click(NAVIGATION_SELECTORS["dashboard"])
            await page.wait_for_timeout(1000)

            workflow_time = round(time.time() - workflow_start, 2)

            workflow_timing["workflows_tested"].append("full_navigation_cycle")
            workflow_timing["workflow_times"]["full_navigation_cycle"] = workflow_time
            workflow_timing["successful_integrations"] = 1

        except Exception as e:
            workflow_timing["error"] = str(e)

        return workflow_timing

    def _evaluate_performance_compliance(self, metric_data: Dict[str, Any], metric_name: str) -> Dict[str, Any]:
        """Evaluate performance metric against benchmarks."""
        compliance = {
            "compliant": False,
            "performance_score": 0,
            "recommendations": []
        }

        try:
            benchmark = self.dashboard_performance.get(metric_name, {})

            if metric_name == "navigation":
                avg_time = metric_data.get("average_response_time", float('inf'))
                max_time = benchmark.get("max_time_seconds", 2)
                compliance["compliant"] = avg_time <= max_time

                if not compliance["compliant"]:
                    compliance["recommendations"].append(f"Navigation averaging {avg_time}s exceeds {max_time}s benchmark")

            elif metric_name == "data_loading":
                loading_times = metric_data.get("loading_times", {})
                max_time = benchmark.get("max_time_seconds", 3)
                all_compliant = all(time <= max_time for time in loading_times.values())
                compliance["compliant"] = all_compliant

                if not compliance["compliant"]:
                    slow_modules = [module for module, time in loading_times.items() if time > max_time]
                    compliance["recommendations"].append(f"Slow loading in modules: {slow_modules}")

            # Calculate performance score
            compliance["performance_score"] = 100 if compliance["compliant"] else 50

        except Exception as e:
            compliance["error"] = str(e)

        return compliance


# Test execution function for direct testing
async def run_dashboard_integration_tests():
    """
    Execute dashboard integration tests independently for validation.
    """
    from playwright.async_api import async_playwright

    test_instance = TestDashboardIntegration()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        try:
            # Authenticate first
            login_result = await test_instance.foundation.secure_login(page)
            if login_result["authenticated"]:
                print("Authentication successful, running dashboard integration tests...")

                # Run navigation integration test
                navigation_result = await test_instance.test_dashboard_navigation_integration(page)
                print(f"Navigation Integration Test: {navigation_result['status']}")
                print(f"Summary: {navigation_result.get('summary', 'No summary available')}")
                print(f"Hebrew Interface: {navigation_result.get('hebrew_interface', False)}")

                # Run performance integration test
                performance_result = await test_instance.test_dashboard_performance_integration(page)
                print(f"Performance Integration Test: {performance_result['status']}")

            else:
                print(f"Authentication failed: {login_result.get('error', 'Unknown error')}")

        except Exception as e:
            print(f"Test execution failed: {str(e)}")

        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(run_dashboard_integration_tests())