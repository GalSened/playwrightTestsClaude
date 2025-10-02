import asyncio
import json
import aiohttp

async def test_prd_coverage_analysis():
    """Test the new PRD coverage analysis endpoint using WeSign PRD requirements"""
    
    try:
        async with aiohttp.ClientSession() as session:
            print("Testing WeSign PRD coverage analysis API...")
            
            url = "http://localhost:8081/api/analytics/prd-coverage"
            
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    print("SUCCESS: PRD coverage analysis API working")
                    print(f"Response keys: {list(data.keys())}")
                    
                    # Check expected structure
                    expected_keys = ['summary', 'coverageByPriority', 'coverageByCategory', 'gaps', 'recommendations', 'detailedRequirements', 'generatedAt']
                    missing_keys = [key for key in expected_keys if key not in data]
                    
                    if missing_keys:
                        print(f"WARNING: Missing expected keys: {missing_keys}")
                    else:
                        print("SUCCESS: All expected keys present")
                    
                    # Print WeSign PRD coverage summary
                    summary = data.get('summary', {})
                    print(f"\n=== WeSign PRD Coverage Summary ===")
                    print(f"Total Requirements: {summary.get('totalRequirements', 'N/A')}")
                    print(f"Covered Requirements: {summary.get('coveredRequirements', 'N/A')}")
                    print(f"Overall Coverage: {summary.get('overallCoverage', 'N/A')}%")
                    print(f"Critical Coverage: {summary.get('criticalCoverage', 'N/A')}%")
                    print(f"High Priority Coverage: {summary.get('highCoverage', 'N/A')}%")
                    print(f"Medium Priority Coverage: {summary.get('mediumCoverage', 'N/A')}%")
                    
                    # Print coverage by category for WeSign modules
                    print(f"\n=== WeSign Module Coverage ===")
                    categories = data.get('coverageByCategory', [])
                    for category in categories[:10]:  # Show top 10 categories
                        print(f"{category['category']}: {category['covered']}/{category['total']} ({category['coverage']}%)")
                    
                    # Print critical gaps from WeSign PRD
                    critical_gaps = data.get('gaps', {}).get('critical', [])
                    if critical_gaps:
                        print(f"\n=== Critical WeSign Requirements Missing Coverage ===")
                        for gap in critical_gaps[:5]:  # Show first 5 critical gaps
                            print(f"- {gap['requirement']} ({gap['category']})")
                    
                    # Print recommendations for WeSign testing
                    recommendations = data.get('recommendations', [])
                    if recommendations:
                        print(f"\n=== WeSign Testing Recommendations ===")
                        for rec in recommendations[:3]:  # Show top 3 recommendations
                            print(f"[{rec['priority'].upper()}] {rec['title']}")
                            print(f"  Action: {rec['action']}")
                    
                    # Verify this is using WeSign PRD requirements
                    detailed_reqs = data.get('detailedRequirements', [])
                    wesign_specific_found = False
                    for req in detailed_reqs:
                        if any(keyword in req['requirement'].lower() for keyword in ['hamburger menu', 'home module', 'contacts module', 'templates module', 'documents module', 'signature']):
                            wesign_specific_found = True
                            print(f"\nCONFIRMED: Using WeSign PRD requirements")
                            print(f"  Example: {req['requirement']}")
                            break
                    
                    if not wesign_specific_found:
                        print(f"\nWARNING: May not be using WeSign PRD requirements")
                    
                else:
                    print(f"FAILED: API returned status {response.status}")
                    error_text = await response.text()
                    print(f"Error response: {error_text}")
                    
    except Exception as e:
        print(f"ERROR: Failed to test PRD coverage API - {e}")

async def main():
    print("=== Testing WeSign PRD Coverage Analysis ===" )
    await test_prd_coverage_analysis()
    print("=== Test Complete ===")

if __name__ == "__main__":
    asyncio.run(main())