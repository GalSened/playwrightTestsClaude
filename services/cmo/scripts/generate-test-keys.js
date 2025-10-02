/**
 * Generate RSA test keys for A2A JWT testing
 * Run with: node scripts/generate-test-keys.js
 */

import { generateKeyPairSync } from 'crypto';

// Generate 2048-bit RSA key pair
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs1',
    format: 'pem'
  }
});

console.log('=== RSA TEST KEYS (2048-bit) ===\n');
console.log('Private Key:');
console.log(privateKey);
console.log('\nPublic Key:');
console.log(publicKey);
console.log('\n=== Copy these into test/utils/fakeJwt.ts ===');
