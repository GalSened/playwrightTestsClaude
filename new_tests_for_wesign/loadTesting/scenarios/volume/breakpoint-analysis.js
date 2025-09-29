/**
 * WeSign K6 Volume Test - Breakpoint Analysis
 *
 * Purpose: Find the exact point where performance begins to degrade
 * Load: Incremental increases from 10 to 500 VUs
 * Duration: 45 minutes with systematic load increases
 * Coverage: Identify system limits and optimal capacity
 */

import { sleep } from 'k6';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { AuthSession } from '../../utils/auth-helper.js';
import { validateJSONResponse, validatePerformance } from '../../utils/common-checks.js';
import { generateCredentials, generateUserJourneyData } from '../../utils/data-generator.js';

// Custom metrics for breakpoint analysis
const breakpointResponseTime = new Trend('breakpoint_response_time');
const breakpointErrorRate = new Rate('breakpoint_error_rate');
const breakpointThroughput = new Counter('breakpoint_throughput');
const breakpointSystemStress = new Trend('breakpoint_system_stress');

// Test configuration - Incremental load increases
export const options = {
    stages: [
        // Systematic load increases to find breakpoint
        { duration: '3m', target: 10 },   // Baseline
        { duration: '3m', target: 25 },   // Light load
        { duration: '3m', target: 50 },   // Moderate load
        { duration: '3m', target: 75 },   // Increased load
        { duration: '3m', target: 100 },  // High load
        { duration: '3m', target: 150 },  // Very high load
        { duration: '3m', target: 200 },  // Extreme load
        { duration: '3m', target: 300 },  // Breaking point search
        { duration: '3m', target: 400 },  // System limits
        { duration: '3m', target: 500 },  // Maximum stress
        { duration: '3m', target: 100 },  // Recovery test
        { duration: '3m', target: 0 }     // Cool down
    ],
    thresholds: {
        // More relaxed thresholds for breakpoint analysis
        http_req_duration: ['p(95)<10000'],     // Allow degradation for analysis
        http_req_failed: ['rate<0.25'],         // 25% error tolerance for breakpoint
        breakpoint_response_time: ['p(95)<15000'], // Track response time degradation
        breakpoint_error_rate: ['rate<0.30'],   // Track error rate increases
        auth_success_rate: ['rate>0.70']        // Minimum auth success
    },
    tags: {
        test_type: 'volume',
        test_name: 'breakpoint_analysis'
    }
};

// Test configuration
const baseUrl = __ENV.BASE_URL || 'https://devtest.comda.co.il/userapi/ui/v3';
const credentials = generateCredentials();

// Breakpoint tracking
let currentLoadLevel = 0;
let performanceBaseline = null;
let breakpointDetected = false;
let breakpointLevel = null;

export default function() {
    const vuId = __VU;
    const iterationId = __ITER;
    const loadLevel = getCurrentLoadLevel();
    const testPhase = getBreakpointPhase(loadLevel);

    // Track current load level
    if (loadLevel !== currentLoadLevel) {
        currentLoadLevel = loadLevel;
        console.log(`📊 Load Level Changed: ${loadLevel} VUs (Phase: ${testPhase})`);
    }

    console.log(`📈 VU${vuId} Iteration${iterationId}: Breakpoint analysis (Level: ${loadLevel}, Phase: ${testPhase})`);

    // Initialize session with performance tracking
    const sessionStart = Date.now();
    const authSession = new AuthSession(baseUrl, credentials);

    // Authentication with breakpoint monitoring
    const authStart = Date.now();
    const authResult = authSession.authenticate();
    const authDuration = Date.now() - authStart;

    // Track authentication performance at different load levels
    breakpointResponseTime.add(authDuration, { operation: 'auth', load_level: loadLevel });

    if (!authResult.success) {
        console.error(`❌ VU${vuId}: Auth failed at load level ${loadLevel}`);
        breakpointErrorRate.add(1, { load_level: loadLevel });
        return;
    }

    const apiClient = authSession.getAPIClient();

    // BREAKPOINT SCENARIO 1: Core Operations Performance (60% of traffic)
    if (Math.random() < 0.6) {
        console.log(`🔍 VU${vuId}: Core operations breakpoint testing`);

        performCoreOperationsTest(vuId, apiClient, loadLevel, testPhase);
    }

    // BREAKPOINT SCENARIO 2: Resource-Intensive Operations (25% of traffic)
    else if (Math.random() < 0.85) {
        console.log(`🚀 VU${vuId}: Resource-intensive breakpoint testing`);

        performResourceIntensiveTest(vuId, apiClient, loadLevel, testPhase);
    }

    // BREAKPOINT SCENARIO 3: System Health Monitoring (15% of traffic)
    else {
        console.log(`🔧 VU${vuId}: System health breakpoint monitoring`);

        performSystemHealthBreakpointTest(vuId, apiClient, loadLevel, testPhase);
    }

    // Session completion tracking
    const sessionDuration = Date.now() - sessionStart;
    breakpointSystemStress.add(sessionDuration, { load_level: loadLevel });

    // Breakpoint detection logic
    detectBreakpoint(loadLevel, sessionDuration, authDuration);

    // Throughput tracking
    breakpointThroughput.add(1, { load_level: loadLevel });

    // Logout with performance tracking
    const logoutStart = Date.now();
    const logoutResult = authSession.logout();
    const logoutDuration = Date.now() - logoutStart;

    if (!logoutResult.success) {
        breakpointErrorRate.add(1, { operation: 'logout', load_level: loadLevel });
    }

    // Load-level appropriate think time
    const thinkTime = getBreakpointThinkTime(loadLevel, testPhase);
    sleep(thinkTime);
}

