/**
 * Page Registry Types
 *
 * Phase 4: Config-driven frontend routing.
 * Defines PageEntry and PageRegistry interfaces for route configuration.
 *
 * Compatible with existing AppRoute from routes.tsx.
 */

/**
 * Page entry in the registry
 * Each entry represents a single route/page in the application
 */
export interface PageEntry {
  /** Route path (React Router path), supports params like /pipelines/:id */
  path: string;

  /** Page component lazy import path string or React element */
  element: string | (() => Promise<{ default: React.ComponentType }>);

  /** Whether authentication is required (default: true) */
  protected?: boolean;

  /** Fine-grained permission requirement */
  requiredPermission?: {
    resource: string;
    action: 'read' | 'write' | 'manage';
  };

  /** Permission (legacy alias for requiredPermission) */
  permission?: { resource: string; action: string };

  /** Skip main Layout wrapper (for fullscreen/sub-app pages) */
  hideLayout?: boolean;

  /** Child routes (nested routes) */
  children?: PageEntry[];

  /** Whether this is a micro-frontend sub-application */
  microApp?: boolean;

  /** Sub-application key (required when microApp=true) */
  subAppKey?: string;

  /** Menu module key for auto-generated menus */
  menu?: string;

  /** Menu key (legacy) */
  menuKey?: string;

  /** Menu label (legacy) */
  menuLabel?: string;

  /** Menu icon (legacy) */
  menuIcon?: string;

  /** Index route (renders at parent path) */
  index?: boolean;

  /** Redirect target path */
  redirectTo?: string;

  /** Page title */
  title?: string;

  /** Show breadcrumb navigation */
  breadcrumb?: boolean;

  /** Hidden from menu (still accessible directly) */
  hidden?: boolean;

  /** Display sort order */
  sortOrder?: number;

  /** Page status */
  status?: string;
}

/**
 * Page registry collection
 * Can be loaded from local TS file or remote API
 */
export interface PageRegistry {
  pages: PageEntry[];

  meta?: {
    version: string;
    lastUpdated: string;
    source: 'local' | 'remote' | 'merged';
  };
}

/**
 * Registry source type
 */
export type RegistrySource = 'local' | 'remote' | 'merged';
