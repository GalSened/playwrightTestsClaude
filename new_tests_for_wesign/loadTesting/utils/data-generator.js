/**
 * Test data generation utilities for WeSign load tests
 *
 * Provides functions to generate realistic test data for various
 * WeSign entities including users, documents, templates, etc.
 */

import { randomString, randomIntBetween, randomItem } from 'k6';

/**
 * Generate unique timestamp-based identifiers
 */
export function generateTimestamp() {
    return Date.now().toString();
}

export function generateUniqueId(prefix = 'test') {
    return `${prefix}_${generateTimestamp()}_${randomString(6)}`;
}

/**
 * User data generation
 */
export function generateUser(overrides = {}) {
    const timestamp = generateTimestamp();
    const randomSuffix = randomString(6);

    return {
        email: `test.user.${timestamp}.${randomSuffix}@loadtest.com`,
        password: 'LoadTest123!',
        firstName: randomItem(['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emma', 'Chris', 'Lisa']),
        lastName: randomItem(['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis']),
        company: randomItem(['LoadTest Corp', 'Test Industries', 'QA Solutions', 'Performance Labs']),
        phone: `+1-555-${randomIntBetween(100, 999)}-${randomIntBetween(1000, 9999)}`,
        ...overrides
    };
}

export function generateCredentials() {
    return {
        email: 'nirk@comsign.co.il',
        password: 'Comsign1!'
    };
}

/**
 * Contact data generation
 */
