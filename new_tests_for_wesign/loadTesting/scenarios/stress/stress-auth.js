/**
 * WeSign K6 Stress Test - Authentication Under High Load
 *
 * Purpose: Test authentication system limits under extreme load
 * Load: 100-300 VUs pushing authentication to its limits
 * Duration: 20 minutes
 * Coverage: Concurrent logins, token management under stress, system stability
 */

import { sleep } from 'k6';
import { check } from 'k6';
import { AuthSession } from '../../utils/auth-helper.js';
import { validateAuthResponse, checkForErrors } from '../../utils/common-checks.js';
import { generateCredentials } from '../../utils/data-generator.js';

// Test configuration
export const options = {
    stages: [
        { duration: '2m', target: 50 },   // Warm up
        { duration: '3m', target: 100 },  // Increase load
        { duration: '5m', target: 200 },  // High stress level
        { duration: '5m', target: 300 },  // Maximum stress
        { duration: '3m', target: 100 },  // Scale back down
        { duration: '2m', target: 0 }     // Cool down
    ],
    thresholds: {
        http_req_duration: ['p(95)<5000'],           // 95% under 5s (relaxed for stress)
        'http_req_duration{endpoint:/users/login}': ['p(99)<3000'], // Login under 3s
        http_req_failed: ['rate<0.10'],              // Error rate under 10% (stress tolerance)
        auth_success_rate: ['rate>0.85'],            // 85% auth success under stress
        checks: ['rate>0.80']                        // 80% checks pass (stress tolerance)
    },
    tags: {
        test_type: 'stress',
        test_name: 'authentication_stress'
    }
};

// Test configuration
const baseUrl = __ENV.BASE_URL || 'https://devtest.comda.co.il/userapi/ui/v3';
const credentials = generateCredentials();

export default function() {
    const vuId = __VU;
    const iterationId = __ITER;
    const currentStage = getCurrentStage();

    console.log(`🔥 VU${vuId} Iteration${iterationId}: Stress testing authentication (Stage: ${currentStage})`);

    // Initialize authentication session
    const authSession = new AuthSession(baseUrl, credentials);

    // SCENARIO 1: Rapid Authentication Cycles (60% of VUs)
    if (Math.random() < 0.6) {
        console.log(`🚀 VU${vuId}: Rapid authentication cycle`);

        for (let cycle = 0; cycle < getAuthCyclesForStage(currentStage); cycle++) {
            // Authenticate
            const authStart = Date.now();
            const authResult = authSession.authenticate();
            const authDuration = Date.now() - authStart;

            const authChecks = check(authResult, {
                'Rapid auth successful': (r) => r.success === true,
                'Auth under stress time limit': () => authDuration < 8000,
                'Auth response received': (r) => r.response !== undefined
            });

            if (authResult.success) {
                // Quick authenticated request
                const apiClient = authSession.getAPIClient();
                const quickRequest = apiClient.users.getProfile();

                check(quickRequest, {
                    'Quick authenticated request successful': (r) => r.status === 200,
                    'Quick request fast': (r) => r.timings.duration < 3000
                });

                // Immediate logout
                const logoutResult = authSession.logout();
                check(logoutResult, {
                    'Quick logout successful': (r) => r.success === true
                });

                console.log(`✅ VU${vuId}: Rapid cycle ${cycle + 1} completed`);
            } else {
                console.error(`❌ VU${vuId}: Rapid cycle ${cycle + 1} failed`);
            }

            // Minimal think time during stress
            sleep(0.1 + Math.random() * 0.2);
        }
    }

    // SCENARIO 2: Sustained Session Testing (25% of VUs)
    else if (Math.random() < 0.85) {
        console.log(`⏰ VU${vuId}: Sustained session testing`);

        // Single authentication for sustained session
        const authResult = authSession.authenticate();

        if (authResult.success) {
            const apiClient = authSession.getAPIClient();

            // Sustained requests over time
            const requestCount = getSustainedRequestsForStage(currentStage);

            for (let req = 0; req < requestCount; req++) {
                // Alternate between different endpoints
                const endpoints = [
                    () => apiClient.users.getProfile(),
                    () => apiClient.users.getGroups(),
                    () => apiClient.documents.list({ limit: 5 }),
                    () => apiClient.templates.list(),
                    () => apiClient.contacts.list({ limit: 5 })
                ];

                const selectedEndpoint = endpoints[req % endpoints.length];
                const response = selectedEndpoint();

                checkForErrors(response, `Sustained request ${req + 1}`);

                // Token refresh simulation
                if (req > 0 && req % 10 === 0) {
                    console.log(`🔄 VU${vuId}: Testing token refresh during sustained session`);
                    const refreshResult = authSession.refreshToken();

                    check(refreshResult, {
                        'Token refresh during stress successful': (r) => r.success === true
                    });
                }

                sleep(0.2); // Brief pause between sustained requests
            }

            // Final logout
            authSession.logout();
            console.log(`✅ VU${vuId}: Sustained session completed`);
        }
    }

    // SCENARIO 3: Concurrent Session Stress (15% of VUs)
    else {
        console.log(`🏃‍♂️ VU${vuId}: Concurrent session stress`);

        // Simulate user with multiple concurrent actions
        const sessions = [];

        // Create multiple auth sessions (simulate multiple devices/tabs)
        for (let s = 0; s < 2; s++) {
            const session = new AuthSession(baseUrl, credentials);
            const authResult = session.authenticate();

            if (authResult.success) {
                sessions.push(session);
                console.log(`📱 VU${vuId}: Session ${s + 1} authenticated`);
            }
        }

        // Perform concurrent operations
        if (sessions.length > 0) {
            for (let operation = 0; operation < 5; operation++) {
                for (const session of sessions) {
                    const apiClient = session.getAPIClient();

                    // Random API call
                    const calls = [
                        () => apiClient.users.getProfile(),
                        () => apiClient.documents.list({ limit: 3 }),
                        () => apiClient.statistics.getDashboard()
                    ];

                    const randomCall = calls[Math.floor(Math.random() * calls.length)];
                    const response = randomCall();

                    checkForErrors(response, `Concurrent operation ${operation + 1}`);
                }

                sleep(0.3); // Brief pause between concurrent operations
            }

            // Cleanup all sessions
            for (const session of sessions) {
                session.logout();
            }

            console.log(`✅ VU${vuId}: Concurrent sessions completed`);
        }
    }

    // Error recovery testing
    if (Math.random() < 0.1) { // 10% chance
        console.log(`🔧 VU${vuId}: Testing error recovery`);

        // Intentionally test with invalid credentials
        const invalidSession = new AuthSession(baseUrl, {
            email: 'invalid@example.com',
            password: 'wrongpassword'
        });

        const invalidAuthResult = invalidSession.authenticate();

        check(invalidAuthResult, {
            'Invalid auth properly rejected': (r) => r.success === false,
            'Invalid auth returns error': (r) => r.response !== undefined || r.error !== undefined
        });

        // Then authenticate with valid credentials
        const validSession = new AuthSession(baseUrl, credentials);
        const validAuthResult = validSession.authenticate();

        check(validAuthResult, {
            'Recovery auth successful': (r) => r.success === true
        });

        if (validAuthResult.success) {
            validSession.logout();
        }
    }

    // Random think time (shorter during stress)
    sleep(0.5 + Math.random() * 1);
}

