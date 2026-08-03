/**
 * Route Generator
 *
 * Phase 4: Converts PageRegistry entries into AppRoute[] for the router.
 * Supports both static (local) and dynamic (remote) page registry sources.
 *
 * Compatible with existing AppRoute type from routes.tsx.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import type { AppRoute } from './routes';
import type { PageEntry, PageRegistry } from './page-registry-types';

/**
 * Convert a string component path to a lazy import function
 * Mirrors the pattern from routes.tsx: `const lazyImport = (path: string) => lazy(() => import(path))`
 */
function resolveElement(element: string | (() => Promise<{ default: React.ComponentType }>)): (() => Promise<{ default: React.ComponentType }>) {
  if (typeof element === 'function') {
    return element;
  }
  // String path → lazy import with Vite ignore hint
  return () => import(/* @vite-ignore */ element);
}

/**
 * Convert a single PageEntry to AppRoute
 */
function pageEntryToRoute(entry: PageEntry): AppRoute {
  // Handle redirect routes
  if (entry.redirectTo) {
    return {
      path: entry.path,
      element: <Navigate to={entry.redirectTo} replace />,
      protected: entry.protected ?? false,
      hideLayout: entry.hideLayout ?? true,
    } as AppRoute & { hidden: boolean };
  }

  // Resolve element (string path → lazy import, or use function directly)
  const resolvedElement = resolveElement(entry.element);

  const route: AppRoute = {
    path: entry.path,
    element: React.lazy(resolvedElement),
    protected: entry.protected ?? true,
    requiredPermission: entry.requiredPermission,
    hideLayout: entry.hideLayout ?? false,
    index: entry.index,
  };

  // Recursively process children
  if (entry.children && entry.children.length > 0) {
    route.children = entry.children
      .filter((child) => !child.hidden)
      .map((child) => pageEntryToRoute(child));
  }

  return route;
}

/**
 * Generate AppRoute[] from a PageRegistry
 *
 * @param registry - PageRegistry to convert
 * @returns Array of AppRoute objects compatible with router/index.tsx
 */
export function generateRoutes(registry: PageRegistry): AppRoute[] {
  const routes: AppRoute[] = registry.pages.map((entry) => pageEntryToRoute(entry));

  // Ensure 404 route exists
  if (!routes.some((r) => r.path === '*')) {
    routes.push({
      path: '*',
      element: React.lazy(() => import('@/pages/NotFound')),
      protected: false,
    });
  }

  return routes;
}

/**
 * Merge local and remote registries
 * Local entries take precedence for same paths
 */
export function mergeRegistries(
  local: PageRegistry,
  remote?: PageRegistry
): PageRegistry {
  if (!remote) return local;

  const remotePaths = new Set(remote.pages.map((p) => p.path));
  const merged = [
    ...local.pages,
    ...remote.pages.filter((p) => !remotePaths.has(p.path)),
  ];

  // Sort by sortOrder if available
  merged.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return {
    pages: merged,
    meta: {
      version: remote.meta?.version || local.meta?.version || 'unknown',
      lastUpdated: remote.meta?.lastUpdated || local.meta?.lastUpdated || new Date().toISOString(),
      source: 'merged',
    },
  };
}
