/**
 * WeSign K6 Configuration Module
 *
 * Centralized configuration management for K6 load testing
 * Supports environment-specific settings and test profiles
 */

import environments from './environments.json';
import testProfiles from './test-profiles.json';

/**
 * Get environment configuration
 * @param {string} envName - Environment name (dev, staging, prod)
 * @returns {object} Environment configuration
 */
export function getEnvironmentConfig(envName = 'dev') {
    const env = environments.environments[envName];
    if (!env) {
        throw new Error(`Unknown environment: ${envName}. Available: ${Object.keys(environments.environments).join(', ')}`);
    }

    return {
        ...env,
        ...environments.common,
        environmentName: envName
    };
}

/**
 * Get test profile configuration
 * @param {string} profileName - Test profile name (smoke, load, stress, etc.)
 * @returns {object} Test profile configuration
 */
export function getTestProfile(profileName) {
    const profile = testProfiles.testProfiles[profileName];
    if (!profile) {
        throw new Error(`Unknown test profile: ${profileName}. Available: ${Object.keys(testProfiles.testProfiles).join(', ')}`);
    }

    return profile;
}

/**
 * Get scenario details
 * @param {string} scenarioName - Scenario name
 * @returns {object} Scenario details
 */
export function getScenarioDetails(scenarioName) {
    const scenario = testProfiles.scenarioDetails[scenarioName];
    if (!scenario) {
        throw new Error(`Unknown scenario: ${scenarioName}. Available: ${Object.keys(testProfiles.scenarioDetails).join(', ')}`);
    }

    return scenario;
}

/**
 * Build K6 options from environment and profile
 * @param {string} envName - Environment name
 * @param {string} profileName - Test profile name
 * @param {object} overrides - Optional configuration overrides
 * @returns {object} K6 options object
 */
export function buildK6Options(envName, profileName, overrides = {}) {
    const envConfig = getEnvironmentConfig(envName);
    const profile = getTestProfile(profileName);

    // Merge thresholds from environment and profile
    const thresholds = {
        ...envConfig.thresholds,
        ...profile.thresholds,
        ...overrides.thresholds
    };

    // Build base options
    const options = {
        userAgent: envConfig.userAgent,
        timeout: envConfig.timeouts.http_req_timeout,
        thresholds,
        tags: {
            environment: envName,
            profile: profileName,
            test_type: profileName,
            ...overrides.tags
        },
        ...overrides
    };

    return options;
}

/**
 * Get credentials for environment
 * @param {string} envName - Environment name
 * @param {string} credentialType - Credential type (default, admin, etc.)
 * @returns {object} Credentials object
 */
export function getCredentials(envName = 'dev', credentialType = 'default') {
    const envConfig = getEnvironmentConfig(envName);
    const credentials = envConfig.credentials[credentialType];

    if (!credentials) {
        throw new Error(`No ${credentialType} credentials found for environment ${envName}`);
    }

    return credentials;
}

/**
 * Validate environment limits
 * @param {string} envName - Environment name
 * @param {number} maxVUs - Maximum VUs to test
 * @param {string} duration - Test duration
 * @returns {boolean} True if within limits
 */
export function validateLimits(envName, maxVUs, duration) {
    const envConfig = getEnvironmentConfig(envName);
    const limits = envConfig.limits;

    if (maxVUs > limits.maxVUs) {
        throw new Error(`VU limit exceeded: ${maxVUs} > ${limits.maxVUs} for environment ${envName}`);
    }

    // Parse duration (simplified - could be enhanced)
    const durationMinutes = parseDuration(duration);
    const maxDurationMinutes = parseDuration(limits.maxDuration);

    if (durationMinutes > maxDurationMinutes) {
        throw new Error(`Duration limit exceeded: ${duration} > ${limits.maxDuration} for environment ${envName}`);
    }

    return true;
}

/**
 * Parse duration string to minutes
 * @param {string} duration - Duration string (e.g., "30m", "1h", "45s")
 * @returns {number} Duration in minutes
 */
function parseDuration(duration) {
    const match = duration.match(/^(\d+)([smh])$/);
    if (!match) {
        throw new Error(`Invalid duration format: ${duration}`);
    }

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit) {
        case 's': return num / 60;
        case 'm': return num;
        case 'h': return num * 60;
        default: throw new Error(`Unknown duration unit: ${unit}`);
    }
}

/**
 * Get formatted test configuration summary
 * @param {string} envName - Environment name
 * @param {string} profileName - Test profile name
 * @returns {string} Formatted summary
 */
export function getConfigSummary(envName, profileName) {
    const envConfig = getEnvironmentConfig(envName);
    const profile = getTestProfile(profileName);

    return `
🎯 WeSign K6 Load Test Configuration
=====================================
Environment: ${envConfig.name} (${envName})
Profile: ${profile.name}
Base URL: ${envConfig.baseUrl}
Target Load: ${profile.targetLoad.minVUs}-${profile.targetLoad.maxVUs} VUs
Duration: ${profile.targetLoad.duration}
Scenarios: ${profile.scenarios.join(', ')}
Frequency: ${profile.frequency}
`;
}

/**
 * Export environment and profile lists for CLI usage
 */
export const availableEnvironments = Object.keys(environments.environments);
export const availableProfiles = Object.keys(testProfiles.testProfiles);
export const availableScenarios = Object.keys(testProfiles.scenarioDetails);

// Default exports for convenience
export default {
    getEnvironmentConfig,
    getTestProfile,
    getScenarioDetails,
    buildK6Options,
    getCredentials,
    validateLimits,
    getConfigSummary,
    availableEnvironments,
    availableProfiles,
    availableScenarios
};