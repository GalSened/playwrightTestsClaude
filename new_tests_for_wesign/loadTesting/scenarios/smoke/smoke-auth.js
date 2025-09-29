/**
 * WeSign K6 Smoke Test - Authentication Focus
 *
 * Purpose: Validate authentication flows under minimal load
 * Load: 2 VUs for 60 seconds
 * Coverage: Login, token refresh, authenticated requests, logout
 * Success Criteria: 0% auth failures, consistent token handling
 */

import { sleep } from 'k6';
import { AuthSession } from '../../utils/auth-helper.js';
import { validateAuthResponse, validateJSONResponse } from '../../utils/common-checks.js';
import { generateCredentials } from '../../utils/data-generator.js';

// Test configuration
export const options = {
    stages: [
        { duration: '60s', target: 2 }, // 2 VUs for 60 seconds
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'],           // 95% under 2s
        'http_req_duration{endpoint:/users/login}': ['p(99)<1000'], // Login under 1s
        http_req_failed: ['rate<0.01'],              // Error rate under 1%
        auth_success_rate: ['rate>0.99'],            // 99% auth success
        checks: ['rate>0.99']                        // 99% checks pass
    },
    tags: {
        test_type: 'smoke',
        test_name: 'authentication_focus'
    }
};

// Test data
const baseUrl = __ENV.BASE_URL || 'https://devtest.comda.co.il/userapi/ui/v3';
const credentials = generateCredentials();

export default function() {
    const vuId = __VU;
    const iterationId = __ITER;

    console.log(`🔐 VU${vuId} Iteration${iterationId}: Starting authentication smoke test`);

    // Initialize authentication session
    const authSession = new AuthSession(baseUrl, credentials);

    // 1. Initial Authentication
    console.log(`👤 VU${vuId}: Testing initial authentication...`);
    const authResult = authSession.authenticate();

    if (!authResult.success) {
        console.error(`❌ VU${vuId}: Initial authentication failed`);
        return;
    }

    validateAuthResponse(authResult.response, 'Initial authentication');

    // 2. Test authenticated request
    console.log(`📊 VU${vuId}: Testing authenticated request...`);
    const apiClient = authSession.getAPIClient();
    const profileResponse = apiClient.users.getProfile();
    validateJSONResponse(profileResponse, 200, 'Authenticated profile request');

    // 3. Test another authenticated endpoint
    console.log(`📄 VU${vuId}: Testing another authenticated endpoint...`);
    const documentsResponse = apiClient.documents.list();
    validateJSONResponse(documentsResponse, 200, 'Authenticated documents list');

    // 4. Test token refresh functionality
    console.log(`🔄 VU${vuId}: Testing token refresh...`);
    const refreshResult = authSession.refreshToken();

    if (refreshResult.success) {
        console.log(`✅ VU${vuId}: Token refresh successful`);

        // Test request after token refresh
        const postRefreshResponse = apiClient.users.getProfile();
        validateJSONResponse(postRefreshResponse, 200, 'Post-refresh profile request');
    } else {
        console.log(`⚠️ VU${vuId}: Token refresh failed or not needed`);
    }

    // 5. Test multiple authenticated requests
    console.log(`📋 VU${vuId}: Testing multiple authenticated requests...`);

    const endpoints = [
        { name: 'Templates', method: () => apiClient.templates.list() },
        { name: 'Contacts', method: () => apiClient.contacts.list() },
        { name: 'Configuration', method: () => apiClient.configuration.get() }
    ];

    for (const endpoint of endpoints) {
        const response = endpoint.method();
        validateJSONResponse(response, 200, `${endpoint.name} authenticated request`);
        sleep(0.1); // Small delay between requests
    }

    // 6. Test session status
    console.log(`📋 VU${vuId}: Checking session status...`);
    const sessionStatus = authSession.getAuthStatus();

    if (!sessionStatus.isAuthenticated) {
        console.error(`❌ VU${vuId}: Session status shows not authenticated`);
    } else {
        console.log(`✅ VU${vuId}: Session status is valid`);
    }

    // 7. Test logout
    console.log(`🚪 VU${vuId}: Testing logout...`);
    const logoutResult = authSession.logout();

    if (logoutResult.success) {
        console.log(`✅ VU${vuId}: Logout successful`);
    } else {
        console.error(`❌ VU${vuId}: Logout failed`);
    }

    // 8. Verify session is cleared after logout
    const postLogoutStatus = authSession.getAuthStatus();
    if (postLogoutStatus.isAuthenticated) {
        console.error(`❌ VU${vuId}: Session still shows authenticated after logout`);
    } else {
        console.log(`✅ VU${vuId}: Session properly cleared after logout`);
    }

    // Think time between iterations
    sleep(1 + Math.random() * 2); // 1-3 seconds random think time
}

export function setup() {
    console.log('🚀 Starting WeSign Authentication Smoke Test');
    console.log(`📍 Base URL: ${baseUrl}`);
    console.log(`👥 Target VUs: 2`);
    console.log(`⏱️ Duration: 60 seconds`);
    return { startTime: Date.now() };
}

export function teardown(data) {
    const duration = (Date.now() - data.startTime) / 1000;
    console.log('🏁 Authentication smoke test completed');
    console.log(`⏱️ Total test duration: ${duration.toFixed(2)} seconds`);
}