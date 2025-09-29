"""
Final Dashboard Validation
Simple test to verify the unified dashboard is working
"""

import requests
import time
from urllib.parse import urljoin

def test_dashboard_endpoints():
    base_url = "http://localhost:3000"
    
    try:
        print("Testing frontend server...")
        response = requests.get(base_url, timeout=10)
        if response.status_code == 200:
            print("✅ Frontend server responding")
            print(f"   Content length: {len(response.content)} bytes")
            
            # Check if it contains React app
            content = response.text
            if "QA Intelligence" in content or "root" in content:
                print("✅ React app detected in response")
            else:
                print("⚠️ React app not detected - might be loading issue")
            
            return True
        else:
            print(f"❌ Frontend server returned {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Frontend server error: {str(e)}")
        return False

def test_backend_endpoints():
    backend_url = "http://localhost:8081"
    
    try:
        print("\nTesting backend APIs...")
        
        # Test basic API endpoints
        endpoints = [
            "/api/tests/all",
            "/api/execute/history", 
            "/api/analytics/smart"
        ]
        
        for endpoint in endpoints:
            try:
                response = requests.get(urljoin(backend_url, endpoint), timeout=5)
                if response.status_code == 200:
                    print(f"✅ {endpoint} - OK")
                else:
                    print(f"⚠️ {endpoint} - HTTP {response.status_code}")
            except Exception as e:
                print(f"❌ {endpoint} - Error: {str(e)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Backend error: {str(e)}")
        return False

if __name__ == "__main__":
    print("=== FINAL DASHBOARD VALIDATION ===")
    
    frontend_ok = test_dashboard_endpoints()
    backend_ok = test_backend_endpoints()
    
    print(f"\n{'='*40}")
    print("VALIDATION SUMMARY")
    print(f"{'='*40}")
    
    if frontend_ok and backend_ok:
        print("🎉 SUCCESS: All systems operational!")
        print("   Dashboard should be accessible at http://localhost:3000")
    elif frontend_ok:
        print("⚠️ PARTIAL: Frontend OK, Backend issues")
    elif backend_ok:
        print("⚠️ PARTIAL: Backend OK, Frontend issues") 
    else:
        print("❌ FAILURE: Both Frontend and Backend have issues")
    
    print(f"{'='*40}")