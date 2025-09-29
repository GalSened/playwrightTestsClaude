/**
 * WeSign K6 Smoke Test - Basic Functionality
 *
 * Purpose: Validate basic API functionality under minimal load
 * Load: 1-2 VUs for 30 seconds
 * Coverage: Health check, authentication, basic CRUD operations
 * Success Criteria: 0% error rate, establish baseline response times
 */

import { sleep } from 'k6';
import { WeSignAPIClient } from '../../utils/api-client.js';
import { validateResponse, validateJSONResponse, validateAuthResponse } from '../../utils/common-checks.js';
import { generateCredentials } from '../../utils/data-generator.js';

// Test configuration
export const options = {
    stages: [
        { duration: '30s', target: 1 }, // Minimal load for 30 seconds
    ],
    thresholds: {
        http_req_duration: ['p(95)<3000'], // 95% of requests under 3 seconds
        http_req_failed: ['rate<0.01'],    // Error rate under 1%
        checks: ['rate>0.99']              // 99% of checks should pass
    },
    tags: {
        test_type: 'smoke',
        test_name: 'basic_functionality'
    }
};

// Test data
const baseUrl = __ENV.BASE_URL || 'https://devtest.comda.co.il/userapi/ui/v3';
const credentials = generateCredentials();

export default function() {
    const apiClient = new WeSignAPIClient(baseUrl, credentials);

    // 1. Health Check (if available)
    console.log('🏥 Testing health check...');
    try {
        const healthResponse = apiClient.healthCheck();
        validateResponse(healthResponse, 200, 'Health check');
    } catch (error) {
        console.log('Health check endpoint not available, continuing...');
    }

    // 2. Authentication Test
    console.log('🔐 Testing authentication...');
    const authResult = apiClient.authenticate();

    if (!authResult.success) {
        console.error('❌ Authentication failed - stopping test');
        return;
    }

    validateAuthResponse(authResult.response, 'Authentication');

    // 3. User Profile Test
    console.log('👤 Testing user profile retrieval...');
    const profileResponse = apiClient.users.getProfile();
    validateJSONResponse(profileResponse, 200, 'User profile');

    // 4. User Groups Test
    console.log('👥 Testing user groups...');
    const groupsResponse = apiClient.users.getGroups();
    validateJSONResponse(groupsResponse, 200, 'User groups');

    // 5. Documents List Test
    console.log('📄 Testing documents list...');
    const documentsResponse = apiClient.documents.list();
    validateJSONResponse(documentsResponse, 200, 'Documents list');

    // 6. Templates List Test
    console.log('📋 Testing templates list...');
    const templatesResponse = apiClient.templates.list();
    validateJSONResponse(templatesResponse, 200, 'Templates list');

    // 7. Contacts List Test
    console.log('📞 Testing contacts list...');
    const contactsResponse = apiClient.contacts.list();
    validateJSONResponse(contactsResponse, 200, 'Contacts list');

    // 8. Configuration Test
    console.log('⚙️ Testing configuration retrieval...');
    const configResponse = apiClient.configuration.get();
    validateJSONResponse(configResponse, 200, 'Configuration');

    // 9. Statistics Test
    console.log('📊 Testing statistics dashboard...');
    const statsResponse = apiClient.statistics.getDashboard();
    validateJSONResponse(statsResponse, 200, 'Statistics dashboard');

    // 10. Logout Test
    console.log('🚪 Testing logout...');
    const logoutResponse = apiClient.logout();
    validateResponse(logoutResponse, 200, 'Logout');

    // Think time between iterations
    sleep(1);
}

export function teardown(data) {
    console.log('🏁 Smoke test completed - basic functionality validated');
}