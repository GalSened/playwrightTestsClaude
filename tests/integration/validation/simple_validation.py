"""
Simple Dashboard Validation
"""

import requests

def test_dashboard():
    try:
        print("Testing dashboard at http://localhost:3000...")
        response = requests.get("http://localhost:3000", timeout=5)
        
        if response.status_code == 200:
            content = response.text
            print(f"SUCCESS: Dashboard responding (Content: {len(content)} bytes)")
            
            if "QA Intelligence" in content:
                print("SUCCESS: Found QA Intelligence title")
                return True
            else:
                print("WARNING: QA Intelligence title not found - may still be loading")
                return False
        else:
            print(f"ERROR: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False

def test_backend():
    try:
        print("Testing backend at http://localhost:8081...")
        response = requests.get("http://localhost:8081/api/tests/all", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print(f"SUCCESS: Backend responding (Tests: {len(data.get('tests', []))})")
            return True
        else:
            print(f"ERROR: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False

if __name__ == "__main__":
    print("=== DASHBOARD VALIDATION ===")
    
    dashboard_ok = test_dashboard()
    backend_ok = test_backend()
    
    print("\n=== RESULTS ===")
    if dashboard_ok and backend_ok:
        print("SUCCESS: Dashboard unified successfully!")
    else:
        print("ISSUES: Dashboard needs more work")
        print(f"Frontend OK: {dashboard_ok}")
        print(f"Backend OK: {backend_ok}")