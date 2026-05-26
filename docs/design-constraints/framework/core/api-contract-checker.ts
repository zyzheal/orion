/**
 * API Contract Checker — detects inconsistencies between frontend API calls
 * and backend route definitions.
 *
 * Checks:
 *   1. Frontend endpoint path vs backend route path
 *   2. HTTP method consistency
 *   3. Dual-implementation detection (same function in multiple services)
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ApiContractIssue {
  type: 'path-mismatch' | 'method-mismatch' | 'dual-implementation' | 'orphan-route';
  severity: 'P0' | 'P1' | 'P2';
  frontendFile?: string;
  backendRoute?: string;
  frontendCall?: string;
  message: string;
}

/**
 * Run API contract check on a given root path.
 * Auto-discovers frontend API clients and backend routes, compares them.
 */
export function runApiContractCheck(rootPath: string): {
  totalIssues: number;
  issues: ApiContractIssue[];
  matchedRoutes: number;
  unmatchedRoutes: number;
  dualImplementations: number;
} {
  const issues: ApiContractIssue[] = [];

  // Strategy: Find project root, then scan both frontend API and backend routes
  let projectRoot = rootPath;
  for (let depth = 0; depth < 6; depth++) {
    if (
      fs.existsSync(path.join(projectRoot, 'orion-frontend')) &&
      fs.existsSync(path.join(projectRoot, 'orion-platform-service'))
    ) {
      break;
    }
    const parent = path.dirname(projectRoot);
    if (parent === projectRoot) break;
    projectRoot = parent;
  }

  const frontendApiDir = path.join(projectRoot, 'orion-frontend', 'src', 'api');
  const backendApiDir = path.join(projectRoot, 'orion-platform-service', 'src', 'api');

  if (!fs.existsSync(frontendApiDir) || !fs.existsSync(backendApiDir)) {
    return { totalIssues: 0, issues: [], matchedRoutes: 0, unmatchedRoutes: 0, dualImplementations: 0 };
  }

  // Step 1: Extract backend route definitions
  const backendRoutes = extractBackendRoutes(backendApiDir);

  // Step 2: Extract frontend API calls
  const frontendCalls = extractFrontendCalls(frontendApiDir);

  // Step 3: Match frontend calls to backend routes
  const matched = new Set<string>();
  const unmatched = new Set<string>();

  for (const call of frontendCalls) {
    const matchedRoute = backendRoutes.find(r =>
      call.path.includes(r.normalizedPath) || r.normalizedPath.includes(call.path.split('?')[0])
    );
    if (matchedRoute) {
      matched.add(call.path);
      // Check HTTP method consistency
      if (call.method && matchedRoute.method && call.method.toUpperCase() !== matchedRoute.method.toUpperCase()) {
        issues.push({
          type: 'method-mismatch',
          severity: 'P0',
          frontendFile: call.file,
          backendRoute: `${matchedRoute.method} ${matchedRoute.path}`,
          frontendCall: `${call.method} ${call.path}`,
          message: `HTTP 方法不一致: 前端 ${call.method} ${call.path} vs 后端 ${matchedRoute.method} ${matchedRoute.path}`,
        });
      }
    } else {
      unmatched.add(call.path);
    }
  }

  // Step 4: Detect dual implementations (same route defined in multiple files)
  const routeGroups: Record<string, string[]> = {};
  for (const route of backendRoutes) {
    const key = `${route.method} ${route.normalizedPath}`;
    routeGroups[key] = routeGroups[key] || [];
    routeGroups[key].push(route.file);
  }
  let dualCount = 0;
  for (const [routeKey, files] of Object.entries(routeGroups)) {
    const uniqueFiles = [...new Set(files)];
    if (uniqueFiles.length > 1) {
      dualCount++;
      issues.push({
        type: 'dual-implementation',
        severity: 'P1',
        message: `路由 ${routeKey} 在 ${uniqueFiles.length} 个文件中重复定义: ${uniqueFiles.join(', ')}`,
      });
    }
  }

  return {
    totalIssues: issues.length,
    issues,
    matchedRoutes: matched.size,
    unmatchedRoutes: unmatched.size,
    dualImplementations: dualCount,
  };
}

interface BackendRoute {
  method: string;
  path: string;
  normalizedPath: string;
  file: string;
}

function extractBackendRoutes(dir: string): BackendRoute[] {
  const routes: BackendRoute[] = [];
  const routeFileRegex = /-routes\.ts$/;

  const files = readDirRecursive(dir);
  for (const file of files) {
    if (!routeFileRegex.test(file)) continue;

    const content = fs.readFileSync(file, 'utf-8');
    // Match route definitions: router.get('/path', ...) / router.post('/path', ...)
    const routeRegex = /(?:get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = routeRegex.exec(content)) !== null) {
      const methodMatch = content.substring(0, match.index).match(/\.(get|post|put|patch|delete)\s*\(/g);
      const method = methodMatch ? methodMatch[methodMatch.length - 1].slice(1, -1) : 'unknown';
      routes.push({
        method,
        path: match[1],
        normalizedPath: match[1].replace(/\/:\w+/g, '/:id').replace(/\{[^}]+\}/g, ':id'),
        file,
      });
    }
  }
  return routes;
}

interface FrontendCall {
  method: string;
  path: string;
  file: string;
}

function extractFrontendCalls(dir: string): FrontendCall[] {
  const calls: FrontendCall[] = [];
  const files = readDirRecursive(dir);

  for (const file of files) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;

    const content = fs.readFileSync(file, 'utf-8');
    // Match: apiClient.get('/path', ...) / request.post('/path', ...) / axios.get('/path')
    const callRegex = /(?:apiClient|request|axios|fetch)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi;
    let match;
    while ((match = callRegex.exec(content)) !== null) {
      calls.push({
        method: match[1],
        path: match[2],
        file,
      });
    }
  }
  return calls;
}

function readDirRecursive(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) {
      files.push(...readDirRecursive(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}
