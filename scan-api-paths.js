#!/usr/bin/env node
/**
 * Scan frontend API client files for bare paths (missing /v1/ prefix)
 * and output the list of files and paths that need fixing.
 */

const fs = require('fs');
const path = require('path');

const apiDir = '/Users/heal/orion-design/orion-frontend/src/api';
const files = fs.readdirSync(apiDir).filter(f => f.endsWith('.ts') && f !== 'client.ts' && f !== 'types.ts');

const specialPaths = ['/', '/api/test-reports', '/api/test-reports/upload', '/api'];

for (const file of files) {
  const content = fs.readFileSync(path.join(apiDir, file), 'utf-8');

  // Find all URL arguments in api.get/post/put/delete/patch calls
  // Match patterns like: api.xxx>('/path' or api.xxx>("path" or api.xxx>(`path`
  const urlPattern = /api\.(get|post|put|delete|patch)<[^>]*>\s*\(\s*['"`]([^'"`]+)['"`]/g;

  let match;
  const barePaths = [];
  while ((match = urlPattern.exec(content)) !== null) {
    const url = match[2];
    // Skip if already has /v1/ or /api/v1/ prefix
    if (url.startsWith('/v1/') || url.startsWith('/api/v1/')) continue;
    // Skip special paths
    if (specialPaths.some(sp => url === sp || url.startsWith(sp + '/'))) continue;
    // Skip root path
    if (url === '/') continue;
    // This is a bare path that needs /v1/ prefix
    barePaths.push(url);
  }

  if (barePaths.length > 0) {
    console.log(`${file}: ${barePaths.join(', ')}`);
  }
}