function performCoreOperationsTest(vuId, apiClient, loadLevel, testPhase) {
    const operations = [
        {
            name: 'profile',
            operation: () => apiClient.users.getProfile(),
            expectedTime: 1000
        },
        {
            name: 'documents_list',
            operation: () => apiClient.documents.list({ limit: 10 }),
            expectedTime: 2000
        },
        {
            name: 'contacts_list',
            operation: () => apiClient.contacts.list(),
            expectedTime: 1500
        },
        {
            name: 'templates_list',
            operation: () => apiClient.templates.list(),
            expectedTime: 1500
        }
    ];

    for (const op of operations) {
        const opStart = Date.now();
        const response = op.operation();
        const opDuration = Date.now() - opStart;

        // Track performance at current load level
        breakpointResponseTime.add(opDuration, {
            operation: op.name,
            load_level: loadLevel
        });

        const performanceCheck = check(response, {
            [`${op.name} success at load ${loadLevel}`]: (r) => r.status === 200,
            [`${op.name} time acceptable at load ${loadLevel}`]: () => opDuration < (op.expectedTime * getToleranceMultiplier(loadLevel)),
            [`${op.name} system responsive at load ${loadLevel}`]: (r) => r.status !== 0
        });

        if (!performanceCheck) {
            breakpointErrorRate.add(1, { operation: op.name, load_level: loadLevel });
        }

        console.log(`📊 VU${vuId}: ${op.name} at load ${loadLevel}: ${response.status} in ${opDuration}ms`);

        sleep(0.2);
    }
}

function performResourceIntensiveTest(vuId, apiClient, loadLevel, testPhase) {
    // Resource-intensive operations for stress testing
    const intensiveOps = [
        {
            name: 'statistics_dashboard',
            operation: () => apiClient.statistics.getDashboard(),
            expectedTime: 3000
        },
        {
            name: 'documents_detailed',
            operation: () => apiClient.documents.list({ limit: 20, includeDetails: true }),
            expectedTime: 4000
        },
        {
            name: 'configuration_full',
            operation: () => apiClient.configuration.get(),
            expectedTime: 2000
        }
    ];

    for (const op of intensiveOps) {
        const opStart = Date.now();
        const response = op.operation();
        const opDuration = Date.now() - opStart;

        // More lenient checks for resource-intensive operations
        const intensiveCheck = check(response, {
            [`Intensive ${op.name} completes at load ${loadLevel}`]: (r) => r.status < 500,
            [`Intensive ${op.name} not timeout at load ${loadLevel}`]: () => opDuration < 30000,
            [`Intensive ${op.name} responsive at load ${loadLevel}`]: (r) => r.status !== 0
        });

        breakpointResponseTime.add(opDuration, {
            operation: `intensive_${op.name}`,
            load_level: loadLevel
        });

        if (!intensiveCheck) {
            breakpointErrorRate.add(1, { operation: `intensive_${op.name}`, load_level: loadLevel });
        }

        console.log(`🚀 VU${vuId}: Intensive ${op.name} at load ${loadLevel}: ${response.status} in ${opDuration}ms`);

        sleep(0.5);
    }
}

function performSystemHealthBreakpointTest(vuId, apiClient, loadLevel, testPhase) {
    console.log(`🔍 VU${vuId}: System health check at load level ${loadLevel}`);

    // Quick health checks
    const healthOps = [
        () => apiClient.users.getProfile(),
        () => apiClient.documents.list({ limit: 1 })
    ];

    let healthyOps = 0;
    let totalResponseTime = 0;

    for (const healthOp of healthOps) {
        const healthStart = Date.now();
        const healthResponse = healthOp();
        const healthDuration = Date.now() - healthStart;

        totalResponseTime += healthDuration;

        if (healthResponse.status === 200) {
            healthyOps++;
        }
    }

    const systemHealth = healthyOps / healthOps.length;
    const avgResponseTime = totalResponseTime / healthOps.length;

    // Report system health at current load
    check({ health: systemHealth, avgTime: avgResponseTime }, {
        [`System health OK at load ${loadLevel}`]: (data) => data.health >= 0.5,
        [`System responsive at load ${loadLevel}`]: (data) => data.avgTime < 10000
    });

    console.log(`🏥 VU${vuId}: System health at load ${loadLevel}: ${(systemHealth * 100).toFixed(1)}%, avg response: ${avgResponseTime.toFixed(0)}ms`);

    // Track system stress indicators
    breakpointSystemStress.add(avgResponseTime, {
        load_level: loadLevel,
        health_ratio: systemHealth
    });
}

