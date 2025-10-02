// Test the TestSuiteRegistry directly
const { testSuiteRegistry } = require('./backend/src/services/testSuiteRegistry');

async function testRegistry() {
  try {
    console.log('Initializing TestSuiteRegistry...');
    await testSuiteRegistry.initialize();
    
    console.log('\nGetting all suites...');
    const suites = testSuiteRegistry.getAllSuites();
    console.log(`Found ${suites.length} test suites`);
    
    suites.slice(0, 3).forEach(suite => {
      console.log(`- ${suite.name} (${suite.category}): ${suite.testFiles.length} tests`);
    });
    
    console.log('\nExecution statistics:');
    const stats = testSuiteRegistry.getExecutionStats();
    console.log(JSON.stringify(stats, null, 2));
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testRegistry();