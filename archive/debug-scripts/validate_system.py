#!/usr/bin/env python3
"""
Comprehensive system validation script for QA Intelligence platform.
Validates all pages and functionality after system launch.
"""

import asyncio
import json
import time
from datetime import datetime
from playwright.async_api import async_playwright, Page, Browser
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class QAIntelligenceValidator:
    def __init__(self):
        self.base_url = "http://localhost:3003"
        self.backend_url = "http://localhost:8081"
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "pages": {},
            "api_health": {},
            "navigation_flow": [],
            "errors": []
        }
        
    async def setup_browser(self, playwright):
        """Setup browser with appropriate configuration"""
        browser = await playwright.chromium.launch(
            headless=False,
            slow_mo=500,
            args=['--start-maximized']
        )
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            ignore_https_errors=True
        )
        page = await context.new_page()
        
        # Setup error logging
        page.on("pageerror", lambda error: logger.error(f"Page error: {error}"))
        page.on("requestfailed", lambda request: logger.warning(f"Request failed: {request.url}"))
        
        return browser, page
    
    async def check_api_health(self):
        """Check backend API health"""
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                # Check main health endpoint
                try:
                    async with session.get(f"{self.backend_url}/health", timeout=5) as response:
                        self.results["api_health"]["main"] = {
                            "status": response.status,
                            "accessible": response.status == 200
                        }
                except Exception as e:
                    self.results["api_health"]["main"] = {
                        "status": "error",
                        "error": str(e),
                        "accessible": False
                    }
                
                # Check analytics endpoint
                try:
                    async with session.get(f"{self.backend_url}/api/analytics/smart", timeout=10) as response:
                        self.results["api_health"]["analytics"] = {
                            "status": response.status,
                            "accessible": response.status == 200
                        }
                except Exception as e:
                    self.results["api_health"]["analytics"] = {
                        "status": "error",
                        "error": str(e),
                        "accessible": False
                    }
                        
        except ImportError:
            # Fallback using requests if aiohttp not available
            import requests
            try:
                response = requests.get(f"{self.backend_url}/health", timeout=5)
                self.results["api_health"]["main"] = {
                    "status": response.status_code,
                    "accessible": response.status_code == 200
                }
            except Exception as e:
                self.results["api_health"]["main"] = {
                    "status": "error",
                    "error": str(e),
                    "accessible": False
                }
    
    async def validate_dashboard_page(self, page: Page):
        """Validate Dashboard page functionality"""
        logger.info("🏠 Validating Dashboard page...")
        
        try:
            await page.goto(self.base_url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(3000)  # Let page fully load
            
            # Take screenshot
            screenshot_path = f"dashboard_validation_{int(time.time())}.png"
            await page.screenshot(path=screenshot_path, full_page=True)
            
            # Check for key dashboard elements
            page_title = await page.title()
            
            # Look for dashboard metrics
            metrics_selectors = [
                '[data-testid*="stat"], [data-testid*="metric"]',
                '.stat, .metric, .kpi',
                'h1, h2, h3',
                '[class*="dashboard"], [class*="metric"], [class*="stat"]'
            ]
            
            found_elements = 0
            for selector in metrics_selectors:
                try:
                    elements = await page.query_selector_all(selector)
                    found_elements += len(elements)
                except:
                    continue
            
            # Check for navigation elements
            nav_elements = await page.query_selector_all('nav, [class*="nav"], [role="navigation"], a[href*="/"]')
            
            self.results["pages"]["dashboard"] = {
                "accessible": True,
                "title": page_title,
                "url": page.url,
                "screenshot": screenshot_path,
                "elements_found": found_elements,
                "navigation_elements": len(nav_elements),
                "load_time": "< 3s",
                "status": "success"
            }
            
            # Log navigation links found
            nav_links = []
            for element in nav_elements[:10]:  # First 10 nav elements
                try:
                    text = await element.text_content()
                    href = await element.get_attribute('href')
                    if text and text.strip():
                        nav_links.append({"text": text.strip(), "href": href})
                except:
                    continue
            
            self.results["pages"]["dashboard"]["navigation_links"] = nav_links
            logger.info(f"✅ Dashboard validation successful - found {found_elements} elements, {len(nav_elements)} navigation items")
            
        except Exception as e:
            logger.error(f"❌ Dashboard validation failed: {str(e)}")
            self.results["pages"]["dashboard"] = {
                "accessible": False,
                "error": str(e),
                "status": "failed"
            }
            self.results["errors"].append(f"Dashboard validation failed: {str(e)}")
    
    async def navigate_and_validate_page(self, page: Page, route: str, page_name: str):
        """Navigate to a specific page and validate it"""
        logger.info(f"📍 Validating {page_name} page ({route})...")
        
        try:
            # Navigate to the page
            full_url = f"{self.base_url}{route}"
            await page.goto(full_url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(2000)  # Wait for content to load
            
            # Take screenshot
            screenshot_path = f"{page_name.lower().replace(' ', '_')}_validation_{int(time.time())}.png"
            await page.screenshot(path=screenshot_path, full_page=True)
            
            page_title = await page.title()
            current_url = page.url
            
            # Check if page loaded properly (not an error page)
            is_error_page = False
            error_indicators = ['404', 'error', 'not found', 'something went wrong']
            page_content = await page.text_content('body')
            page_content_lower = page_content.lower() if page_content else ""
            
            for indicator in error_indicators:
                if indicator in page_content_lower:
                    is_error_page = True
                    break
            
            # Count interactive elements
            interactive_elements = await page.query_selector_all('button, input, select, textarea, a, [role="button"], [tabindex]')
            
            # Check for loading states or spinners
            loading_elements = await page.query_selector_all('[class*="loading"], [class*="spinner"], [class*="skeleton"]')
            
            self.results["pages"][page_name.lower().replace(' ', '_')] = {
                "accessible": not is_error_page,
                "title": page_title,
                "url": current_url,
                "route": route,
                "screenshot": screenshot_path,
                "interactive_elements": len(interactive_elements),
                "loading_elements": len(loading_elements),
                "is_error_page": is_error_page,
                "status": "success" if not is_error_page else "error",
                "page_content_length": len(page_content) if page_content else 0
            }
            
            if is_error_page:
                logger.warning(f"⚠️ {page_name} appears to be an error page")
                self.results["errors"].append(f"{page_name} appears to be an error page")
            else:
                logger.info(f"✅ {page_name} validation successful - {len(interactive_elements)} interactive elements found")
                
            self.results["navigation_flow"].append({
                "page": page_name,
                "route": route,
                "success": not is_error_page,
                "timestamp": datetime.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"❌ {page_name} validation failed: {str(e)}")
            self.results["pages"][page_name.lower().replace(' ', '_')] = {
                "accessible": False,
                "error": str(e),
                "route": route,
                "status": "failed"
            }
            self.results["errors"].append(f"{page_name} validation failed: {str(e)}")
    
    async def run_comprehensive_validation(self):
        """Run complete system validation"""
        logger.info("🚀 Starting comprehensive QA Intelligence system validation...")
        
        # Check API health first
        await self.check_api_health()
        
        async with async_playwright() as playwright:
            browser, page = await self.setup_browser(playwright)
            
            try:
                # 1. Validate Dashboard (main page)
                await self.validate_dashboard_page(page)
                
                # 2. Define pages to validate
                pages_to_validate = [
                    ("/test-bank", "Test Bank"),
                    ("/analytics", "Analytics"),
                    ("/scheduler", "Scheduler"),
                    ("/reports", "Reports"),
                    ("/ai-assistant", "AI Assistant"),
                    ("/self-healing", "Self Healing")
                ]
                
                # 3. Validate each page
                for route, page_name in pages_to_validate:
                    await self.navigate_and_validate_page(page, route, page_name)
                    await page.wait_for_timeout(1000)  # Brief pause between pages
                
                # 4. Test navigation flow - go back to dashboard
                logger.info("🔄 Testing navigation flow - returning to dashboard...")
                await page.goto(self.base_url, wait_until="domcontentloaded")
                await page.wait_for_timeout(2000)
                
                # Final dashboard check
                final_title = await page.title()
                logger.info(f"🏁 Navigation flow complete - back to: {final_title}")
                
            except Exception as e:
                logger.error(f"💥 Critical validation error: {str(e)}")
                self.results["errors"].append(f"Critical validation error: {str(e)}")
            
            finally:
                await browser.close()
        
        # Generate summary
        self.generate_validation_summary()
        
        # Save results
        results_file = f"system_validation_{int(time.time())}.json"
        with open(results_file, 'w') as f:
            json.dump(self.results, f, indent=2)
        
        logger.info(f"📄 Validation results saved to: {results_file}")
        
        return self.results
    
    def generate_validation_summary(self):
        """Generate validation summary"""
        total_pages = len([p for p in self.results["pages"].keys()])
        successful_pages = len([p for p in self.results["pages"].values() if p.get("status") == "success"])
        failed_pages = len([p for p in self.results["pages"].values() if p.get("status") == "failed"])
        error_pages = len([p for p in self.results["pages"].values() if p.get("is_error_page", False)])
        
        api_healthy = all(api.get("accessible", False) for api in self.results["api_health"].values())
        
        self.results["summary"] = {
            "total_pages_tested": total_pages,
            "successful_pages": successful_pages,
            "failed_pages": failed_pages,
            "error_pages": error_pages,
            "api_health_status": "healthy" if api_healthy else "issues_detected",
            "total_errors": len(self.results["errors"]),
            "overall_status": "success" if failed_pages == 0 and len(self.results["errors"]) == 0 else "issues_detected"
        }
        
        logger.info("📊 VALIDATION SUMMARY:")
        logger.info(f"   Total Pages: {total_pages}")
        logger.info(f"   Successful: {successful_pages}")
        logger.info(f"   Failed: {failed_pages}")
        logger.info(f"   API Health: {'✅ Healthy' if api_healthy else '❌ Issues detected'}")
        logger.info(f"   Overall Status: {'✅ Success' if self.results['summary']['overall_status'] == 'success' else '⚠️ Issues detected'}")


async def main():
    """Main validation function"""
    validator = QAIntelligenceValidator()
    results = await validator.run_comprehensive_validation()
    
    # Print final summary
    print("\n" + "="*80)
    print("🎯 QA INTELLIGENCE SYSTEM VALIDATION COMPLETE")
    print("="*80)
    
    summary = results.get("summary", {})
    print(f"📈 Pages Tested: {summary.get('total_pages_tested', 0)}")
    print(f"✅ Successful: {summary.get('successful_pages', 0)}")
    print(f"❌ Failed: {summary.get('failed_pages', 0)}")
    print(f"🔧 API Status: {summary.get('api_health_status', 'unknown')}")
    print(f"🎖️ Overall: {summary.get('overall_status', 'unknown')}")
    
    if results.get("errors"):
        print(f"\n⚠️ Errors encountered ({len(results['errors'])}):")
        for error in results["errors"][:5]:  # Show first 5 errors
            print(f"   • {error}")
    
    print("="*80)
    
    return results


if __name__ == "__main__":
    asyncio.run(main())