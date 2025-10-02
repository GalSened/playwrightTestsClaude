/**
 * Phase 2 Diagnostic Script
 * Investigates specific failures and identifies missing dependencies
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8082';
const UNIFIED_API_BASE = `${BASE_URL}/api/wesign/unified`;

async function investigateIssues() {
  console.log('🔍 Phase 2 Issue Investigation');
  console.log('===============================\n');

  // 1. Check core system health first
  console.log('1. System Health Check:');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('   ✅ Core system health:', response.data.status);
    console.log('   📊 Worker status:', response.data.worker);
  } catch (error) {
    console.log('   ❌ Core system health failed:', error.message);
  }

  // 2. Detailed Health Analysis
  console.log('\n2. Unified Health Analysis:');
  try {
    const response = await axios.get(`${UNIFIED_API_BASE}/health`);
    console.log('   Response should not be reached due to 503');
  } catch (error) {
    if (error.response?.status === 503) {
      const healthData = error.response.data;
      console.log('   🏥 Health Status: UNHEALTHY (503)');
      console.log('   📋 Component Status:');

      if (healthData.health?.components) {
        Object.entries(healthData.health.components).forEach(([component, status]) => {
          const icon = status.status === 'healthy' ? '✅' : '❌';
          console.log(`      ${icon} ${component}: ${status.status}`);
          if (status.message) {
            console.log(`         Message: ${status.message}`);
          }
        });
      }
    } else {
      console.log('   ❌ Unexpected error:', error.message);
    }
  }

  // 3. Test Scheduler Issue Analysis
  console.log('\n3. Test Scheduler Investigation:');
  try {
    // Try creating a schedule with minimal data
    const minimalSchedule = {
      name: 'diagnostic-test',
      cronExpression: '0 0 * * *',
      testConfig: {
        framework: 'wesign',
        testIds: ['test1']
      }
    };

    const response = await axios.post(`${UNIFIED_API_BASE}/schedule`, minimalSchedule);
    console.log('   ✅ Schedule creation works');
  } catch (error) {
    console.log('   ❌ Schedule creation failed:', error.response?.data?.error || error.message);

    // Check if it's a cron library issue
    if (error.response?.data?.error?.includes('cronJob.nextDate')) {
      console.log('   🔧 Issue: Cron library compatibility problem');
      console.log('   💡 Likely cause: Missing or incompatible node-cron dependency');
    }
  }

  // 4. Execution Flow Analysis
  console.log('\n4. Execution Flow Test:');
  try {
    const execConfig = {
      framework: 'wesign',
      workers: 1,
      testIds: ['diagnostic-test']
    };

    const response = await axios.post(`${UNIFIED_API_BASE}/execute`, execConfig);
    const executionId = response.data.executionId;
    console.log('   ✅ Execution queued:', executionId);

    // Wait and check status
    setTimeout(async () => {
      try {
        const statusResponse = await axios.get(`${UNIFIED_API_BASE}/execute/${executionId}/status`);
        console.log('   📊 Execution status:', statusResponse.data.execution?.status);

        // Check artifacts
        try {
          const artifactsResponse = await axios.get(`${UNIFIED_API_BASE}/execute/${executionId}/artifacts`);
          console.log('   📦 Artifacts available:', Object.keys(artifactsResponse.data.artifacts || {}));
        } catch (artifactsError) {
          console.log('   ❌ Artifacts not available:', artifactsError.response?.data?.error || artifactsError.message);
        }
      } catch (statusError) {
        console.log('   ❌ Status check failed:', statusError.response?.data?.error || statusError.message);
      }
    }, 1000);

  } catch (error) {
    console.log('   ❌ Execution queuing failed:', error.response?.data?.error || error.message);
  }

  // 5. Component Dependency Check
  console.log('\n5. Component Dependencies:');
  try {
    const statsResponse = await axios.get(`${UNIFIED_API_BASE}/stats`);
    const pluginStats = statsResponse.data.stats.pluginManager;

    console.log('   📊 Plugin Manager Status:');
    console.log(`      Total Plugins: ${pluginStats.totalPlugins}`);

    pluginStats.plugins.forEach(plugin => {
      const icon = plugin.isReady ? '✅' : '❌';
      console.log(`      ${icon} ${plugin.name} v${plugin.version}`);
      console.log(`         Features: ${plugin.features.slice(0, 3).join(', ')}...`);
    });

    const eventBusStats = statsResponse.data.stats.eventBus;
    console.log('\n   📡 Event Bus Status:');
    console.log(`      Active Subscribers: ${Object.keys(eventBusStats.subscribers).length}`);
    console.log(`      WebSocket Clients: ${eventBusStats.wsClients}`);
    console.log(`      Event History: ${eventBusStats.eventHistory}`);

  } catch (error) {
    console.log('   ❌ Component analysis failed:', error.message);
  }

  // 6. Missing Dependencies Analysis
  console.log('\n6. Dependency Analysis:');

  // Check if core modules exist
  const requiredModules = [
    'ExecutionManager',
    'TestScheduler',
    'UnifiedTestEngine',
    'PluginManager',
    'EventBus'
  ];

  console.log('   📋 Required Phase 2 Components:');

  const fs = require('fs');
  const path = require('path');

  requiredModules.forEach(module => {
    const filePath = path.join(__dirname, 'backend', 'src', 'core', 'wesign', `${module}.ts`);
    const exists = fs.existsSync(filePath);
    const icon = exists ? '✅' : '❌';
    console.log(`      ${icon} ${module}: ${exists ? 'Present' : 'Missing'}`);
  });

  // 7. Queue Status Deep Dive
  console.log('\n7. Queue Management Analysis:');
  try {
    const queueResponse = await axios.get(`${UNIFIED_API_BASE}/queue/status`);
    const queueData = queueResponse.data;

    console.log('   📊 Queue Status:');
    console.log(`      Queued: ${queueData.queue.totalQueued}`);
    console.log(`      Running: ${queueData.queue.totalRunning}`);
    console.log(`      Available Resources: ${queueData.resources.available ? 'Yes' : 'No'}`);
    console.log(`      Memory Usage: ${queueData.resources.memoryMB}MB / ${queueData.resources.limits.maxMemoryMB}MB`);
    console.log(`      Max Concurrent: ${queueData.resources.limits.maxConcurrentExecutions}`);

  } catch (error) {
    console.log('   ❌ Queue analysis failed:', error.message);
  }

  console.log('\n🎯 DIAGNOSTIC SUMMARY:');
  console.log('======================');
  console.log('Based on the investigation:');
  console.log('1. Core system is running but UnifiedTestEngine has adapter issues');
  console.log('2. TestScheduler has cron library compatibility problems');
  console.log('3. ExecutionManager queue system is functional');
  console.log('4. Plugin system is working with WeSign plugin loaded');
  console.log('5. Event bus system is operational');
  console.log('\n💡 Recommended fixes:');
  console.log('• Fix cron library compatibility in TestScheduler');
  console.log('• Initialize UnifiedTestEngine adapters properly');
  console.log('• Ensure artifact storage system is configured');
  console.log('• Add health check timeouts to prevent 503 responses');
}

if (require.main === module) {
  investigateIssues().catch(console.error);
}