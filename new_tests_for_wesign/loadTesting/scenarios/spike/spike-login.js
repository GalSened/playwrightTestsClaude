/**
 * WeSign K6 Spike Test - Login Endpoint Sudden Load
 *
 * Purpose: Test system response to sudden massive traffic spikes on login
 * Load: 1 VU → 200 VUs in 30 seconds → back to 1 VU
 * Duration: 5 minutes total
 * Coverage: Login endpoint under sudden extreme load, system recovery
 */

import { sleep } from 'k6';
import { check } from 'k6';
import { AuthSession } from '../../utils/auth-helper.js';
import { validateAuthResponse, checkForErrors } from '../../utils/common-checks.js';
import { generateCredentials } from '../../utils/data-generator.js';

// Test configuration - Classic spike pattern
export const options = {
    stages: [
        { duration: '1m', target: 1 },    // Baseline
        { duration: '30s', target: 200 }, // SPIKE! Sudden massive load
        { duration: '2m', target: 200 },  // Sustain spike
        { duration: '30s', target: 1 },   // Rapid drop
        { duration: '1m', target: 1 }     // Recovery baseline
    ],
    thresholds: {
        http_req_duration: ['p(95)<10000'],          // 95% under 10s (spike tolerance)
        'http_req_duration{endpoint:/users/login}': ['p(99)<8000'], // Login under 8s during spike
        http_req_failed: ['rate<0.15'],              // Error rate under 15% (spike tolerance)
        auth_success_rate: ['rate>0.70'],            // 70% auth success during spike
        checks: ['rate>0.65']                        // 65% checks pass (spike tolerance)
    },
    tags: {
        test_type: 'spike',
        test_name: 'login_spike'
    }
};

// Test configuration
const baseUrl = __ENV.BASE_URL || 'https://devtest.comda.co.il/userapi/ui/v3';
const credentials = generateCredentials();

export default function() {
    const vuId = __VU;
    const iterationId = __ITER;
    const currentPhase = getSpikePhase();

    console.log(`⚡ VU${vuId} Iteration${iterationId}: Spike test (Phase: ${currentPhase})`);

    // Adjust behavior based on spike phase
    const testIntensity = getTestIntensityForPhase(currentPhase);

    // SCENARIO 1: Direct Login Spike (70% of traffic)
    if (Math.random() < 0.7) {
        console.log(`🚀 VU${vuId}: Direct login spike testing`);

        // During spike, perform rapid login attempts
        const loginAttempts = testIntensity.loginAttempts;

        for (let attempt = 0; attempt < loginAttempts; attempt++) {
            const authSession = new AuthSession(baseUrl, credentials);

            const loginStart = Date.now();
            const authResult = authSession.authenticate();
            const loginDuration = Date.now() - loginStart;

            const spikeChecks = check(authResult, {
                [`Spike login attempt ${attempt + 1} success`]: (r) => r.success === true,
                [`Spike login ${attempt + 1} time acceptable`]: () => loginDuration < 15000,
                [`Spike login ${attempt + 1} response received`]: (r) => r.response !== undefined
            });

            if (authResult.success) {
                console.log(`✅ VU${vuId}: Spike login ${attempt + 1} successful (${loginDuration}ms)`);

                // Quick verification request
                const apiClient = authSession.getAPIClient();
                const verifyResponse = apiClient.users.getProfile();

                check(verifyResponse, {
                    [`Spike verify ${attempt + 1} successful`]: (r) => r.status === 200,
                    [`Spike verify ${attempt + 1} fast`]: (r) => r.timings.duration < 5000
                });

                // Immediate logout to free resources
                authSession.logout();
            } else {
                console.error(`❌ VU${vuId}: Spike login ${attempt + 1} failed (${loginDuration}ms)`);

                // During spike, may need to wait before retry
                if (currentPhase === 'spike' || currentPhase === 'sustain') {
                    sleep(0.5); // Brief recovery wait
                }
            }

            // Minimal delay during spike
            sleep(testIntensity.delayBetweenAttempts);
        }
    }

    // SCENARIO 2: Login + Quick Operations Spike (20% of traffic)
    else if (Math.random() < 0.9) {
        console.log(`⚡ VU${vuId}: Login + operations spike testing`);

        const authSession = new AuthSession(baseUrl, credentials);
        const authResult = authSession.authenticate();

        if (authResult.success) {
            const apiClient = authSession.getAPIClient();

            // Rapid-fire requests after login
            const operations = [
                () => apiClient.users.getProfile(),
                () => apiClient.documents.list({ limit: 5 }),
                () => apiClient.contacts.list({ limit: 3 })
            ];

            for (let op = 0; op < testIntensity.operationsCount; op++) {
                const operation = operations[op % operations.length];
                const opResponse = operation();

                checkForErrors(opResponse, `Spike operation ${op + 1}`);

                sleep(0.1); // Very brief pause between operations
            }

            authSession.logout();
        }
    }

    // SCENARIO 3: Error Recovery During Spike (10% of traffic)
    else {
        console.log(`🔧 VU${vuId}: Error recovery during spike`);

        // Test system resilience during spike
        const authSession = new AuthSession(baseUrl, credentials);

        // First, try authentication
        const authResult = authSession.authenticate();

        if (!authResult.success) {
            // Retry mechanism during spike
            console.log(`🔄 VU${vuId}: Retrying authentication during spike`);

            sleep(1); // Wait before retry

            const retryResult = authSession.authenticate();

            check(retryResult, {
                'Spike retry authentication': (r) => r !== undefined,
                'Spike system responsive': (r) => r.response !== undefined || r.error !== undefined
            });

            if (retryResult.success) {
                console.log(`✅ VU${vuId}: Recovery successful during spike`);
                const apiClient = authSession.getAPIClient();

                // Single verification request
                const verifyResponse = apiClient.users.getProfile();
                checkForErrors(verifyResponse, 'Spike recovery verification');

                authSession.logout();
            }
        } else {
            // Authentication successful, test sustained operations
            const apiClient = authSession.getAPIClient();

            // Test if system can handle requests during spike
            for (let test = 0; test < 3; test++) {
                const testResponse = apiClient.users.getProfile();

                check(testResponse, {
                    [`Spike sustained operation ${test + 1}`]: (r) => r.status === 200 || r.status === 429 || r.status === 503,
                    [`Spike operation ${test + 1} completes`]: (r) => r.timings.duration < 20000
                });

                sleep(0.5);
            }

            authSession.logout();
        }
    }

    // Phase-appropriate think time
    sleep(testIntensity.thinkTime);
}

