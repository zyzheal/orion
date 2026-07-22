#!/usr/bin/env npx tsx
/**
 * extract-api-contract.ts
 *
 * Scans Node.js Fastify route files and extracts OpenAPI 3.0 specs.
 *
 * Usage:
 *   npx tsx tools/migration/extract-api-contract.ts <routes-dir> --output <output-dir>
 *
 * Example:
 *   npx tsx tools/migration/extract-api-contract.ts orion-platform-service/src/api/ --output api-contracts/
 */

import * as fs from 'fs';
import * as path from 'path';

interface RouteInfo {
  method: string;
  url: string;
  handler: string;
  middlewares: string[];
  schema?: Record<string, unknown>;
}

interface OpenAPIPathItem {
  [method: string]: {
    operationId: string;
    summary?: string;
    tags: string[];
    parameters: Record<string, unknown>[];
    requestBody?: Record<string, unknown>;
    responses: Record<string, unknown>;
    security?: Record<string, string[]>[];
  };
}

function extractRoutes(filePath: string): RouteInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const routes: RouteInfo[] = [];

  // Match fastify route registrations:
  // fastify.get('/path', handler)
  // fastify.post('/path', { preHandler: [...] }, handler)
  // fastify.route({ method: 'GET', url: '/path', handler, preHandler: [...] })
  const routeRegex = /fastify\.(get|post|put|patch|delete|options|head)\(\s*['"`]([^'"`]+)['"`]/g;

  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const url = match[2];

    // Extract handler name from surrounding context
    const lineStart = content.lastIndexOf('\n', match.index) + 1;
    const lineEnd = content.indexOf('\n', match.index + match[0].length);
    const line = content.substring(lineStart, lineEnd > lineStart ? lineEnd : undefined);

    // Extract middleware from preHandler/onRequest
    const middlewares: string[] = [];
    const preHandlerMatch = line.match(/preHandler:\s*\[([^\]]*)\]/);
    if (preHandlerMatch) {
      const mwList = preHandlerMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
      middlewares.push(...mwList.filter(Boolean));
    }

    // Also check onRequest
    const onRequestMatch = line.match(/onRequest:\s*\[([^\]]*)\]/);
    if (onRequestMatch) {
      const mwList = onRequestMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
      middlewares.push(...mwList.filter(Boolean));
    }

    // Infer handler name from URL
    const handlerName = url
      .replace(/^\/api\/v\d+\/?/, '')
      .replace(/\//g, '_')
      .replace(/:[^/]+/g, 'by_param')
      .replace(/\?/g, '')
      .replace(/-/g, '_');

    routes.push({
      method,
      url,
      handler: handlerName,
      middlewares,
    });
  }

  // Also match fastify.route({ method: 'GET', url: '/path', ... })
  const objectRouteRegex = /fastify\.route\(\s*\{[\s\S]*?method:\s*['"](\w+)['"][\s\S]*?url:\s*['"]([^'"`]+)['"]/g;
  while ((match = objectRouteRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const url = match[2];

    const handlerName = url
      .replace(/^\/api\/v\d+\/?/, '')
      .replace(/\//g, '_')
      .replace(/:[^/]+/g, 'by_param')
      .replace(/\?/g, '')
      .replace(/-/g, '_');

    routes.push({
      method,
      url,
      handler: handlerName,
      middlewares: [],
    });
  }

  return routes;
}

function extractTypescriptInterfaces(filePath: string): Map<string, Record<string, unknown>> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const interfaces = new Map<string, Record<string, unknown>>();

  // Match: interface Foo { ... }
  const interfaceRegex = /export\s+interface\s+(\w+)\s*\{([\s\S]*?)\}/g;
  let match;
  while ((match = interfaceRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2];

    const properties: Record<string, unknown> = {};
    const propRegex = /(\w+)(\?)?:\s*([^;\n]+)/g;
    let propMatch;
    while ((propMatch = propRegex.exec(body)) !== null) {
      const propName = propMatch[1];
      const optional = propMatch[2] === '?';
      const typeStr = propMatch[3].trim().replace(/\s*;\s*$/, '');

      properties[propName] = {
        type: tsTypeToJSONSchema(typeStr),
        ...(optional ? {} : { required: true }),
      };
    }

    interfaces.set(name, {
      type: 'object',
      properties,
      required: Object.entries(properties)
        .filter(([, v]) => (v as Record<string, unknown>).required)
        .map(([k]) => k),
    });
  }

  return interfaces;
}

function tsTypeToJSONSchema(tsType: string): Record<string, unknown> {
  const typeMap: Record<string, Record<string, unknown>> = {
    string: { type: 'string' },
    number: { type: 'number' },
    integer: { type: 'integer' },
    boolean: { type: 'boolean' },
    'string[]': { type: 'array', items: { type: 'string' } },
    'number[]': { type: 'array', items: { type: 'number' } },
  };

  if (typeMap[tsType]) return typeMap[tsType];
  if (tsType.startsWith('Array<')) {
    const inner = tsType.replace('Array<', '').replace('>', '');
    return { type: 'array', items: tsTypeToJSONSchema(inner) };
  }
  if (tsType.endsWith('[]')) {
    const inner = tsType.replace('[]', '');
    return { type: 'array', items: tsTypeToJSONSchema(inner) };
  }
  if (tsType.includes('|')) {
    const variants = tsType.split('|').map(s => s.trim());
    return { oneOf: variants.map(tsTypeToJSONSchema) };
  }
  if (tsType.startsWith('{')) {
    return { type: 'object' };
  }

  // Reference to another interface
  return { $ref: `#/components/schemas/${tsType}` };
}

function routesToOpenAPI(
  fileName: string,
  routes: RouteInfo[],
  interfaces: Map<string, Record<string, unknown>>,
): Record<string, unknown> {
  const paths: Record<string, OpenAPIPathItem> = {};
  const tags = [fileName.replace('-routes.ts', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())];

  for (const route of routes) {
    if (!paths[route.url]) {
      paths[route.url] = {};
    }

    const methodLower = route.method.toLowerCase();
    const security: Record<string, string[]>[] = [];
    if (route.middlewares.some(m => m.includes('auth') || m.includes('authenticate'))) {
      security.push({ bearerAuth: [] });
    }

    const parameters: Record<string, unknown>[] = [];
    // Extract path parameters
    const paramRegex = /:(\w+)/g;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(route.url)) !== null) {
      parameters.push({
        name: paramMatch[1],
        in: 'path',
        required: true,
        schema: { type: 'string' },
      });
    }

    paths[route.url][methodLower] = {
      operationId: `${methodLower}_${route.handler}`,
      summary: `${route.method} ${route.url}`,
      tags,
      parameters,
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { data: {}, code: { type: 'number' }, message: { type: 'string' } } },
            },
          },
        },
        '400': { description: 'Bad request' },
        '401': { description: 'Unauthorized' },
        '403': { description: 'Forbidden' },
        '500': { description: 'Internal server error' },
      },
      ...(security.length > 0 ? { security } : {}),
    };
  }

  const components: Record<string, unknown> = {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {},
  };
  for (const [name, schema] of interfaces) {
    (components.schemas as Record<string, unknown>)[name] = schema;
  }

  return {
    openapi: '3.0.3',
    info: {
      title: `${tags[0]} API`,
      version: '1.0.0',
      description: `Auto-generated OpenAPI spec from ${fileName}`,
    },
    tags: [{ name: tags[0], description: `${tags[0]} endpoints` }],
    paths,
    components,
  };
}