export function generateContact(overrides = {}) {
    const timestamp = generateTimestamp();

    return {
        firstName: randomItem(['Alex', 'Morgan', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Avery', 'Quinn']),
        lastName: randomItem(['Anderson', 'Clark', 'Lewis', 'Walker', 'Hall', 'Allen', 'Young', 'King']),
        email: `contact.${timestamp}.${randomString(4)}@example.com`,
        phone: `+1-${randomIntBetween(200, 999)}-${randomIntBetween(100, 999)}-${randomIntBetween(1000, 9999)}`,
        company: randomItem(['ABC Corp', 'XYZ Ltd', 'Tech Solutions', 'Global Systems', 'Digital Works']),
        position: randomItem(['Manager', 'Director', 'Coordinator', 'Specialist', 'Analyst', 'Executive']),
        notes: `Load test contact created at ${new Date().toISOString()}`,
        ...overrides
    };
}

/**
 * Document data generation
 */
export function generateDocument(overrides = {}) {
    const timestamp = generateTimestamp();

    return {
        name: `LoadTest_Document_${timestamp}.pdf`,
        description: `Load testing document created at ${new Date().toISOString()}`,
        type: randomItem(['contract', 'agreement', 'proposal', 'invoice', 'report']),
        category: randomItem(['legal', 'financial', 'operational', 'administrative']),
        tags: [
            randomItem(['urgent', 'important', 'review', 'approval']),
            randomItem(['confidential', 'public', 'internal', 'external']),
            'loadtest'
        ],
        ...overrides
    };
}

/**
 * Template data generation
 */
export function generateTemplate(overrides = {}) {
    const timestamp = generateTimestamp();

    return {
        name: `LoadTest_Template_${timestamp}`,
        description: `Load testing template created at ${new Date().toISOString()}`,
        category: randomItem(['contract', 'agreement', 'form', 'report', 'letter']),
        type: randomItem(['standard', 'custom', 'premium', 'basic']),
        tags: ['loadtest', randomItem(['business', 'legal', 'hr', 'finance'])],
        isPublic: randomItem([true, false]),
        ...overrides
    };
}

/**
 * Distribution data generation
 */
export function generateDistribution(documentId = null, contacts = [], overrides = {}) {
    const timestamp = generateTimestamp();

    return {
        name: `LoadTest_Distribution_${timestamp}`,
        description: `Load testing distribution created at ${new Date().toISOString()}`,
        documentId: documentId || generateUniqueId('doc'),
        recipients: contacts.length > 0 ? contacts : [
            { email: `recipient1.${timestamp}@example.com`, role: 'signer' },
            { email: `recipient2.${timestamp}@example.com`, role: 'viewer' }
        ],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        priority: randomItem(['low', 'medium', 'high']),
        ...overrides
    };
}

/**
 * Link data generation
 */
export function generateLink(overrides = {}) {
    const timestamp = generateTimestamp();

    return {
        name: `LoadTest_Link_${timestamp}`,
        url: `https://example.com/loadtest/${timestamp}`,
        description: `Load testing link created at ${new Date().toISOString()}`,
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        accessLevel: randomItem(['public', 'private', 'restricted']),
        ...overrides
    };
}

/**
 * Configuration data generation
 */
export function generateConfiguration(overrides = {}) {
    return {
        notificationSettings: {
            emailNotifications: randomItem([true, false]),
            smsNotifications: randomItem([true, false]),
            pushNotifications: randomItem([true, false])
        },
        defaultSignatureSettings: {
            signatureType: randomItem(['draw', 'type', 'upload']),
            requireInitials: randomItem([true, false]),
            timestampSignatures: randomItem([true, false])
        },
        documentSettings: {
            autoSave: randomItem([true, false]),
            compressionLevel: randomItem(['low', 'medium', 'high']),
            watermarkEnabled: randomItem([true, false])
        },
        ...overrides
    };
}

/**
 * Tablet data generation
 */
export function generateTablet(overrides = {}) {
    const timestamp = generateTimestamp();

    return {
        deviceName: `LoadTest_Tablet_${timestamp}`,
        deviceId: generateUniqueId('tablet'),
        model: randomItem(['iPad Pro', 'Samsung Galaxy Tab', 'Surface Pro', 'iPad Air']),
        osVersion: randomItem(['iOS 15.0', 'Android 12', 'Windows 11', 'iPadOS 15.1']),
        appVersion: '2.1.0',
        location: randomItem(['Office A', 'Conference Room B', 'Reception', 'Meeting Room C']),
        status: randomItem(['active', 'inactive', 'maintenance']),
        ...overrides
    };
}

/**
 * File data simulation
 */
export function generateFileData(size = 'small') {
    const sizes = {
        small: 1024,        // 1KB
        medium: 102400,     // 100KB
        large: 1048576,     // 1MB
        xlarge: 10485760    // 10MB
    };

    const fileSize = sizes[size] || sizes.small;

    // Generate random base64-like data for file simulation
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    for (let i = 0; i < Math.min(fileSize / 4, 1000); i++) { // Limit to prevent memory issues
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return {
        data: result,
        size: fileSize,
        mimeType: 'application/pdf',
        fileName: `loadtest_file_${generateTimestamp()}.pdf`
    };
}

/**
 * Signature data generation
 */
export function generateSignatureData(overrides = {}) {
    return {
        signatureType: randomItem(['draw', 'type', 'upload']),
        signatureData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // 1x1 transparent PNG
        timestamp: new Date().toISOString(),
        ipAddress: `192.168.1.${randomIntBetween(1, 254)}`,
        userAgent: 'K6LoadTest/1.0',
        ...overrides
    };
}

/**
 * Bulk data generation
 */
export function generateBulkContacts(count = 10) {
    const contacts = [];
    for (let i = 0; i < count; i++) {
        contacts.push(generateContact({ batchId: generateTimestamp(), index: i }));
    }
    return contacts;
}

export function generateBulkDocuments(count = 5) {
    const documents = [];
    for (let i = 0; i < count; i++) {
        documents.push(generateDocument({ batchId: generateTimestamp(), index: i }));
    }
    return documents;
}

export function generateBulkTemplates(count = 3) {
    const templates = [];
    for (let i = 0; i < count; i++) {
        templates.push(generateTemplate({ batchId: generateTimestamp(), index: i }));
    }
    return templates;
}

/**
 * Test scenario data
 */
export function generateUserJourneyData() {
    const user = generateUser();
    const contacts = generateBulkContacts(3);
    const templates = generateBulkTemplates(2);
    const documents = generateBulkDocuments(2);

    return {
        user,
        contacts,
        templates,
        documents,
        sessionId: generateUniqueId('session'),
        startTime: new Date().toISOString()
    };
}

/**
 * Random data helpers
 */
export function getRandomEmail() {
    return `loadtest.${generateTimestamp()}.${randomString(6)}@example.com`;
}

export function getRandomPhoneNumber() {
    return `+1-${randomIntBetween(200, 999)}-${randomIntBetween(100, 999)}-${randomIntBetween(1000, 9999)}`;
}

export function getRandomCompanyName() {
    const prefixes = ['Global', 'Dynamic', 'Innovative', 'Advanced', 'Smart', 'Digital', 'Modern', 'Elite'];
    const suffixes = ['Solutions', 'Systems', 'Technologies', 'Corp', 'Industries', 'Group', 'Labs', 'Works'];

    return `${randomItem(prefixes)} ${randomItem(suffixes)}`;
}

export function getRandomText(wordCount = 10) {
    const words = [
        'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
        'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
        'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud'
    ];

    let result = [];
    for (let i = 0; i < wordCount; i++) {
        result.push(randomItem(words));
    }

    return result.join(' ');
}

export default {
    generateTimestamp,
    generateUniqueId,
    generateUser,
    generateCredentials,
    generateContact,
    generateDocument,
    generateTemplate,
    generateDistribution,
    generateLink,
    generateConfiguration,
    generateTablet,
    generateFileData,
    generateSignatureData,
    generateBulkContacts,
    generateBulkDocuments,
    generateBulkTemplates,
    generateUserJourneyData,
    getRandomEmail,
    getRandomPhoneNumber,
    getRandomCompanyName,
    getRandomText
};