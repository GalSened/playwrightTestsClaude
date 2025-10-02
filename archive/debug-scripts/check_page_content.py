import pytest
from playwright.sync_api import Page
import time

def test_check_page_content(page: Page):
    """Check what content is actually displayed on the Reports page"""
    
    print("="*60)
    print("CHECKING PAGE CONTENT")
    print("="*60)
    
    print("1. Navigating to Reports page...")
    page.goto("http://localhost:3001/reports")
    page.wait_for_load_state('networkidle')
    time.sleep(3)
    
    print("2. Getting page title...")
    title = page.title()
    print(f"   Browser title: {title}")
    
    print("3. Getting page URL...")
    url = page.url
    print(f"   Current URL: {url}")
    
    print("4. Getting page text content...")
    body = page.locator('body')
    content = body.text_content()
    print(f"   Page content (first 500 chars): {content[:500] if content else 'NO CONTENT'}")
    
    print("5. Getting page HTML...")
    html = page.content()
    print(f"   Page HTML (first 1000 chars): {html[:1000] if html else 'NO HTML'}")
    
    print("6. Checking for React root...")
    react_root = page.locator('#root')
    if react_root.is_visible():
        print("   React root found!")
        root_content = react_root.text_content()
        print(f"   Root content: {root_content[:200] if root_content else 'EMPTY'}")
    else:
        print("   React root NOT found!")
    
    print("7. Checking for any error messages...")
    error_elements = page.locator('text=Error')
    error_count = error_elements.count()
    print(f"   Found {error_count} error messages")
    
    return True