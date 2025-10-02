#!/usr/bin/env python3
"""
Simple System Health Check for QA Intelligence Platform
Tests core functionality and provides status report
"""

import requests
import json
import time
from datetime import datetime

def test_endpoint(url, method="GET", data=None):
    """Test a single endpoint"""
    start_time = time.time()
    try:
        if method == "GET":
            response = requests.get(url, timeout=10)
        else:
            response = requests.post(url, json=data, timeout=10)
        
        response_time = (time.time() - start_time) * 1000
        return {
            "status": "OK" if response.status_code == 200 else "WARN",
            "response_time_ms": round(response_time, 2),
            "status_code": response.status_code,
            "data": response.json() if response.status_code == 200 else None
        }
    except requests.exceptions.Timeout:
        return {"status": "TIMEOUT", "error": "Request timeout"}
    except Exception as e:
        return {"status": "ERROR", "error": str(e)}

def main():
    """Run system health checks"""
    print("=== QA Intelligence System Health Check ===")
    print(f"Timestamp: {datetime.now()}")
    print()
    
    base_url = "http://localhost:8081"
    results = []
    
    # Test endpoints
    endpoints = [
        ("Core Health", f"{base_url}/api/health"),
        ("Healing Health", f"{base_url}/api/healing/health"), 
        ("Healing Stats", f"{base_url}/api/healing/stats"),
        ("Test Stats", f"{base_url}/api/tests/stats"),
        ("Worker Status", f"{base_url}/api/worker/status"),
    ]
    
    print("Testing Core Services:")
    print("-" * 40)
    
    for name, url in endpoints:
        result = test_endpoint(url)
        results.append((name, result))
        
        status_icon = "✓" if result["status"] == "OK" else "✗" if result["status"] == "ERROR" else "!"
        response_time = result.get("response_time_ms", 0)
        print(f"{status_icon} {name:<20} {result['status']:<8} {response_time:>6.1f}ms")
    
    # Test self-healing functionality
    print("\nTesting Self-Healing System:")
    print("-" * 40)
    
    healing_test_data = {
        "error": {"message": "Element not found"},
        "context": {
            "selector": "button.missing",
            "url": "https://devtest.comda.co.il",
            "testType": "click",
            "dom": "<button>Test</button>"
        }
    }
    
    healing_result = test_endpoint(f"{base_url}/api/healing/analyze", "POST", healing_test_data)
    results.append(("Healing Analyze", healing_result))
    
    status_icon = "✓" if healing_result["status"] == "OK" else "✗"
    response_time = healing_result.get("response_time_ms", 0)
    print(f"{status_icon} {'Healing Analyze':<20} {healing_result['status']:<8} {response_time:>6.1f}ms")
    
    # Calculate overall health
    healthy_count = sum(1 for _, result in results if result["status"] == "OK")
    total_count = len(results)
    health_percentage = (healthy_count / total_count) * 100
    
    print("\n" + "="*50)
    print("SYSTEM HEALTH SUMMARY")
    print("="*50)
    print(f"Services Tested: {total_count}")
    print(f"Healthy Services: {healthy_count}")
    print(f"Health Percentage: {health_percentage:.1f}%")
    
    if health_percentage >= 90:
        overall_status = "EXCELLENT"
    elif health_percentage >= 70:
        overall_status = "GOOD"
    elif health_percentage >= 50:
        overall_status = "DEGRADED"
    else:
        overall_status = "CRITICAL"
    
    print(f"Overall Status: {overall_status}")
    
    # Show key metrics
    print("\nKey Metrics:")
    print("-" * 20)
    
    # Get test stats
    for name, result in results:
        if name == "Test Stats" and result["status"] == "OK":
            data = result["data"]
            print(f"Total Tests: {data.get('stats', {}).get('totalTests', 'N/A')}")
            print(f"Test Categories: {len(data.get('stats', {}).get('categories', {}))}")
            
        elif name == "Healing Stats" and result["status"] == "OK":
            data = result["data"]
            print(f"Healing Success Rate: {data.get('successRate', 'N/A')}%")
            print(f"Total Healing Items: {data.get('total', 'N/A')}")
            
        elif name == "Worker Status" and result["status"] == "OK":
            data = result["data"]
            print(f"Worker Running: {data.get('isRunning', 'N/A')}")
            print(f"Active Executions: {data.get('activeExecutions', 'N/A')}")
    
    # Performance analysis
    response_times = [result.get("response_time_ms", 0) for _, result in results if result.get("response_time_ms")]
    if response_times:
        avg_response = sum(response_times) / len(response_times)
        max_response = max(response_times)
        print(f"\nPerformance:")
        print(f"Average Response Time: {avg_response:.1f}ms")
        print(f"Max Response Time: {max_response:.1f}ms")
        
        if avg_response < 100:
            perf_rating = "EXCELLENT"
        elif avg_response < 500:
            perf_rating = "GOOD"
        else:
            perf_rating = "SLOW"
        print(f"Performance Rating: {perf_rating}")
    
    print("\n" + "="*50)
    
    # Save results
    report = {
        "timestamp": datetime.now().isoformat(),
        "overall_status": overall_status,
        "health_percentage": health_percentage,
        "results": {name: result for name, result in results}
    }
    
    with open("health_report.json", "w") as f:
        json.dump(report, f, indent=2)
    
    print("Detailed report saved to: health_report.json")
    return overall_status

if __name__ == "__main__":
    status = main()
    exit(0 if status in ["EXCELLENT", "GOOD"] else 1)