function yamlStringify(obj: Record<string, unknown>): string {
  // Simple YAML serializer (for production, use js-yaml)
  return JSON.stringify(obj, null, 2)
    .replace(/"([^"]+)":/g, '$1:')
    .replace(/"/g, "'");
}

async function main() {
  const args = process.argv.slice(2);
  let routesDir = '';
  let outputDir = 'api-contracts';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && i + 1 < args.length) {
      outputDir = args[++i];
    } else if (!routesDir) {
      routesDir = args[i];
    }
  }

  if (!routesDir) {
    console.error('Usage: npx tsx extract-api-contract.ts <routes-dir> --output <output-dir>');
    process.exit(1);
  }

  if (!fs.existsSync(routesDir)) {
    console.error(`Routes directory not found: ${routesDir}`);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('-routes.ts'));
  console.log(`Found ${routeFiles.length} route files in ${routesDir}`);

  const combinedSpec: Record<string, unknown> = {
    openapi: '3.0.3',
    info: { title: 'Orion Platform API', version: '1.0.0', description: 'Combined API spec from all route files' },
    paths: {},
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas: {} },
  };

  for (const file of routeFiles) {
    const filePath = path.join(routesDir, file);
    console.log(`\nProcessing: ${file}`);

    const routes = extractRoutes(filePath);
    console.log(`  Found ${routes.length} routes`);

    const interfaces = extractTypescriptInterfaces(filePath);
    console.log(`  Found ${interfaces.size} TypeScript interfaces`);

    const spec = routesToOpenAPI(file, routes, interfaces);
    const specFileName = file.replace('.ts', '.yaml');
    const specPath = path.join(outputDir, specFileName);

    fs.writeFileSync(specPath, yamlStringify(spec as Record<string, unknown>), 'utf-8');
    console.log(`  Written: ${specPath}`);

    // Merge into combined
    const combinedPaths = (combinedSpec.paths as Record<string, unknown>) || {};
    const specPaths = (spec as Record<string, unknown>).paths as Record<string, unknown>;
    for (const [url, pathItem] of Object.entries(specPaths)) {
      combinedPaths[url] = pathItem;
    }
  }

  const combinedPath = path.join(outputDir, 'openapi-combined.yaml');
  fs.writeFileSync(combinedPath, yamlStringify(combinedSpec as Record<string, unknown>), 'utf-8');
  console.log(`\nCombined spec written: ${combinedPath}`);
  console.log(`Total endpoints: ${Object.keys((combinedSpec.paths as Record<string, unknown>) || {}).length}`);
}

main().catch(console.error);
