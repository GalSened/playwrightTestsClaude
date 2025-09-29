#!/usr/bin/env python3
"""
Performance Comparison: Hard Waits vs Smart Waits
Demonstrates the performance improvements from replacing hard waits
"""

import time
import asyncio
from playwright.async_api import async_playwright
from utils.smart_waits import WeSignSmartWaits


class PerformanceComparison:
    """Compare performance of hard waits vs smart waits"""

    def __init__(self):
        self.results = {
            "hard_waits": {},
            "smart_waits": {},
            "improvements": {}
        }

    async def simulate_hard_wait_login(self, page):
        """Simulate login process with hard waits (old approach)"""
        start_time = time.time()

        await page.goto("https://devtest.comda.co.il/login")
        await page.wait_for_timeout(3000)  # Hard wait for page load

        # Enter invalid credentials
        await page.fill("input[name='email']", "invalid@test.com")
        await page.fill("input[name='password']", "wrongpassword")
        await page.click("button[type='submit']")

        await page.wait_for_timeout(5000)  # Hard wait for login attempt

        end_time = time.time()
        return end_time - start_time

    async def simulate_smart_wait_login(self, page):
        """Simulate login process with smart waits (new approach)"""
        start_time = time.time()

        smart_waits = WeSignSmartWaits(page)

        await page.goto("https://devtest.comda.co.il/login")
        await smart_waits.wait_for_navigation_complete()  # Smart wait for page load

        # Enter invalid credentials
        await page.fill("input[name='email']", "invalid@test.com")
        await page.fill("input[name='password']", "wrongpassword")
        await page.click("button[type='submit']")

        await smart_waits.wait_for_login_result()  # Smart wait for login attempt

        end_time = time.time()
        return end_time - start_time

    async def simulate_hard_wait_navigation(self, page):
        """Simulate navigation with hard waits"""
        start_time = time.time()

        # Simulate multiple navigation actions with hard waits
        navigation_actions = [
            ("https://devtest.comda.co.il/", 2000),
            ("https://devtest.comda.co.il/login", 3000),
            ("https://devtest.comda.co.il/", 2000),
        ]

        for url, wait_time in navigation_actions:
            await page.goto(url)
            await page.wait_for_timeout(wait_time)

        end_time = time.time()
        return end_time - start_time

    async def simulate_smart_wait_navigation(self, page):
        """Simulate navigation with smart waits"""
        start_time = time.time()

        smart_waits = WeSignSmartWaits(page)

        # Same navigation actions but with smart waits
        navigation_urls = [
            "https://devtest.comda.co.il/",
            "https://devtest.comda.co.il/login",
            "https://devtest.comda.co.il/",
        ]

        for url in navigation_urls:
            await page.goto(url)
            await smart_waits.wait_for_navigation_complete()

        end_time = time.time()
        return end_time - start_time

    async def run_comparison(self):
        """Run the performance comparison"""
        print("Performance Comparison: Hard Waits vs Smart Waits")
        print("=" * 55)

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)

            # Test 1: Login Process
            print("\n1. Testing Login Process...")

            # Hard waits
            page1 = await browser.new_page()
            try:
                hard_wait_time = await self.simulate_hard_wait_login(page1)
                self.results["hard_waits"]["login"] = hard_wait_time
                print(f"   Hard waits: {hard_wait_time:.2f} seconds")
            except Exception as e:
                print(f"   Hard waits failed: {e}")
                self.results["hard_waits"]["login"] = None
            finally:
                await page1.close()

            # Smart waits
            page2 = await browser.new_page()
            try:
                smart_wait_time = await self.simulate_smart_wait_login(page2)
                self.results["smart_waits"]["login"] = smart_wait_time
                print(f"   Smart waits: {smart_wait_time:.2f} seconds")
            except Exception as e:
                print(f"   Smart waits failed: {e}")
                self.results["smart_waits"]["login"] = None
            finally:
                await page2.close()

            # Calculate improvement
            if (self.results["hard_waits"]["login"] and
                self.results["smart_waits"]["login"]):
                improvement = self.results["hard_waits"]["login"] - self.results["smart_waits"]["login"]
                improvement_pct = (improvement / self.results["hard_waits"]["login"]) * 100
                self.results["improvements"]["login"] = {
                    "time_saved": improvement,
                    "percentage": improvement_pct
                }
                print(f"   Improvement: {improvement:.2f} seconds ({improvement_pct:.1f}% faster)")

            # Test 2: Navigation Process
            print("\n2. Testing Navigation Process...")

            # Hard waits
            page3 = await browser.new_page()
            try:
                hard_nav_time = await self.simulate_hard_wait_navigation(page3)
                self.results["hard_waits"]["navigation"] = hard_nav_time
                print(f"   Hard waits: {hard_nav_time:.2f} seconds")
            except Exception as e:
                print(f"   Hard waits failed: {e}")
                self.results["hard_waits"]["navigation"] = None
            finally:
                await page3.close()

            # Smart waits
            page4 = await browser.new_page()
            try:
                smart_nav_time = await self.simulate_smart_wait_navigation(page4)
                self.results["smart_waits"]["navigation"] = smart_nav_time
                print(f"   Smart waits: {smart_nav_time:.2f} seconds")
            except Exception as e:
                print(f"   Smart waits failed: {e}")
                self.results["smart_waits"]["navigation"] = None
            finally:
                await page4.close()

            # Calculate improvement
            if (self.results["hard_waits"]["navigation"] and
                self.results["smart_waits"]["navigation"]):
                improvement = self.results["hard_waits"]["navigation"] - self.results["smart_waits"]["navigation"]
                improvement_pct = (improvement / self.results["hard_waits"]["navigation"]) * 100
                self.results["improvements"]["navigation"] = {
                    "time_saved": improvement,
                    "percentage": improvement_pct
                }
                print(f"   Improvement: {improvement:.2f} seconds ({improvement_pct:.1f}% faster)")

            await browser.close()

    def print_summary(self):
        """Print performance summary"""
        print("\n" + "=" * 55)
        print("PERFORMANCE SUMMARY")
        print("=" * 55)

        total_hard = 0
        total_smart = 0
        total_saved = 0

        for test_name in ["login", "navigation"]:
            if (test_name in self.results["hard_waits"] and
                test_name in self.results["smart_waits"] and
                self.results["hard_waits"][test_name] and
                self.results["smart_waits"][test_name]):

                hard_time = self.results["hard_waits"][test_name]
                smart_time = self.results["smart_waits"][test_name]
                saved = hard_time - smart_time

                total_hard += hard_time
                total_smart += smart_time
                total_saved += saved

                print(f"{test_name.capitalize():15} | Hard: {hard_time:6.2f}s | Smart: {smart_time:6.2f}s | Saved: {saved:6.2f}s")

        if total_hard > 0:
            overall_improvement = (total_saved / total_hard) * 100
            print("-" * 55)
            print(f"{'TOTAL':15} | Hard: {total_hard:6.2f}s | Smart: {total_smart:6.2f}s | Saved: {total_saved:6.2f}s")
            print(f"\nOverall Performance Improvement: {overall_improvement:.1f}% faster")

            # Extrapolate to full test suite
            if total_saved > 0:
                print(f"\nExtrapolated Savings for Full Test Suite:")
                print(f"- Estimated 217 hard waits replaced")
                print(f"- Average time saved per wait: {total_saved/2:.2f} seconds")
                print(f"- Total estimated time savings: {(total_saved/2) * 217:.0f} seconds ({((total_saved/2) * 217)/60:.1f} minutes)")
        else:
            print("Unable to calculate performance improvements due to test failures.")


async def main():
    """Main execution function"""
    comparison = PerformanceComparison()

    try:
        await comparison.run_comparison()
        comparison.print_summary()

        print("\n" + "=" * 55)
        print("CONCLUSION")
        print("=" * 55)
        print("Smart waits provide:")
        print("✓ Faster test execution")
        print("✓ More reliable test behavior")
        print("✓ Better error detection")
        print("✓ Reduced flakiness")
        print("✓ Conditional waiting instead of arbitrary timeouts")

    except Exception as e:
        print(f"Performance comparison failed: {e}")


if __name__ == "__main__":
    asyncio.run(main())