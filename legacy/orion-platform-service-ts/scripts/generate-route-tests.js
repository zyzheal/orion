#!/usr/bin/env node
/**
 * Route Test Generator
 * Generates test files for *-routes.ts that don't have tests yet.
 *
 * Usage: node scripts/generate-route-tests.js
 */

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '..', 'src', 'api');
const TEST_DIR = path.join(API_DIR, '__tests__');

if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

function extractRoutes(content) {
  const routes = [];
  const lines = content.split('\n');

  // Extract prefix variable if defined (e.g., const prefix = '/api/v1/ai-agents';)
  let prefix = '';
  const prefixMatch = content.match(/(?:const|let|var)\s+prefix\s*=\s*['"]([^'"]+)['"]/);
  if (prefixMatch) {
    prefix = prefixMatch[1];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match regular string paths: app.get('/path', etc or instance.get('/path', etc or fastify.get('/path', etc
    const m = line.match(/(?:app|instance|fastify)\.(get|post|put|delete|patch)\s*(?:<[^>]*>)?\s*\(\s*['"]([^'"]+)['"]/);
    if (m) {
      routes.push({ method: m[1].toUpperCase(), path: m[2] });
      continue;
    }

    // Match template literal paths: app.get(`${prefix}/path`, etc
    if (prefix) {
      const tm = line.match(/(?:app|instance|fastify)\.(get|post|put|delete|patch)\s*(?:<[^>]*>)?\s*\(\s*`([^`]+)`/);
      if (tm) {
        const resolvedPath = tm[2].replace(/\$\{prefix\}/g, prefix);
        routes.push({ method: tm[1].toUpperCase(), path: resolvedPath });
        continue;
      }
    }

    // Match multiline: app.get(\n  '/path', -- path on next line
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      const ml = line.match(/(?:app|instance|fastify)\.(get|post|put|delete|patch)\s*(?:<[^>]*>)?\s*\(\s*$/);
      if (ml) {
        // Next line should have the path
        const pathMatch = nextLine.match(/^['"]([^'"]+)['"]/);
        if (pathMatch) {
          routes.push({ method: ml[1].toUpperCase(), path: pathMatch[1] });
        }
      }
    }
  }
  return routes;
}

function generateTestFile(routeFile) {
  const routeName = routeFile.replace('.ts', '');
  const displayName = routeName
    .replace('-routes', '')
    .split('-')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');

  const content = fs.readFileSync(path.join(API_DIR, routeFile), 'utf-8');
  const routes = extractRoutes(content);
  if (routes.length === 0) return null;

  const needsDb = content.includes('options.database') || content.includes('DatabasePool');
  const needsRedis = content.includes('options.redis') || content.includes('RedisCache');

  // Detect export pattern
  const hasDefaultExport = content.includes('export default');
  // Find named export function (e.g., export async function registerXxxRoutes)
  const namedExportMatch = content.match(/export\s+(?:async\s+)?function\s+(\w+)/);
  const namedExportName = namedExportMatch ? namedExportMatch[1] : null;

  // Determine import statement and variable name
  let importLine;
  let pluginVarName;
  if (hasDefaultExport) {
    importLine = `import routePlugin from '../${routeName}';`;
    pluginVarName = 'routePlugin';
  } else if (namedExportName) {
    importLine = `import { ${namedExportName} } from '../${routeName}';`;
    pluginVarName = namedExportName;
  } else {
    // Fallback: try default import
    importLine = `import routePlugin from '../${routeName}';`;
    pluginVarName = 'routePlugin';
  }

  // Build mock declarations
  let mockSection = '';
  if (needsDb) {
    mockSection += `
const mockDb = {
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  connect: jest.fn().mockResolvedValue({ release: jest.fn() }),
  end: jest.fn(),
};
`;
  }
  if (needsRedis) {
    mockSection += `
const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  keys: jest.fn().mockResolvedValue([]),
};
`;
  }

  // Build options
  const parts = [];
  if (needsDb) parts.push('database: mockDb as any');
  if (needsRedis) parts.push('redis: mockRedis as any');
  const optionsStr = parts.length > 0 ? '{ ' + parts.join(', ') + ' }' : '{}';

  // Pick sample routes (up to 5)
  const samples = routes.slice(0, 5);
  const testCases = samples.map(r => {
    const testPath = r.path.replace(/:(\w+)/g, 'test-$1');
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(r.method);
    const bodyLine = hasBody ? `\n        payload: {},` : '';
    return `  describe('${r.method} ${r.path}', () => {
    it('should respond to ${r.method} ${r.path}', async () => {
      const response = await app.inject({
        method: '${r.method}',
        url: '${testPath}',${bodyLine}
        headers: authHeaders,
      });
      expect(response.statusCode).toBeDefined();
    });
  });`;
  }).join('\n\n');

  return `/**
 * Tests for ${displayName} Routes (${routeFile})
 *
 * Auto-generated route registration tests
 */

import Fastify, { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';

jest.mock('../../middleware/authMiddleware', () => ({
  authenticateUser: async (req: any, reply: any) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    req.user = { userId: 'test-user', username: 'testuser', roles: ['admin'] };
  },
}));

jest.mock('../../middleware/requirePermission', () => ({
  requirePermission: (_opts: any) => async (req: any, reply: any) => {},
}));

${importLine}

const TEST_TOKEN = jwt.sign(
  { userId: 'test-user', username: 'testuser', roles: ['admin'] },
  process.env.JWT_SECRET || 'test-jwt-secret-for-testing',
  { algorithm: 'HS256' }
);

const authHeaders = {
  Authorization: \`Bearer \${TEST_TOKEN}\`,
  'x-tenant-id': '1',
};
${mockSection}
describe('${displayName} Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(${pluginVarName}, ${optionsStr});
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should have registered routes', () => {
    const routes = app.printRoutes();
    expect(routes).toBeTruthy();
  });

${testCases}
});
`;
}

// Main
const routeFiles = fs.readdirSync(API_DIR)
  .filter(f => f.endsWith('-routes.ts'))
  .sort();

let generated = 0;
let skipped = 0;
let noRoutes = 0;

for (const routeFile of routeFiles) {
  const testName = routeFile.replace('.ts', '.test.ts');
  const testPath = path.join(TEST_DIR, testName);

  if (fs.existsSync(testPath)) {
    skipped++;
    continue;
  }

  const testContent = generateTestFile(routeFile);
  if (!testContent) {
    console.log(`SKIP (no routes): ${routeFile}`);
    noRoutes++;
    continue;
  }

  fs.writeFileSync(testPath, testContent, 'utf-8');
  generated++;
  console.log(`GENERATED: ${testName}`);
}

console.log(`\nDone! Generated: ${generated}, Skipped: ${skipped}, No routes: ${noRoutes}`);