function detectBreakpoint(loadLevel, sessionDuration, authDuration) {
    // Establish baseline from early load levels
    if (loadLevel <= 25 && !performanceBaseline) {
        performanceBaseline = {
            sessionDuration: sessionDuration,
            authDuration: authDuration,
            loadLevel: loadLevel
        };
        console.log(`📋 Baseline established at load ${loadLevel}: session=${sessionDuration}ms, auth=${authDuration}ms`);
        return;
    }

    // Detect breakpoint when performance degrades significantly
    if (performanceBaseline && !breakpointDetected) {
        const sessionDegradation = sessionDuration / performanceBaseline.sessionDuration;
        const authDegradation = authDuration / performanceBaseline.authDuration;

        // Breakpoint criteria: 3x performance degradation
        if (sessionDegradation > 3 || authDegradation > 3) {
            breakpointDetected = true;
            breakpointLevel = loadLevel;

            console.log(`🚨 BREAKPOINT DETECTED at load level ${loadLevel}!`);
            console.log(`📊 Session degradation: ${sessionDegradation.toFixed(2)}x`);
            console.log(`🔐 Auth degradation: ${authDegradation.toFixed(2)}x`);
        }
    }
}

function getCurrentLoadLevel() {
    // Estimate current load level based on VU count
    const currentVUs = __VU;

    if (currentVUs <= 10) return 10;
    if (currentVUs <= 25) return 25;
    if (currentVUs <= 50) return 50;
    if (currentVUs <= 75) return 75;
    if (currentVUs <= 100) return 100;
    if (currentVUs <= 150) return 150;
    if (currentVUs <= 200) return 200;
    if (currentVUs <= 300) return 300;
    if (currentVUs <= 400) return 400;
    if (currentVUs <= 500) return 500;

    return currentVUs;
}

function getBreakpointPhase(loadLevel) {
    if (loadLevel <= 25) return 'baseline';
    if (loadLevel <= 75) return 'moderate';
    if (loadLevel <= 150) return 'high';
    if (loadLevel <= 300) return 'extreme';
    if (loadLevel <= 500) return 'breaking';
    return 'recovery';
}

function getToleranceMultiplier(loadLevel) {
    // Increase tolerance as load increases
    if (loadLevel <= 50) return 2;
    if (loadLevel <= 100) return 3;
    if (loadLevel <= 200) return 4;
    if (loadLevel <= 300) return 5;
    return 6;
}

function getBreakpointThinkTime(loadLevel, testPhase) {
    // Decrease think time as load increases to maintain pressure
    const baseTimes = {
        'baseline': 2,
        'moderate': 1.5,
        'high': 1,
        'extreme': 0.5,
        'breaking': 0.3,
        'recovery': 2
    };

    return baseTimes[testPhase] || 1;
}

export function setup() {
    console.log('📈 Starting WeSign Volume Test - Breakpoint Analysis');
    console.log(`📍 Base URL: ${baseUrl}`);
    console.log(`📊 Load Progression: 10 → 500 VUs in stages`);
    console.log(`⏱️ Duration: 45 minutes`);
    console.log(`🎯 Objective: Find performance breakpoint and system limits`);
    console.log(`📋 Tracking: Response times, error rates, throughput at each level`);

    return {
        startTime: Date.now(),
        testType: 'breakpoint_analysis'
    };
}

export function teardown(data) {
    const duration = (Date.now() - data.startTime) / 1000;
    console.log('🏁 Breakpoint Analysis Completed');
    console.log(`⏱️ Total duration: ${duration.toFixed(2)} seconds`);

    if (breakpointDetected) {
        console.log(`🚨 BREAKPOINT IDENTIFIED: ${breakpointLevel} VUs`);
        console.log(`📊 Recommendation: Optimal capacity is likely ${Math.floor(breakpointLevel * 0.7)} VUs`);
    } else {
        console.log(`✅ No clear breakpoint detected up to 500 VUs`);
        console.log(`📊 System appears stable under tested load levels`);
    }

    console.log('📈 Analysis Results:');
    console.log(`  - Baseline performance: ${performanceBaseline ? `${performanceBaseline.sessionDuration}ms at ${performanceBaseline.loadLevel} VUs` : 'Not established'}`);
    console.log(`  - Peak load tested: 500 VUs`);
    console.log(`  - Breakpoint detected: ${breakpointDetected ? `Yes (${breakpointLevel} VUs)` : 'No'}`);

    console.log('🔍 Review detailed metrics for:');
    console.log('  - Response time trends by load level');
    console.log('  - Error rate progression');
    console.log('  - Throughput characteristics');
    console.log('  - System stress indicators');
}