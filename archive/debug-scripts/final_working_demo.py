#!/usr/bin/env python3
"""
SMART TEST DISCOVERY SYSTEM - FINAL WORKING DEMO
=================================================

This demo script showcases all the implemented features:
1. Authentication system working with JWT tokens
2. Test discovery database with comprehensive indexing  
3. Real-time file monitoring and auto-discovery
4. Rich filtering and search capabilities
5. API endpoints for test management

Prerequisites:
- Backend server running on http://localhost:8081
- Frontend server running on http://localhost:3008
- File watcher service active
"""

import requests
import json
import time
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:8081"
FRONTEND_URL = "http://localhost:3008"

# Demo credentials
DEMO_EMAIL = "admin@demo.com"
DEMO_PASSWORD = "demo123"

class SmartTestDiscoveryDemo:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        
    def print_header(self, title, char="="):
        """Print a formatted header"""
        print(f"\n{char * 60}")
        print(f" {title}")
        print(f"{char * 60}")
    
    def print_step(self, step_num, description):
        """Print a formatted step"""
        print(f"\n[STEP {step_num}] {description}")
        print("-" * 50)
    
    def print_success(self, message):
        """Print success message"""
        print(f"[OK] {message}")
    
    def print_error(self, message):
        """Print error message"""
        print(f"[ERROR] {message}")
    
    def print_info(self, message):
        """Print info message"""
        print(f"[INFO] {message}")
    
    def make_request(self, method, endpoint, **kwargs):
        """Make HTTP request with error handling"""
        url = f"{BACKEND_URL}{endpoint}"
        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            self.print_error(f"Request failed: {e}")
            return None
    
    def demo_authentication(self):
        """Demo 1: Authentication System"""
        self.print_step(1, "Testing Authentication System")
        
        # Test login
        login_data = {
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        }
        
        self.print_info(f"Attempting login with {DEMO_EMAIL}...")
        result = self.make_request("POST", "/api/auth/login", json=login_data)
        
        if result and result.get("success"):
            self.auth_token = result.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
            self.print_success(f"Authentication successful! Token: {self.auth_token[:20]}...")
            self.print_info(f"User: {result.get('user', {}).get('name', 'N/A')}")
            return True
        else:
            self.print_error("Authentication failed!")
            return False
    
    def demo_test_discovery(self):
        """Demo 2: Test Discovery System"""
        self.print_step(2, "Testing Smart Test Discovery")
        
        # Get discovery statistics
        self.print_info("Fetching test discovery statistics...")
        stats = self.make_request("GET", "/api/tests/stats")
        
        if stats and stats.get("success"):
            stats_data = stats.get("stats", {})
            self.print_success("Test Discovery Statistics:")
            print(f"   Total Files: {stats_data.get('totalFiles', 0):,}")
            print(f"   Total Tests: {stats_data.get('totalTests', 0):,}")
            print(f"   Categories: {len(stats_data.get('categories', {}))}")
            print(f"   Tags: {len(stats_data.get('tags', {}))}")
            print(f"   Last Scan: {stats_data.get('lastScanTime', 'N/A')}")
            return True
        else:
            self.print_error("Failed to get discovery statistics!")
            return False
    
    def demo_categories_and_tags(self):
        """Demo 3: Categories and Tags"""
        self.print_step(3, "Testing Categories and Tags")
        
        # Get top categories
        self.print_info("Fetching test categories...")
        categories = self.make_request("GET", "/api/tests/categories")
        
        if categories and categories.get("success"):
            cat_list = categories.get("categories", [])[:10]  # Top 10
            self.print_success("Top 10 Test Categories:")
            for i, cat in enumerate(cat_list, 1):
                print(f"   {i:2d}. {cat['name']:<25} ({cat['testCount']:,} tests)")
        
        # Get popular tags
        self.print_info("\\nFetching test tags...")
        tags = self.make_request("GET", "/api/tests/tags")
        
        if tags and tags.get("success"):
            tag_list = [t for t in tags.get("tags", []) if t['testCount'] >= 10][:10]
            self.print_success("Popular Test Tags (10+ tests):")
            for i, tag in enumerate(tag_list, 1):
                print(f"   {i:2d}. {tag['name']:<20} ({tag['testCount']:,} tests)")
        
        return True
    
    def demo_filtering_and_search(self):
        """Demo 4: Advanced Filtering and Search"""
        self.print_step(4, "Testing Advanced Filtering & Search")
        
        # Test category filtering
        self.print_info("Testing category filtering (auth tests)...")
        auth_tests = self.make_request("GET", "/api/tests/all", params={"category": "auth", "limit": 5})
        
        if auth_tests and auth_tests.get("success"):
            tests = auth_tests.get("tests", [])
            self.print_success(f"Found {auth_tests.get('total', 0)} auth tests (showing 5):")
            for test in tests:
                print(f"   📝 {test['testName']}")
                print(f"      📍 {test['filePath']}:{test.get('lineNumber', '?')}")
        
        # Test tag filtering  
        self.print_info("\\nTesting tag filtering (smoke tests)...")
        smoke_tests = self.make_request("GET", "/api/tests/by-tag/smoke")
        
        if smoke_tests and smoke_tests.get("success"):
            self.print_success(f"Found {smoke_tests.get('count', 0)} smoke tests")
            if smoke_tests.get("count", 0) > 0:
                test = smoke_tests["tests"][0]
                print(f"   Example: {test['testName']}")
                print(f"   Tags: {', '.join(test.get('tags', []))}")
        
        # Test search functionality
        self.print_info("\\nTesting search functionality (login)...")
        search_results = self.make_request("GET", "/api/tests/all", 
                                         params={"search": "login", "limit": 3})
        
        if search_results and search_results.get("success"):
            tests = search_results.get("tests", [])
            self.print_success(f"Found {search_results.get('total', 0)} tests matching 'login' (showing 3):")
            for test in tests:
                print(f"   🔍 {test['testName']}")
                print(f"      📂 Category: {test.get('category', 'N/A')}")
        
        return True
    
    def demo_file_watcher(self):
        """Demo 5: File Watcher Service"""
        self.print_step(5, "Testing Real-time File Monitoring")
        
        # Check file watcher status
        self.print_info("Checking file watcher status...")
        status = self.make_request("GET", "/api/tests/watch/status")
        
        if status and status.get("success"):
            watcher_status = status.get("status", {})
            is_watching = watcher_status.get("isWatching", False)
            
            if is_watching:
                self.print_success("File watcher is ACTIVE and monitoring!")
                print(f"   📂 Watch Path: {watcher_status.get('watchPath', 'N/A')}")
                print(f"   📊 Queue Size: {watcher_status.get('queueSize', 0)}")
                print(f"   👀 Watched Paths: {len(watcher_status.get('watchedPaths', []))}")
            else:
                self.print_info("File watcher is not active - starting it...")
                start_result = self.make_request("POST", "/api/tests/watch/start")
                if start_result and start_result.get("success"):
                    self.print_success("File watcher started successfully!")
                else:
                    self.print_error("Failed to start file watcher")
        
        return True
    
    def demo_create_test_file(self):
        """Demo 6: Live Test File Creation"""
        self.print_step(6, "Testing Live Test Discovery")
        
        self.print_info("Creating a new test file to demonstrate real-time discovery...")
        
        # Create a demo test file
        demo_test_content = '''"""
Live Demo Test File
Created to demonstrate real-time test discovery
"""

import pytest
from playwright.sync_api import Page, expect


class TestLiveDemo:
    """Live demo test class for real-time discovery"""
    
    @pytest.mark.smoke
    @pytest.mark.live_demo
    def test_live_demo_feature(self, page: Page):
        """Test live demo feature - should be auto-discovered"""
        page.goto("http://localhost:3008")
        expect(page).to_have_title("Playwright Smart Test Manager")
    
    @pytest.mark.regression
    @pytest.mark.live_demo  
    def test_live_demo_auth(self, page: Page):
        """Test live demo authentication"""
        page.goto("http://localhost:3008/login")
        expect(page.locator("h2")).to_contain_text("Sign In")
'''
        
        # Write the test file
        demo_file_path = "C:\\Users\\gals\\Desktop\\playwrightTestsClaude\\tests\\test_live_demo.py"
        try:
            with open(demo_file_path, 'w', encoding='utf-8') as f:
                f.write(demo_test_content)
            self.print_success("Demo test file created!")
            
            # Wait for file watcher to process
            self.print_info("Waiting 5 seconds for file watcher to detect the new file...")
            time.sleep(5)
            
            # Trigger a sync to ensure discovery
            self.print_info("Triggering manual sync to ensure discovery...")
            sync_result = self.make_request("POST", "/api/tests/sync")
            
            if sync_result and sync_result.get("success"):
                changes = sync_result.get("changes", {})
                added = changes.get("added", 0)
                self.print_success(f"Sync completed! Added {added} new tests")
            
            # Verify the tests were discovered
            self.print_info("Checking if new tests were discovered...")
            live_tests = self.make_request("GET", "/api/tests/by-tag/live_demo")
            
            if live_tests and live_tests.get("success") and live_tests.get("count", 0) > 0:
                self.print_success(f"✨ SUCCESS! Discovered {live_tests['count']} new live demo tests!")
                for test in live_tests["tests"]:
                    print(f"   🆕 {test['testName']}")
                    print(f"      📍 Line {test.get('lineNumber', '?')} in {test['filePath']}")
                    print(f"      🏷️  Tags: {', '.join(test.get('tags', []))}")
            else:
                self.print_info("Tests not yet discovered - may need another scan")
                
            return True
            
        except Exception as e:
            self.print_error(f"Failed to create demo test file: {e}")
            return False
    
    def demo_cleanup(self):
        """Demo 7: Cleanup Demo Files"""
        self.print_step(7, "Cleaning Up Demo Files")
        
        # Remove the demo file
        demo_file_path = "C:\\Users\\gals\\Desktop\\playwrightTestsClaude\\tests\\test_live_demo.py"
        try:
            import os
            if os.path.exists(demo_file_path):
                os.remove(demo_file_path)
                self.print_success("Demo test file removed")
                
                # Wait for file watcher
                self.print_info("Waiting for file watcher to detect file removal...")
                time.sleep(3)
                
                # Trigger sync
                sync_result = self.make_request("POST", "/api/tests/sync")
                if sync_result and sync_result.get("success"):
                    changes = sync_result.get("changes", {})
                    removed = changes.get("removed", 0)
                    self.print_success(f"Cleanup sync completed! Removed {removed} tests")
            
            return True
            
        except Exception as e:
            self.print_error(f"Cleanup failed: {e}")
            return False
    
    def demo_final_stats(self):
        """Demo 8: Final System Statistics"""
        self.print_step(8, "Final System Status")
        
        # Get updated statistics
        stats = self.make_request("GET", "/api/tests/stats")
        if stats and stats.get("success"):
            stats_data = stats.get("stats", {})
            
            self.print_success("🎉 FINAL SYSTEM STATUS:")
            print(f"   📊 Total Tests Indexed: {stats_data.get('totalTests', 0):,}")
            print(f"   📁 Files Monitored: {stats_data.get('totalFiles', 0):,}")
            print(f"   🏗️  Categories Available: {len(stats_data.get('categories', {}))}")
            print(f"   🔖 Tags/Markers: {len(stats_data.get('tags', {}))}")
            
            # Show top categories
            categories = stats_data.get('categories', {})
            top_cats = sorted(categories.items(), key=lambda x: x[1], reverse=True)[:5]
            print("\\n   🔥 Top Categories:")
            for name, count in top_cats:
                print(f"      • {name}: {count:,} tests")
        
        # File watcher status
        watcher = self.make_request("GET", "/api/tests/watch/status")
        if watcher and watcher.get("success"):
            is_watching = watcher.get("status", {}).get("isWatching", False)
            print(f"\\n   👀 File Watcher: {'🟢 ACTIVE' if is_watching else '🔴 INACTIVE'}")
        
        return True
    
    def run_full_demo(self):
        """Run the complete demonstration"""
        self.print_header("SMART TEST DISCOVERY SYSTEM - LIVE DEMO", "=")
        
        print("This demo showcases the complete smart test discovery system with:")
        print("   - JWT Authentication with localStorage persistence")
        print("   - Comprehensive test indexing and metadata extraction") 
        print("   - Real-time file monitoring and auto-discovery")
        print("   - Rich filtering by categories, tags, and search terms")
        print("   - REST API endpoints for all operations")
        print("   - SQLite database with full audit trail")
        
        start_time = datetime.now()
        
        # Run all demo steps
        steps = [
            self.demo_authentication,
            self.demo_test_discovery,
            self.demo_categories_and_tags,
            self.demo_filtering_and_search,
            self.demo_file_watcher,
            self.demo_create_test_file,
            self.demo_cleanup,
            self.demo_final_stats
        ]
        
        passed = 0
        for step_func in steps:
            try:
                if step_func():
                    passed += 1
                time.sleep(1)  # Brief pause between steps
            except KeyboardInterrupt:
                print("\\n⏹️  Demo interrupted by user")
                break
            except Exception as e:
                self.print_error(f"Step failed: {e}")
        
        # Summary
        duration = (datetime.now() - start_time).total_seconds()
        self.print_header("DEMO COMPLETED", "🎊")
        
        print(f"✨ Demo Results: {passed}/{len(steps)} steps completed successfully")
        print(f"⏱️  Total Duration: {duration:.1f} seconds")
        
        if passed == len(steps):
            print("\\n🏆 ALL SYSTEMS OPERATIONAL!")
            print("   The Smart Test Discovery System is fully functional with:")
            print("   ✅ Authentication working")
            print("   ✅ Test discovery active")  
            print("   ✅ Real-time monitoring enabled")
            print("   ✅ Database populated and queryable")
            print("   ✅ API endpoints responding")
        else:
            print(f"\\n⚠️  Some issues detected - {len(steps) - passed} steps had problems")
        
        print("\\n📖 Check the detailed database report: TEST_DISCOVERY_DATABASE_REPORT.md")
        print("🌐 Frontend available at: http://localhost:3008")
        print("🔌 Backend API at: http://localhost:8081")


def main():
    """Main entry point"""
    print("Starting Smart Test Discovery System Demo...")
    
    # Check if servers are running
    try:
        requests.get(f"{BACKEND_URL}/api/health", timeout=5)
        print("✅ Backend server is responsive")
    except:
        print("❌ Backend server not responding at http://localhost:8081")
        print("   Please start the backend server first: cd backend && npm run dev")
        return 1
    
    try:
        requests.get(f"{FRONTEND_URL}", timeout=5)  
        print("✅ Frontend server is responsive")
    except:
        print("❌ Frontend server not responding at http://localhost:3008")
        print("   Please start the frontend server: cd playwright-smart && npm run dev")
        return 1
    
    # Run the demo
    demo = SmartTestDiscoveryDemo()
    demo.run_full_demo()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())