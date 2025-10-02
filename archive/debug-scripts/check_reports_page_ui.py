import asyncio
from playwright.async_api import async_playwright

async def check_reports_page():
    """Check the reports page for overlapping UI components"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=1000)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            print("=== CHECKING REPORTS PAGE UI ===")
            
            # Navigate to reports page
            await page.goto("http://localhost:3004/reports")
            await page.wait_for_timeout(3000)
            
            print("SUCCESS: Reports page loaded")
            
            # Take full page screenshot
            await page.screenshot(path="reports_page_full.png", full_page=True)
            print("Full page screenshot saved as reports_page_full.png")
            
            # Check for overlapping elements
            await page.evaluate("""
                () => {
                    function findOverlappingElements() {
                        const allElements = Array.from(document.querySelectorAll('*'));
                        const overlapping = [];
                        
                        for (let i = 0; i < allElements.length; i++) {
                            const elem1 = allElements[i];
                            if (!elem1.offsetParent) continue; // Skip invisible elements
                            
                            const rect1 = elem1.getBoundingClientRect();
                            if (rect1.width === 0 || rect1.height === 0) continue;
                            
                            for (let j = i + 1; j < allElements.length; j++) {
                                const elem2 = allElements[j];
                                if (!elem2.offsetParent) continue;
                                if (elem1.contains(elem2) || elem2.contains(elem1)) continue;
                                
                                const rect2 = elem2.getBoundingClientRect();
                                if (rect2.width === 0 || rect2.height === 0) continue;
                                
                                // Check for overlap
                                const overlap = !(rect1.right <= rect2.left || 
                                               rect2.right <= rect1.left || 
                                               rect1.bottom <= rect2.top || 
                                               rect2.bottom <= rect1.top);
                                
                                if (overlap) {
                                    // Calculate overlap area
                                    const overlapArea = Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left)) *
                                                      Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
                                    
                                    if (overlapArea > 100) { // Only report significant overlaps
                                        overlapping.push({
                                            elem1: elem1.tagName + (elem1.className ? '.' + elem1.className.split(' ')[0] : ''),
                                            elem2: elem2.tagName + (elem2.className ? '.' + elem2.className.split(' ')[0] : ''),
                                            overlapArea: overlapArea,
                                            rect1: rect1,
                                            rect2: rect2
                                        });
                                    }
                                }
                            }
                        }
                        return overlapping;
                    }
                    
                    window.overlappingElements = findOverlappingElements();
                    console.log('Found overlapping elements:', window.overlappingElements);
                }
            """)
            
            # Get overlapping elements from browser
            overlapping = await page.evaluate("window.overlappingElements || []")
            
            if overlapping:
                print(f"FOUND {len(overlapping)} overlapping elements:")
                for i, overlap in enumerate(overlapping[:5]):  # Show first 5
                    print(f"  {i+1}. {overlap['elem1']} overlaps {overlap['elem2']} (area: {overlap['overlapArea']}px)")
            else:
                print("SUCCESS: No significant overlapping elements found")
            
            # Check specific layout issues in reports page
            await page.evaluate("""
                () => {
                    // Check for specific layout issues
                    const issues = [];
                    
                    // Check if details panel overlaps table
                    const table = document.querySelector('[data-testid="runs-table"]');
                    const detailsPanel = document.querySelector('[data-testid="run-details-panel"]');
                    
                    if (table && detailsPanel) {
                        const tableRect = table.getBoundingClientRect();
                        const panelRect = detailsPanel.getBoundingClientRect();
                        
                        // Check for horizontal overlap (should not happen in desktop)
                        if (window.innerWidth > 1024 && tableRect.right > panelRect.left && tableRect.left < panelRect.right) {
                            issues.push('Table and details panel overlap horizontally');
                        }
                    }
                    
                    // Check for vertical scrolling issues
                    const cardContent = document.querySelector('[data-testid="run-details-container"] .max-h-96');
                    if (cardContent && cardContent.scrollHeight > cardContent.clientHeight) {
                        issues.push('Details panel content overflows container');
                    }
                    
                    window.layoutIssues = issues;
                }
            """)
            
            layout_issues = await page.evaluate("window.layoutIssues || []")
            
            if layout_issues:
                print(f"LAYOUT ISSUES FOUND:")
                for issue in layout_issues:
                    print(f"  - {issue}")
            else:
                print("SUCCESS: No specific layout issues detected")
            
            # Check if there are test runs to display
            runs_table = await page.locator('[data-testid="runs-table"]').count()
            if runs_table > 0:
                print("SUCCESS: Runs table is present")
                
                # Try to click on a run to see if details panel appears
                first_run_button = page.locator('[data-testid="view-run-details"]').first
                if await first_run_button.count() > 0:
                    print("Clicking on first run to test details panel...")
                    await first_run_button.click()
                    await page.wait_for_timeout(1000)
                    
                    details_panel = await page.locator('[data-testid="run-details-panel"]').count()
                    if details_panel > 0:
                        print("SUCCESS: Details panel appeared")
                        await page.screenshot(path="reports_page_with_details.png", full_page=True)
                        print("Screenshot with details panel saved")
                    else:
                        print("WARNING: Details panel did not appear")
            else:
                print("INFO: No test runs available to display")
            
            # Keep browser open for manual inspection
            print("Keeping browser open for 10 seconds for inspection...")
            await page.wait_for_timeout(10000)
            
        except Exception as e:
            print(f"Error: {e}")
            await page.screenshot(path="reports_page_error.png")
            
        finally:
            await browser.close()
            print("Reports page check completed")

if __name__ == "__main__":
    asyncio.run(check_reports_page())