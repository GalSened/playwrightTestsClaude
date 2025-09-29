/**
 * Authentication helper utilities for WeSign K6 load tests
 *
 * Provides centralized authentication management, token handling,
 * and session management for load testing scenarios.
 */

import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';
import { WeSignAPIClient } from './api-client.js';
import { validateAuthResponse } from './common-checks.js';

// Authentication metrics
export const authSuccessRate = new Rate('auth_success_rate');
export const authAttempts = new Counter('auth_attempts');
export const tokenRefreshCount = new Counter('token_refresh_count');

/**
 * Authentication session manager
 */
export class AuthSession {
    constructor(baseUrl, credentials = {}) {
        this.apiClient = new WeSignAPIClient(baseUrl, credentials);
        this.isAuthenticated = false;
        this.lastAuthTime = null;
        this.tokenExpiryTime = null;
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
    }

    /**
     * Authenticate with retry logic
     */
    async authenticate(email = null, password = null) {
        authAttempts.add(1);

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const result = this.apiClient.authenticate(email, password);

                if (result.success) {
                    this.isAuthenticated = true;
                    this.lastAuthTime = Date.now();
                    // Assume token expires in 1 hour if not specified
                    this.tokenExpiryTime = Date.now() + (60 * 60 * 1000);

                    authSuccessRate.add(1);

                    console.log(`Authentication successful on attempt ${attempt}`);
                    return { success: true, response: result.response };
                } else {
                    console.log(`Authentication failed on attempt ${attempt}`);

                    if (attempt < this.maxRetries) {
                        console.log(`Retrying in ${this.retryDelay}ms...`);
                        sleep(this.retryDelay / 1000);
                    }
                }
            } catch (error) {
                console.log(`Authentication error on attempt ${attempt}: ${error}`);

                if (attempt < this.maxRetries) {
                    sleep(this.retryDelay / 1000);
                }
            }
        }

        authSuccessRate.add(0);
        this.isAuthenticated = false;
        return { success: false, error: 'Authentication failed after all retries' };
    }

    /**
     * Check if token needs refresh
     */
    needsTokenRefresh() {
        if (!this.isAuthenticated || !this.tokenExpiryTime) {
            return false;
        }

        // Refresh token 5 minutes before expiry
        const refreshThreshold = 5 * 60 * 1000; // 5 minutes
        return (Date.now() + refreshThreshold) >= this.tokenExpiryTime;
    }

    /**
     * Refresh authentication token
     */
    refreshToken() {
        if (!this.apiClient.refreshToken) {
            console.log('No refresh token available, re-authenticating...');
            return this.authenticate();
        }

        try {
            tokenRefreshCount.add(1);
            const response = this.apiClient.refreshAuthentication();

            if (response.status === 200) {
                this.tokenExpiryTime = Date.now() + (60 * 60 * 1000); // Reset expiry
                console.log('Token refreshed successfully');
                return { success: true, response };
            } else {
                console.log('Token refresh failed, re-authenticating...');
                return this.authenticate();
            }
        } catch (error) {
            console.log(`Token refresh error: ${error}`);
            return this.authenticate();
        }
    }

    /**
     * Ensure valid authentication before API calls
     */
    ensureAuthentication() {
        if (!this.isAuthenticated) {
            return this.authenticate();
        }

        if (this.needsTokenRefresh()) {
            return this.refreshToken();
        }

        return { success: true };
    }

    /**
     * Logout and cleanup
     */
    logout() {
        try {
            const response = this.apiClient.logout();
            this.isAuthenticated = false;
            this.lastAuthTime = null;
            this.tokenExpiryTime = null;

            return { success: response.status === 200, response };
        } catch (error) {
            console.log(`Logout error: ${error}`);
            return { success: false, error };
        }
    }

    /**
     * Get API client for making authenticated requests
     */
    getAPIClient() {
        return this.apiClient;
    }

    /**
     * Get authentication status
     */
    getAuthStatus() {
        return {
            isAuthenticated: this.isAuthenticated,
            lastAuthTime: this.lastAuthTime,
            tokenExpiryTime: this.tokenExpiryTime,
            needsRefresh: this.needsTokenRefresh()
        };
    }
}

/**
 * Quick authentication for simple scenarios
 */
export function quickAuth(baseUrl, credentials = {}) {
    const session = new AuthSession(baseUrl, credentials);
    const result = session.authenticate();

    if (result.success) {
        return session.getAPIClient();
    } else {
        throw new Error('Quick authentication failed');
    }
}

