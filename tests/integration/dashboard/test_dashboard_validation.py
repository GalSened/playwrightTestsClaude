"""
Dashboard Validation Test
Verify that the unified dashboard loads correctly
"""

import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

async def test_unified_dashboard():
    print("=== UNIFIED DASHBOARD VALIDATION ===")
    
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False, slow_mo=1000)
    page = await browser.new_page()
    
    dashboard_errors = []
    network_errors = []
    
    # Track network errors
    page.on("response", lambda response: 
        network_errors.append(f"HTTP {response.status}: {response.url}") 
        if response.status >= 400 else None
    )
    
    # Track console errors
    page.on("console", lambda msg: 
        dashboard_errors.append(f"Console {msg.type}: {msg.text}") 
        if msg.type == "error" else None
    )
    
    try:
        print("1. Navigating to dashboard...")
        await page.goto("http://localhost:3000", wait_for="networkidle")
        await asyncio.sleep(5)
        
        # Check if dashboard page loaded
        dashboard_title = await page.query_selector('[data-testid="page-title"]')
        if dashboard_title:
            title_text = await dashboard_title.inner_text()
            print(f"✅ Dashboard title: {title_text}")
        else:
            dashboard_errors.append("Dashboard title not found")
        
        # Check for health score hero section
        health_hero = await page.query_selector('[data-testid="health-score-hero"]')
        if health_hero:
            print("✅ Health score hero section found")
        else:
            dashboard_errors.append("Health score hero section missing")
        
        # Check for KPI cards
        kpi_cards = await page.query_selector_all('.grid .bg-white, Card')
        print(f"✅ Found {len(kpi_cards)} KPI cards")
        
        # Check for analytics integration
        coverage_module = await page.query_selector('[data-testid="coverage-by-module"]')
        if coverage_module:
            print("✅ Coverage by module section found")
        else:
            print("⚠️ Coverage by module section not found (may be empty)")
        
        # Check for AI insights
        ai_insights = await page.query_selector('[data-testid="ai-insights"]')
        if ai_insights:
            print("✅ AI insights section found")
        else:
            print("⚠️ AI insights section not found (may be empty)")
        
        # Check for execution monitor
        execution_monitor = await page.query_selector('[data-testid="execution-monitor"]')
        if execution_monitor:
            print("✅ Execution monitor found")
        else:
            print("⚠️ Execution monitor not found (may be empty)")
        
        # Check auto-refresh toggle
        auto_refresh = await page.query_selector('text=Auto-refresh')
        if auto_refresh:
            print("✅ Auto-refresh toggle found")
        else:
            dashboard_errors.append("Auto-refresh toggle missing")
        
        print("2. Testing analytics route redirect...")
        await page.goto("http://localhost:3000/analytics", wait_for="networkidle")
        await asyncio.sleep(2)
        
        current_url = page.url
        if current_url.endswith('/'):
            print("✅ Analytics route redirects to dashboard")
        else:
            dashboard_errors.append(f"Analytics route failed to redirect: {current_url}")
        
        print("3. Waiting 10 seconds to observe loading...")
        await asyncio.sleep(10)
        
        return {
            'dashboard_loaded': len(dashboard_errors) == 0,
            'errors': dashboard_errors,
            'network_errors': network_errors,
            'total_errors': len(dashboard_errors) + len(network_errors)
        }
        
    except Exception as e:
        dashboard_errors.append(f"Test execution error: {str(e)}")
        return {
            'dashboard_loaded': False,
            'errors': dashboard_errors,
            'network_errors': network_errors,
            'total_errors': len(dashboard_errors) + len(network_errors)
        }
    
    finally:
        await asyncio.sleep(3)
        await browser.close()

if __name__ == "__main__":
    result = asyncio.run(test_unified_dashboard())
    
    print("\n" + "="*50)
    print("UNIFIED DASHBOARD VALIDATION RESULTS")
    print("="*50)
    
    if result['dashboard_loaded'] and result['total_errors'] == 0:
        print("🎉 SUCCESS: Dashboard loaded perfectly!")
    elif result['total_errors'] <= 2:
        print("⚠️  PARTIAL SUCCESS: Dashboard loaded with minor issues")
    else:
        print("❌ FAILURE: Dashboard has significant issues")
    
    if result['errors']:
        print(f"\n📋 Dashboard Issues ({len(result['errors'])}):")
        for error in result['errors']:
            print(f"  - {error}")
    
    if result['network_errors']:
        print(f"\n🌐 Network Issues ({len(result['network_errors'])}):")
        for error in result['network_errors']:
            print(f"  - {error}")
    
    if not result['errors'] and not result['network_errors']:
        print("\n✅ No errors detected!")
    
    print("="*50)