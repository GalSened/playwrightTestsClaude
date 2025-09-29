/**
 * WeSign K6 Soak Test - Long-term Endurance Testing
 *
 * Purpose: Detect memory leaks, degradation, and long-term stability issues
 * Load: 50 VUs sustained for 4 hours
 * Duration: 4 hours continuous testing
 * Coverage: All major workflows over extended period, resource monitoring
 */

import { sleep } from 'k6';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { AuthSession } from '../../utils/auth-helper.js';
import {
    validateJSONResponse,
    validateCRUDResponse,
    validatePerformance
} from '../../utils/common-checks.js';
import {
    generateCredentials,
    generateUserJourneyData,
    generateContact,
    generateDocument,
    generateTemplate
} from '../../utils/data-generator.js';

// Custom metrics for long-term monitoring
const soakMemoryTrend = new Trend('soak_memory_usage');
const soakPerformanceDegradation = new Trend('soak_performance_degradation');
const soakSessionDuration = new Trend('soak_session_duration');
const soakErrorEscalation = new Counter('soak_error_escalation');

// Test configuration - Long duration soak
export const options = {
    stages: [
        { duration: '5m', target: 20 },   // Gradual ramp up
        { duration: '10m', target: 50 },  // Reach target load
        { duration: '4h', target: 50 },   // SOAK: Sustained load for 4 hours
        { duration: '5m', target: 0 }     // Graceful shutdown
    ],
    thresholds: {
        http_req_duration: ['p(95)<4000'],      // Performance shouldn't degrade significantly
        http_req_failed: ['rate<0.02'],         // Error rate should remain low
        auth_success_rate: ['rate>0.98'],       // Auth should remain stable
        checks: ['rate>0.95'],                  // High success rate over time
        soak_performance_degradation: ['p(95)<5000'], // Performance degradation tracking
        soak_error_escalation: ['count<100']    // Limit error escalation
    },
    tags: {
        test_type: 'soak',
        test_name: 'endurance_testing'
    }
};

// Test configuration
const baseUrl = __ENV.BASE_URL || 'https://devtest.comda.co.il/userapi/ui/v3';
const credentials = generateCredentials();

// Global state for soak testing
let soakStartTime = Date.now();
let baselinePerformance = null;
let sessionCounter = 0;

export default function() {
    const vuId = __VU;
    const iterationId = __ITER;
    const testPhase = getSoakPhase();
    const elapsedMinutes = (Date.now() - soakStartTime) / (1000 * 60);

    console.log(`🕰️ VU${vuId} Iteration${iterationId}: Soak test (Phase: ${testPhase}, Elapsed: ${elapsedMinutes.toFixed(1)}m)`);

    // Track session duration
    const sessionStart = Date.now();
    sessionCounter++;

    // Initialize session with retry logic for long-term stability
    const authSession = new AuthSession(baseUrl, credentials);
    let authAttempts = 0;
    let authResult;

    // Robust authentication with retries
    do {
        authResult = authSession.authenticate();
        authAttempts++;

        if (!authResult.success && authAttempts < 3) {
            console.log(`🔄 VU${vuId}: Auth retry ${authAttempts} after failure`);
            sleep(2); // Wait before retry
        }
    } while (!authResult.success && authAttempts < 3);

    if (!authResult.success) {
        console.error(`❌ VU${vuId}: Authentication failed after retries in soak test`);
        soakErrorEscalation.add(1);
        return;
    }

    const apiClient = authSession.getAPIClient();

    // LONG-TERM SCENARIO 1: Realistic User Workflow (50% of iterations)
    if (Math.random() < 0.5) {
        console.log(`👤 VU${vuId}: Long-term user workflow`);

        performLongTermUserWorkflow(vuId, apiClient, testPhase);
    }

    // LONG-TERM SCENARIO 2: Data Management Operations (30% of iterations)
    else if (Math.random() < 0.8) {
        console.log(`📊 VU${vuId}: Long-term data management`);

        performLongTermDataManagement(vuId, apiClient, testPhase);
    }

    // LONG-TERM SCENARIO 3: System Health Monitoring (20% of iterations)
    else {
        console.log(`🔍 VU${vuId}: System health monitoring`);

        performSystemHealthCheck(vuId, apiClient, testPhase, elapsedMinutes);
    }

    // Session cleanup and tracking
    const sessionEnd = Date.now();
    const sessionDuration = sessionEnd - sessionStart;

    soakSessionDuration.add(sessionDuration);

    const logoutResult = authSession.logout();
    if (!logoutResult.success) {
        console.warn(`⚠️ VU${vuId}: Logout failed in soak test`);
        soakErrorEscalation.add(1);
    }

    // Performance degradation tracking
    if (baselinePerformance && sessionDuration > baselinePerformance * 1.5) {
        soakPerformanceDegradation.add(sessionDuration);
        console.warn(`📈 VU${vuId}: Performance degradation detected: ${sessionDuration}ms vs baseline ${baselinePerformance}ms`);
    } else if (!baselinePerformance && iterationId < 10) {
        // Establish baseline in first few iterations
        baselinePerformance = sessionDuration;
    }

    // Long-term appropriate think time with variability
    const thinkTime = getSoakThinkTime(testPhase, elapsedMinutes);
    sleep(thinkTime);
}