/**
 * Batch authentication for multiple users
 */
export function batchAuthenticate(baseUrl, userCredentials = []) {
    const sessions = [];
    const results = [];

    for (const creds of userCredentials) {
        const session = new AuthSession(baseUrl, creds);
        const result = session.authenticate(creds.email, creds.password);

        sessions.push(session);
        results.push({
            credentials: creds,
            session: session,
            success: result.success,
            response: result.response || result.error
        });
    }

    return {
        sessions,
        results,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length
    };
}

/**
 * Authentication stress testing helper
 */
export function authStressTest(baseUrl, credentials, iterations = 10) {
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < iterations; i++) {
        const session = new AuthSession(baseUrl, credentials);
        const startTime = Date.now();
        const result = session.authenticate();
        const duration = Date.now() - startTime;

        results.push({
            iteration: i + 1,
            success: result.success,
            duration: duration,
            timestamp: new Date().toISOString()
        });

        if (result.success) {
            successCount++;
            // Test logout as well
            session.logout();
        } else {
            failureCount++;
        }

        // Small delay between attempts
        sleep(0.1);
    }

    return {
        results,
        summary: {
            total: iterations,
            successful: successCount,
            failed: failureCount,
            successRate: (successCount / iterations) * 100,
            averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / iterations
        }
    };
}

/**
 * Token lifecycle testing
 */
export function testTokenLifecycle(baseUrl, credentials) {
    const session = new AuthSession(baseUrl, credentials);

    // Initial authentication
    console.log('Testing initial authentication...');
    const authResult = session.authenticate();

    if (!authResult.success) {
        return { success: false, stage: 'initial_auth', error: authResult.error };
    }

    // Test authenticated request
    console.log('Testing authenticated request...');
    const apiClient = session.getAPIClient();
    const profileResponse = apiClient.users.getProfile();

    const profileValid = check(profileResponse, {
        'Profile request successful': (r) => r.status === 200
    });

    if (!profileValid) {
        return { success: false, stage: 'authenticated_request', error: 'Profile request failed' };
    }

    // Test token refresh
    console.log('Testing token refresh...');
    const refreshResult = session.refreshToken();

    if (!refreshResult.success) {
        return { success: false, stage: 'token_refresh', error: refreshResult.error };
    }

    // Test request after refresh
    console.log('Testing request after token refresh...');
    const postRefreshResponse = apiClient.users.getProfile();

    const postRefreshValid = check(postRefreshResponse, {
        'Post-refresh request successful': (r) => r.status === 200
    });

    if (!postRefreshValid) {
        return { success: false, stage: 'post_refresh_request', error: 'Post-refresh request failed' };
    }

    // Test logout
    console.log('Testing logout...');
    const logoutResult = session.logout();

    if (!logoutResult.success) {
        return { success: false, stage: 'logout', error: logoutResult.error };
    }

    return { success: true, message: 'Token lifecycle test completed successfully' };
}

/**
 * Concurrent authentication testing
 */
export function concurrentAuthTest(baseUrl, credentials, concurrentUsers = 5) {
    const startTime = Date.now();
    const sessions = [];
    const promises = [];

    // Create concurrent authentication attempts
    for (let i = 0; i < concurrentUsers; i++) {
        const session = new AuthSession(baseUrl, credentials);
        sessions.push(session);

        // Simulate concurrent auth (in K6, this would be across VUs)
        const authPromise = new Promise((resolve) => {
            const result = session.authenticate();
            resolve({
                userId: i,
                success: result.success,
                duration: Date.now() - startTime,
                session: session
            });
        });

        promises.push(authPromise);
    }

    // In real K6 environment, this would be handled by the K6 runtime
    // For this implementation, we simulate the behavior
    const results = [];
    let completedCount = 0;

    for (const session of sessions) {
        const userStartTime = Date.now();
        const result = session.authenticate();
        const userDuration = Date.now() - userStartTime;

        results.push({
            userId: completedCount,
            success: result.success,
            duration: userDuration,
            session: session
        });

        completedCount++;
    }

    return {
        results,
        summary: {
            totalUsers: concurrentUsers,
            successfulAuths: results.filter(r => r.success).length,
            failedAuths: results.filter(r => !r.success).length,
            averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
            totalDuration: Date.now() - startTime
        }
    };
}

export default {
    AuthSession,
    quickAuth,
    batchAuthenticate,
    authStressTest,
    testTokenLifecycle,
    concurrentAuthTest,
    authSuccessRate,
    authAttempts,
    tokenRefreshCount
};