function getCurrentStage() {
    const elapsed = (__ENV.K6_CURRENT_STAGE_ELAPSED || 0) / 1000; // Convert to seconds

    if (elapsed < 120) return 'warmup';
    if (elapsed < 300) return 'rampup';
    if (elapsed < 600) return 'stress';
    if (elapsed < 900) return 'peak_stress';
    if (elapsed < 1080) return 'cooldown';
    return 'final';
}

function getAuthCyclesForStage(stage) {
    const cycles = {
        'warmup': 2,
        'rampup': 3,
        'stress': 5,
        'peak_stress': 7,
        'cooldown': 3,
        'final': 1
    };
    return cycles[stage] || 2;
}

function getSustainedRequestsForStage(stage) {
    const requests = {
        'warmup': 5,
        'rampup': 8,
        'stress': 12,
        'peak_stress': 15,
        'cooldown': 8,
        'final': 3
    };
    return requests[stage] || 5;
}

export function setup() {
    console.log('🔥 Starting WeSign Stress Test - Authentication');
    console.log(`📍 Base URL: ${baseUrl}`);
    console.log(`👥 Peak VUs: 300`);
    console.log(`⏱️ Duration: 20 minutes`);
    console.log(`🎯 Testing authentication system limits`);
    console.log(`⚠️ Higher error rates expected under stress conditions`);

    return {
        startTime: Date.now(),
        testType: 'authentication_stress'
    };
}

export function teardown(data) {
    const duration = (Date.now() - data.startTime) / 1000;
    console.log('🏁 Authentication Stress Test Completed');
    console.log(`⏱️ Total duration: ${duration.toFixed(2)} seconds`);
    console.log(`🔍 Review metrics for system behavior under extreme load`);
    console.log(`📊 Check for authentication bottlenecks and failures`);
}