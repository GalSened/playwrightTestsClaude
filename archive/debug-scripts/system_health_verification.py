#!/usr/bin/env python3
"""
Comprehensive System Health Verification Script
Tests all major QA Intelligence components and provides detailed health report
"""

import asyncio
import aiohttp
import json
import time
from typing import Dict, List, Any
from datetime import datetime

class SystemHealthChecker:
    def __init__(self):
        self.base_url = "http://localhost:8081"
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "overall_status": "unknown",
            "components": {},
            "performance_metrics": {},
            "recommendations": []
        }
    
    async def check_endpoint(self, session: aiohttp.ClientSession, endpoint: str, method: str = "GET", data: dict = None) -> Dict[str, Any]:
        """Test a single endpoint and return health status"""
        start_time = time.time()
        try:
            if method == "GET":
                async with session.get(f"{self.base_url}{endpoint}", timeout=10) as response:
                    response_data = await response.json()
                    response_time = (time.time() - start_time) * 1000
                    return {
                        "status": "healthy" if response.status == 200 else "degraded",
                        "response_time_ms": round(response_time, 2),
                        "status_code": response.status,
                        "data": response_data
                    }
            elif method == "POST":
                async with session.post(f"{self.base_url}{endpoint}", json=data, timeout=10) as response:
                    response_data = await response.json()
                    response_time = (time.time() - start_time) * 1000
                    return {
                        "status": "healthy" if response.status in [200, 201] else "degraded",
                        "response_time_ms": round(response_time, 2),
                        "status_code": response.status,
                        "data": response_data
                    }
        except asyncio.TimeoutError:
            return {
                "status": "timeout",
                "response_time_ms": (time.time() - start_time) * 1000,
                "error": "Request timeout after 10 seconds"
            }
        except Exception as e:
            return {
                "status": "error",
                "response_time_ms": (time.time() - start_time) * 1000,
                "error": str(e)
            }
    
    async def test_core_api(self, session: aiohttp.ClientSession):
        """Test core API endpoints"""
        print("🔍 Testing Core API...")
        
        # Health endpoints
        health_check = await self.check_endpoint(session, "/api/health")
        healing_health = await self.check_endpoint(session, "/api/healing/health")
        
        # Stats endpoints  
        healing_stats = await self.check_endpoint(session, "/api/healing/stats")
        test_stats = await self.check_endpoint(session, "/api/tests/stats")
        worker_status = await self.check_endpoint(session, "/api/worker/status")
        
        self.results["components"]["core_api"] = {
            "health_check": health_check,
            "healing_health": healing_health,
            "healing_stats": healing_stats,
            "test_stats": test_stats,
            "worker_status": worker_status,
            "overall_status": "healthy" if all(
                result["status"] == "healthy" 
                for result in [health_check, healing_health, healing_stats, test_stats, worker_status]
            ) else "degraded"
        }
        
        return self.results["components"]["core_api"]["overall_status"] == "healthy"
    
    async def test_self_healing_system(self, session: aiohttp.ClientSession):
        """Test self-healing system functionality"""
        print("🔧 Testing Self-Healing System...")
        
        # Test healing analyze endpoint
        analyze_test_data = {
            "error": {"message": "Element not found: button.test"},
            "context": {
                "selector": "button.missing",
                "url": "https://devtest.comda.co.il",
                "testType": "click",
                "dom": "<button class=\"btn\">Test Button</button>"
            }
        }
        
        analyze_result = await self.check_endpoint(
            session, "/api/healing/analyze", "POST", analyze_test_data
        )
        
        # Test healing queue
        queue_result = await self.check_endpoint(session, "/api/healing/queue")
        
        # Test healing patterns
        patterns_result = await self.check_endpoint(
            session, "/api/healing/patterns?testType=click&originalSelector=button.missing"
        )
        
        self.results["components"]["self_healing"] = {
            "analyze_functionality": analyze_result,
            "queue_access": queue_result,
            "patterns_search": patterns_result,
            "overall_status": "healthy" if all(
                result["status"] in ["healthy", "degraded"] 
                for result in [analyze_result, queue_result, patterns_result]
            ) else "error"
        }
        
        return self.results["components"]["self_healing"]["overall_status"] in ["healthy", "degraded"]
    
    async def test_database_connectivity(self, session: aiohttp.ClientSession):
        """Test database operations"""
        print("🗄️ Testing Database Connectivity...")
        
        # Check test discovery (requires database)
        test_stats = await self.check_endpoint(session, "/api/tests/stats")
        
        # Check healing stats (requires database)  
        healing_stats = await self.check_endpoint(session, "/api/healing/stats")
        
        database_healthy = (
            test_stats["status"] == "healthy" and 
            healing_stats["status"] == "healthy" and
            "stats" in test_stats.get("data", {}) and
            "total" in healing_stats.get("data", {})
        )
        
        self.results["components"]["database"] = {
            "test_stats_query": test_stats,
            "healing_stats_query": healing_stats,
            "data_integrity": database_healthy,
            "overall_status": "healthy" if database_healthy else "degraded"
        }
        
        return database_healthy
    
    async def test_worker_system(self, session: aiohttp.ClientSession):
        """Test background worker system"""
        print("⚙️ Testing Worker System...")
        
        worker_status = await self.check_endpoint(session, "/api/worker/status")
        
        worker_healthy = (
            worker_status["status"] == "healthy" and
            worker_status.get("data", {}).get("isRunning") is True
        )
        
        self.results["components"]["worker_system"] = {
            "worker_status": worker_status,
            "is_running": worker_healthy,
            "overall_status": "healthy" if worker_healthy else "error"
        }
        
        return worker_healthy
    
    async def test_performance_benchmarks(self, session: aiohttp.ClientSession):
        """Test system performance benchmarks"""
        print("📊 Testing Performance Benchmarks...")
        
        # Test multiple rapid requests
        endpoints_to_test = [
            "/api/health",
            "/api/healing/health", 
            "/api/healing/stats",
            "/api/tests/stats",
            "/api/worker/status"
        ]
        
        response_times = []
        for endpoint in endpoints_to_test:
            result = await self.check_endpoint(session, endpoint)
            if "response_time_ms" in result:
                response_times.append(result["response_time_ms"])
        
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        max_response_time = max(response_times) if response_times else 0
        
        # Performance thresholds
        performance_rating = "excellent" if avg_response_time < 100 else "good" if avg_response_time < 500 else "poor"
        
        self.results["performance_metrics"] = {
            "average_response_time_ms": round(avg_response_time, 2),
            "max_response_time_ms": round(max_response_time, 2),
            "performance_rating": performance_rating,
            "total_endpoints_tested": len(endpoints_to_test),
            "successful_responses": len([t for t in response_times if t > 0])
        }
        
        return performance_rating in ["excellent", "good"]
    
    def analyze_results(self):
        """Analyze all test results and provide overall health assessment"""
        print("📋 Analyzing Results...")
        
        component_statuses = []
        for component_name, component_data in self.results["components"].items():
            status = component_data.get("overall_status", "unknown")
            component_statuses.append(status == "healthy")
            
        performance_good = self.results["performance_metrics"].get("performance_rating") in ["excellent", "good"]
        
        # Overall system health
        healthy_components = sum(component_statuses)
        total_components = len(component_statuses)
        
        if healthy_components == total_components and performance_good:
            self.results["overall_status"] = "excellent"
        elif healthy_components >= total_components * 0.8:  # 80% healthy
            self.results["overall_status"] = "good"
        elif healthy_components >= total_components * 0.5:  # 50% healthy
            self.results["overall_status"] = "degraded"
        else:
            self.results["overall_status"] = "critical"
        
        # Generate recommendations
        self.generate_recommendations()
        
    def generate_recommendations(self):
        """Generate system recommendations based on health check results"""
        recommendations = []
        
        # Check component statuses
        for component_name, component_data in self.results["components"].items():
            if component_data.get("overall_status") != "healthy":
                if component_name == "core_api":
                    recommendations.append("Core API has issues - check server logs and restart if needed")
                elif component_name == "self_healing":
                    recommendations.append("Self-healing system degraded - verify healing service configuration")
                elif component_name == "database":
                    recommendations.append("Database connectivity issues - check SQLite file and permissions")
                elif component_name == "worker_system":
                    recommendations.append("Background worker not running - restart worker system")
        
        # Performance recommendations
        avg_response = self.results["performance_metrics"].get("average_response_time_ms", 0)
        if avg_response > 500:
            recommendations.append("High response times detected - consider optimizing database queries")
        elif avg_response > 1000:
            recommendations.append("Very slow response times - system may be under heavy load")
        
        # Healing system specific recommendations
        healing_stats = self.results["components"].get("self_healing", {}).get("analyze_functionality", {})
        if healing_stats.get("status") == "healthy":
            healing_data = healing_stats.get("data", {})
            if "successRate" in healing_data and healing_data["successRate"] < 70:
                recommendations.append("Self-healing success rate below 70% - review healing patterns")
        
        self.results["recommendations"] = recommendations or ["System is healthy - no immediate action required"]
    
    def print_results(self):
        """Print comprehensive health check results"""
        print("\n" + "="*80)
        print("🏥 QA INTELLIGENCE - SYSTEM HEALTH REPORT")
        print("="*80)
        print(f"📅 Timestamp: {self.results['timestamp']}")
        print(f"🎯 Overall Status: {self.results['overall_status'].upper()}")
        print("\n📊 COMPONENT HEALTH:")
        print("-" * 40)
        
        for component_name, component_data in self.results["components"].items():
            status = component_data.get("overall_status", "unknown")
            status_icon = "✅" if status == "healthy" else "⚠️" if status == "degraded" else "❌"
            print(f"{status_icon} {component_name.replace('_', ' ').title()}: {status.upper()}")
        
        print("\n⚡ PERFORMANCE METRICS:")
        print("-" * 40)
        perf = self.results["performance_metrics"]
        print(f"📈 Average Response Time: {perf.get('average_response_time_ms', 0):.2f}ms")
        print(f"📊 Max Response Time: {perf.get('max_response_time_ms', 0):.2f}ms") 
        print(f"🎯 Performance Rating: {perf.get('performance_rating', 'unknown').upper()}")
        print(f"✅ Successful Responses: {perf.get('successful_responses', 0)}/{perf.get('total_endpoints_tested', 0)}")
        
        print("\n💡 RECOMMENDATIONS:")
        print("-" * 40)
        for i, rec in enumerate(self.results["recommendations"], 1):
            print(f"{i}. {rec}")
        
        print("\n" + "="*80)
        
        # Save results to file
        with open("system_health_report.json", "w") as f:
            json.dump(self.results, f, indent=2)
        print("📝 Detailed report saved to: system_health_report.json")
    
    async def run_comprehensive_check(self):
        """Run all health checks"""
        print("🚀 Starting Comprehensive System Health Check...\n")
        
        async with aiohttp.ClientSession() as session:
            # Test all components
            await self.test_core_api(session)
            await self.test_self_healing_system(session)
            await self.test_database_connectivity(session)
            await self.test_worker_system(session)
            await self.test_performance_benchmarks(session)
            
        # Analyze and print results
        self.analyze_results()
        self.print_results()
        
        return self.results["overall_status"]

async def main():
    """Main execution function"""
    checker = SystemHealthChecker()
    overall_status = await checker.run_comprehensive_check()
    
    # Exit with appropriate code
    exit_codes = {
        "excellent": 0,
        "good": 0, 
        "degraded": 1,
        "critical": 2
    }
    
    exit_code = exit_codes.get(overall_status, 2)
    print(f"\n🏁 Health check completed with status: {overall_status.upper()}")
    exit(exit_code)

if __name__ == "__main__":
    asyncio.run(main())