/**
 * Subresource Integrity (SRI) Helper
 * 
 * This module provides utilities for generating and validating SRI hashes
 * for external resources. Use this when adding any external scripts or 
 * stylesheets from CDNs.
 * 
 * Usage:
 *   1. Generate hash: node helpers/sri.js generate <url>
 *   2. Validate hash: node helpers/sri.js validate <url> <expected-hash>
 * 
 * Example:
 *   node helpers/sri.js generate https://cdn.example.com/lib.js
 *   
 *   Output: sha384-abc123...
 *   
 *   Then add to HTML:
 *   <script src="https://cdn.example.com/lib.js" 
 *           integrity="sha384-abc123..." 
 *           crossorigin="anonymous"></script>
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');

/**
 * Fetch content from a URL
 * @param {string} url - URL to fetch
 * @returns {Promise<Buffer>} - Content as buffer
 */
function fetchContent(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // Follow redirect
        return fetchContent(response.headers.location).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
      }
      
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Generate SRI hash for content
 * @param {Buffer|string} content - Content to hash
 * @param {string} algorithm - Hash algorithm (sha256, sha384, sha512)
 * @returns {string} - SRI hash string (e.g., "sha384-abc123...")
 */
function generateHash(content, algorithm = 'sha384') {
  const hash = crypto.createHash(algorithm);
  hash.update(content);
  const base64 = hash.digest('base64');
  return `${algorithm}-${base64}`;
}

/**
 * Generate SRI hash for a URL
 * @param {string} url - URL to fetch and hash
 * @param {string} algorithm - Hash algorithm
 * @returns {Promise<string>} - SRI hash string
 */
async function generateHashForUrl(url, algorithm = 'sha384') {
  const content = await fetchContent(url);
  return generateHash(content, algorithm);
}

/**
 * Validate SRI hash for a URL
 * @param {string} url - URL to fetch
 * @param {string} expectedHash - Expected SRI hash
 * @returns {Promise<boolean>} - True if hash matches
 */
async function validateHash(url, expectedHash) {
  const [algorithm] = expectedHash.split('-');
  const actualHash = await generateHashForUrl(url, algorithm);
  return actualHash === expectedHash;
}

/**
 * Generate multiple SRI hashes (for fallback support)
 * @param {string} url - URL to fetch and hash
 * @returns {Promise<object>} - Object with sha256, sha384, sha512 hashes
 */
async function generateMultipleHashes(url) {
  const content = await fetchContent(url);
  return {
    sha256: generateHash(content, 'sha256'),
    sha384: generateHash(content, 'sha384'),
    sha512: generateHash(content, 'sha512'),
  };
}

// CLI interface
if (require.main === module) {
  const [,, command, ...args] = process.argv;
  
  switch (command) {
    case 'generate':
      if (!args[0]) {
        console.error('Usage: node sri.js generate <url> [algorithm]');
        process.exit(1);
      }
      generateHashForUrl(args[0], args[1] || 'sha384')
        .then(hash => {
          console.log('\nSRI Hash:');
          console.log(hash);
          console.log('\nHTML Example:');
          console.log(`<script src="${args[0]}" integrity="${hash}" crossorigin="anonymous"></script>`);
        })
        .catch(err => {
          console.error('Error:', err.message);
          process.exit(1);
        });
      break;
      
    case 'generate-all':
      if (!args[0]) {
        console.error('Usage: node sri.js generate-all <url>');
        process.exit(1);
      }
      generateMultipleHashes(args[0])
        .then(hashes => {
          console.log('\nSRI Hashes:');
          console.log('SHA-256:', hashes.sha256);
          console.log('SHA-384:', hashes.sha384);
          console.log('SHA-512:', hashes.sha512);
        })
        .catch(err => {
          console.error('Error:', err.message);
          process.exit(1);
        });
      break;
      
    case 'validate':
      if (!args[0] || !args[1]) {
        console.error('Usage: node sri.js validate <url> <expected-hash>');
        process.exit(1);
      }
      validateHash(args[0], args[1])
        .then(valid => {
          if (valid) {
            console.log('✅ Hash is valid');
          } else {
            console.log('❌ Hash does NOT match');
            process.exit(1);
          }
        })
        .catch(err => {
          console.error('Error:', err.message);
          process.exit(1);
        });
      break;
      
    default:
      console.log('SRI (Subresource Integrity) Helper\n');
      console.log('Commands:');
      console.log('  generate <url> [algorithm]  Generate SRI hash for a URL');
      console.log('  generate-all <url>          Generate all hash algorithms');
      console.log('  validate <url> <hash>       Validate a URL against expected hash');
      console.log('\nAlgorithms: sha256, sha384 (default), sha512');
  }
}

module.exports = {
  generateHash,
  generateHashForUrl,
  validateHash,
  generateMultipleHashes,
};
