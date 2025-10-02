#!/usr/bin/env python3
"""
Quick validation script to test the fixes for Analytics and Self-Healing pages.
"""

import asyncio
import json
import time
from datetime import datetime
from playwright.async_api import async_playwright
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class FixesValidator:
    def __init__(self):
        self.base_url = "http://localhost:3000"
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "fixes": {},
            "success": True
        }
        
    async def validate_analytics_fix(self, page):
        """Test Analytics page after routing fix"""
        logger.info("🔧 Testing Analytics page fix...")
        
        try:
            # Navigate directly to analytics
            await page.goto(f"{self.base_url}/analytics", wait_until="domcontentloaded", timeout=15000)
            await page.wait_for_timeout(3000)  # Wait for data loading
            
            current_url = page.url
            page_title = await page.title()
            
            # Take screenshot for verification
            screenshot_path = f"analytics_fixed_{int(time.time())}.png"
            await page.screenshot(path=screenshot_path, full_page=True)
            
            # Check if we're actually on analytics (not redirected to dashboard)
            is_analytics_page = "/analytics" in current_url
            
            # Look for analytics-specific content
            analytics_content = await page.query_selector_all('[class*="analytics"], [class*="chart"], [class*="metric"]')
            
            # Check for any error content
            page_content = await page.text_content('body')
            has_error_content = any(error in page_content.lower() if page_content else "" 
                                  for error in ['404', 'not found', 'error'])
            
            self.results["fixes"]["analytics"] = {
                "success": is_analytics_page and not has_error_content,
                "url": current_url,
                "title": page_title,
                "screenshot": screenshot_path,
                "redirected": not is_analytics_page,
                "analytics_elements_found": len(analytics_content),
                "has_error_content": has_error_content,
                "status": "FIXED" if is_analytics_page and not has_error_content else "STILL_BROKEN"
            }
            
            if is_analytics_page and not has_error_content:
                logger.info("✅ Analytics page fix SUCCESSFUL - page loads correctly")
            else:
                logger.warning(f"❌ Analytics page fix FAILED - redirected: {not is_analytics_page}, error: {has_error_content}")
                
        except Exception as e:
            logger.error(f"❌ Analytics validation failed: {str(e)}")
            self.results["fixes"]["analytics"] = {
                "success": False,
                "error": str(e),
                "status": "ERROR"
            }
            
    async def validate_self_healing_fix(self, page):
        """Test Self-Healing page"""
        logger.info("🔧 Testing Self-Healing page...")
        
        try:
            # Navigate to self-healing page
            await page.goto(f"{self.base_url}/self-healing", wait_until="domcontentloaded", timeout=15000)
            await page.wait_for_timeout(4000)  # Wait for API calls to complete
            
            current_url = page.url
            page_title = await page.title()
            
            # Take screenshot
            screenshot_path = f"self_healing_fixed_{int(time.time())}.png"
            await page.screenshot(path=screenshot_path, full_page=True)
            
            # Check if we're on self-healing page
            is_self_healing_page = "/self-healing" in current_url
            
            # Look for healing-specific content
            healing_content = await page.query_selector_all('[class*="healing"], [class*="queue"], [class*="stats"]')
            
            # Check for healing queue data
            queue_elements = await page.query_selector_all('tbody tr, [class*="queue-item"], [class*="healing-item"]')
            
            # Check for error content
            page_content = await page.text_content('body')
            has_error_content = any(error in page_content.lower() if page_content else "" 
                                  for error in ['404', 'not found', 'error', 'something went wrong'])
            
            # Look for loading indicators (should be gone by now)
            loading_elements = await page.query_selector_all('[class*="loading"], [class*="spinner"]')
            
            self.results["fixes"]["self_healing"] = {
                "success": is_self_healing_page and not has_error_content,
                "url": current_url,
                "title": page_title,
                "screenshot": screenshot_path,
                "redirected": not is_self_healing_page,
                "healing_elements_found": len(healing_content),
                "queue_items_found": len(queue_elements),
                "has_error_content": has_error_content,
                "still_loading": len(loading_elements) > 0,
                "status": "WORKING" if is_self_healing_page and not has_error_content else "STILL_BROKEN"
            }
            
            if is_self_healing_page and not has_error_content:
                logger.info(f"✅ Self-Healing page WORKING - found {len(queue_elements)} queue items, {len(healing_content)} healing elements")
            else:
                logger.warning(f"❌ Self-Healing page still broken - redirected: {not is_self_healing_page}, error: {has_error_content}")
                
        except Exception as e:
            logger.error(f"❌ Self-Healing validation failed: {str(e)}")
            self.results["fixes"]["self_healing"] = {
                "success": False,
                "error": str(e),
                "status": "ERROR"
            }
    
    async def run_validation(self):
        """Run validation for both fixes"""
        logger.info("🚀 Starting fixes validation...")
        
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=False, slow_mo=300)
            context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
            page = await context.new_page()
            
            try:
                # Test both fixes
                await self.validate_analytics_fix(page)
                await self.validate_self_healing_fix(page)
                
                # Generate summary
                analytics_success = self.results["fixes"].get("analytics", {}).get("success", False)
                self_healing_success = self.results["fixes"].get("self_healing", {}).get("success", False)
                
                self.results["summary"] = {
                    "total_fixes_tested": 2,
                    "successful_fixes": sum([analytics_success, self_healing_success]),
                    "analytics_fixed": analytics_success,
                    "self_healing_fixed": self_healing_success,
                    "all_issues_resolved": analytics_success and self_healing_success
                }
                
                self.results["success"] = analytics_success and self_healing_success
                
            except Exception as e:
                logger.error(f"💥 Critical validation error: {str(e)}")
                self.results["success"] = False
                self.results["error"] = str(e)
                
            finally:
                await browser.close()
        
        # Save results
        results_file = f"fixes_validation_{int(time.time())}.json"
        with open(results_file, 'w') as f:
            json.dump(self.results, f, indent=2)
        
        logger.info(f"📄 Validation results saved to: {results_file}")
        return self.results

async def main():
    """Main validation function"""
    validator = FixesValidator()
    results = await validator.run_validation()
    
    # Print results
    print("\n" + "="*80)
    print("🔧 FIXES VALIDATION RESULTS")
    print("="*80)
    
    summary = results.get("summary", {})
    print(f"📊 Fixes Tested: {summary.get('total_fixes_tested', 0)}")
    print(f"✅ Successful: {summary.get('successful_fixes', 0)}")
    
    analytics_status = "✅ FIXED" if summary.get('analytics_fixed', False) else "❌ STILL BROKEN"
    self_healing_status = "✅ WORKING" if summary.get('self_healing_fixed', False) else "❌ STILL BROKEN"
    
    print(f"📈 Analytics Page: {analytics_status}")
    print(f"🔧 Self-Healing Page: {self_healing_status}")
    
    overall_status = "🎉 ALL ISSUES RESOLVED" if summary.get('all_issues_resolved', False) else "⚠️ SOME ISSUES REMAIN"
    print(f"🎖️ Overall Status: {overall_status}")
    
    print("="*80)
    
    return results

if __name__ == "__main__":
    asyncio.run(main())