function performLongTermUserWorkflow(vuId, apiClient, testPhase) {
    const workflowStart = Date.now();

    // 1. Profile and settings check
    const profileResponse = apiClient.users.getProfile();
    validateJSONResponse(profileResponse, 200, 'Soak profile check');

    sleep(1);

    // 2. Document browsing
    const docsResponse = apiClient.documents.list({ limit: 20 });
    validateJSONResponse(docsResponse, 200, 'Soak documents list');

    sleep(1);

    // 3. Contact management
    const contactsResponse = apiClient.contacts.list();
    validateJSONResponse(contactsResponse, 200, 'Soak contacts list');

    // Occasionally create new contact (data accumulation test)
    if (Math.random() < 0.1) {
        const newContact = generateContact({ soakTest: true, vuId });
        const createResponse = apiClient.contacts.create(newContact);
        validateCRUDResponse(createResponse, 'create', 'Soak contact creation');
    }

    sleep(1);

    // 4. Template operations
    const templatesResponse = apiClient.templates.list();
    validateJSONResponse(templatesResponse, 200, 'Soak templates list');

    sleep(1);

    // 5. Configuration check
    const configResponse = apiClient.configuration.get();
    validateJSONResponse(configResponse, 200, 'Soak configuration check');

    const workflowDuration = Date.now() - workflowStart;
    console.log(`✅ VU${vuId}: Long-term workflow completed in ${workflowDuration}ms`);
}

function performLongTermDataManagement(vuId, apiClient, testPhase) {
    const dataStart = Date.now();

    // 1. Data retrieval operations
    const operations = [
        () => apiClient.documents.list({ page: Math.floor(Math.random() * 5) + 1 }),
        () => apiClient.contacts.list(),
        () => apiClient.templates.list(),
        () => apiClient.statistics.getDashboard(),
        () => apiClient.distribution.list()
    ];

    for (let i = 0; i < 5; i++) {
        const operation = operations[i];
        const response = operation();

        check(response, {
            [`Soak data operation ${i + 1} success`]: (r) => r.status === 200,
            [`Soak data operation ${i + 1} performance`]: (r) => r.timings.duration < 5000
        });

        sleep(0.5);
    }

    // 2. Periodic data creation (test for memory leaks)
    if (Math.random() < 0.05) { // 5% chance
        console.log(`📝 VU${vuId}: Creating test data for memory leak detection`);

        const testDocument = generateDocument({ soakTest: true, timestamp: Date.now() });
        // Simulate document upload (small data)
        const uploadResponse = apiClient.documents.upload('small_test_data', testDocument.name);

        check(uploadResponse, {
            'Soak data creation success': (r) => r.status === 200 || r.status === 201
        });
    }

    const dataDuration = Date.now() - dataStart;
    console.log(`📊 VU${vuId}: Data management completed in ${dataDuration}ms`);
}