function getSpikePhase() {
    // Estimate current phase based on test duration
    // This is a simplified approach - in real K6, you might use __ENV variables
    const elapsed = (__ENV.K6_CURRENT_STAGE_ELAPSED || 0) / 1000;

    if (elapsed < 60) return 'baseline';
    if (elapsed < 90) return 'spike';
    if (elapsed < 210) return 'sustain';
    if (elapsed < 240) return 'drop';
    return 'recovery';
}

function getTestIntensityForPhase(phase) {
    const intensities = {
        'baseline': {
            loginAttempts: 1,
            operationsCount: 2,
            delayBetweenAttempts: 0.5,
            thinkTime: 2
        },
        'spike': {
            loginAttempts: 3,
            operationsCount: 5,
            delayBetweenAttempts: 0.1,
            thinkTime: 0.2
        },
        'sustain': {
            loginAttempts: 2,
            operationsCount: 4,
            delayBetweenAttempts: 0.2,
            thinkTime: 0.3
        },
        'drop': {
            loginAttempts: 1,
            operationsCount: 2,
            delayBetweenAttempts: 0.3,
            thinkTime: 1
        },
        'recovery': {
            loginAttempts: 1,
            operationsCount: 2,
            delayBetweenAttempts: 0.5,
            thinkTime: 2
        }
    };

    return intensities[phase] || intensities['baseline'];
}

export function setup() {
    console.log('⚡ Starting WeSign Spike Test - Login Endpoint');
    console.log(`📍 Base URL: ${baseUrl}`);
    console.log(`📈 Spike Pattern: 1 → 200 → 1 VUs`);
    console.log(`⏱️ Duration: 5 minutes`);
    console.log(`🎯 Testing sudden load on login endpoint`);
    console.log(`⚠️ Expect temporary performance degradation during spike`);

    // Pre-test validation
    console.log('🔍 Pre-test system check...');
    const preTestSession = new AuthSession(baseUrl, credentials);
    const preTestAuth = preTestSession.authenticate();

    if (preTestAuth.success) {
        console.log('✅ Pre-test authentication successful');
        preTestSession.logout();
    } else {
        console.warn('⚠️ Pre-test authentication failed - system may already be under load');
    }

    return {
        startTime: Date.now(),
        testType: 'login_spike',
        preTestStatus: preTestAuth.success
    };
}

export function teardown(data) {
    const duration = (Date.now() - data.startTime) / 1000;
    console.log('🏁 Login Spike Test Completed');
    console.log(`⏱️ Total duration: ${duration.toFixed(2)} seconds`);
    console.log(`📊 Review login performance during spike and recovery`);

    // Post-test validation
    console.log('🔍 Post-test system check...');
    const postTestSession = new AuthSession(baseUrl, credentials);
    const postTestAuth = postTestSession.authenticate();

    if (postTestAuth.success) {
        console.log('✅ Post-test authentication successful - system recovered');
        postTestSession.logout();
    } else {
        console.warn('⚠️ Post-test authentication failed - system may need more recovery time');
    }

    console.log(`📈 Pre-test status: ${data.preTestStatus ? 'OK' : 'FAIL'}`);
    console.log(`📈 Post-test status: ${postTestAuth.success ? 'OK' : 'FAIL'}`);
}