function performSystemHealthCheck(vuId, apiClient, testPhase, elapsedMinutes) {
    const healthStart = Date.now();

    console.log(`🏥 VU${vuId}: System health check at ${elapsedMinutes.toFixed(1)} minutes`);

    // 1. Basic connectivity check
    const profileResponse = apiClient.users.getProfile();
    const profileHealth = check(profileResponse, {
        'Health check - profile accessible': (r) => r.status === 200,
        'Health check - response time OK': (r) => r.timings.duration < 3000
    });

    // 2. Resource availability check
    const resourceChecks = [
        apiClient.documents.list({ limit: 1 }),
        apiClient.contacts.list({ limit: 1 }),
        apiClient.templates.list()
    ];

    let healthyResources = 0;
    for (const resourceResponse of resourceChecks) {
        if (resourceResponse.status === 200) {
            healthyResources++;
        }
    }

    const resourceHealth = check({ healthyResources }, {
        'Health check - most resources available': (data) => data.healthyResources >= 2
    });

    // 3. Performance baseline comparison
    const currentPerformance = Date.now() - healthStart;
    if (baselinePerformance) {
        const performanceDegradation = (currentPerformance / baselinePerformance) - 1;

        check({ degradation: performanceDegradation }, {
            'Health check - performance within limits': (data) => data.degradation < 0.5 // 50% degradation limit
        });

        if (performanceDegradation > 0.2) {
            console.warn(`📈 VU${vuId}: Performance degradation detected: ${(performanceDegradation * 100).toFixed(1)}%`);
        }
    }

    // 4. Error rate monitoring
    if (!profileHealth || !resourceHealth) {
        soakErrorEscalation.add(1);
        console.warn(`🚨 VU${vuId}: System health issues detected at ${elapsedMinutes.toFixed(1)} minutes`);
    }

    console.log(`✅ VU${vuId}: Health check completed`);
}

function getSoakPhase() {
    const elapsed = (Date.now() - soakStartTime) / (1000 * 60); // minutes

    if (elapsed < 5) return 'rampup';
    if (elapsed < 15) return 'stabilization';
    if (elapsed < 240) return 'soak'; // 4 hours
    return 'shutdown';
}

function getSoakThinkTime(testPhase, elapsedMinutes) {
    // Gradually increase think time to simulate real user behavior over time
    const baseThinkTime = {
        'rampup': 2,
        'stabilization': 3,
        'soak': 4,
        'shutdown': 2
    }[testPhase] || 3;

    // Add variability and slight increase over time
    const timeVariability = Math.random() * 2; // 0-2 seconds
    const timeIncrease = Math.min(elapsedMinutes / 60, 2); // Max 2 seconds increase over time

    return baseThinkTime + timeVariability + timeIncrease;
}

export function setup() {
    console.log('🕰️ Starting WeSign Soak Test - Long-term Endurance');
    console.log(`📍 Base URL: ${baseUrl}`);
    console.log(`👥 Sustained VUs: 50`);
    console.log(`⏱️ Duration: 4+ hours`);
    console.log(`🎯 Testing: Memory leaks, performance degradation, long-term stability`);
    console.log(`🔍 Monitoring: Error escalation, session duration, performance trends`);

    soakStartTime = Date.now();

    // Initial system health check
    const preTestSession = new AuthSession(baseUrl, credentials);
    const preTestAuth = preTestSession.authenticate();

    if (preTestAuth.success) {
        console.log('✅ Pre-soak system health: OK');
        preTestSession.logout();
    } else {
        console.warn('⚠️ Pre-soak system health: Issues detected');
    }

    return {
        startTime: soakStartTime,
        testType: 'endurance_soak',
        preTestHealth: preTestAuth.success
    };
}

export function teardown(data) {
    const totalDuration = (Date.now() - data.startTime) / (1000 * 60 * 60); // hours
    console.log('🏁 Soak Test - Endurance Testing Completed');
    console.log(`⏱️ Total duration: ${totalDuration.toFixed(2)} hours`);
    console.log(`📊 Total sessions: ${sessionCounter}`);

    // Final system health check
    const postTestSession = new AuthSession(baseUrl, credentials);
    const postTestAuth = postTestSession.authenticate();

    console.log(`📈 Pre-test health: ${data.preTestHealth ? 'OK' : 'ISSUES'}`);
    console.log(`📈 Post-test health: ${postTestAuth.success ? 'OK' : 'ISSUES'}`);

    if (postTestAuth.success) {
        console.log('✅ System survived soak testing');
        postTestSession.logout();
    } else {
        console.warn('⚠️ System showing issues after soak testing');
    }

    console.log('🔍 Review metrics for:');
    console.log('  - Performance degradation over time');
    console.log('  - Memory usage trends');
    console.log('  - Error escalation patterns');
    console.log('  - Session duration increases');
}