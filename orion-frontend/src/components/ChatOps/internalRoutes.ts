/**
 * Internal resource type → React Router path mapping.
 * Add new resource types here — no component changes needed.
 */

export interface RoutePattern {
  /** Route template function, e.g. (id) => `/deployments/${id}` */
  buildPath: (params: { id: string; [key: string]: string }) => string;
  /** Human-readable label for debugging */
  label: string;
}

/** Map of resource types to their route builders */
export const internalRouteMap: Record<string, RoutePattern> = {
  deployment: { buildPath: ({ id }) => `/deployments/${id}`, label: 'Deployment Detail' },
  alert: { buildPath: () => '/alerts', label: 'Alert List' },
  pipeline: { buildPath: ({ id }) => `/pipelines/${id}`, label: 'Pipeline Detail' },
  sbom: { buildPath: ({ id }) => `/sbom/${id}`, label: 'SBOM Detail' },
  ticket: { buildPath: ({ id }) => `/tickets/${id}`, label: 'Ticket Detail' },
  'canary-analysis': { buildPath: () => '/canary-analysis', label: 'Canary Analysis' },
  ephemeralEnv: { buildPath: ({ id }) => `/ephemeral-envs/${id}`, label: 'Ephemeral Env Detail' },
  buildEnv: { buildPath: () => '/console/build-env', label: 'Build Environment' },
  codeRepo: { buildPath: () => '/console/code-mgmt/repos', label: 'Code Repositories' },
  selfHealing: { buildPath: ({ id }) => `/console/self-healing/incidents/${id}`, label: 'Self-Healing Incident' },
};

/**
 * Build a route path from resource type and params.
 * Returns null if the resource type is not in the route map.
 */
export function buildInternalRoute(resourceType: string, resourceId: string): string | null {
  const pattern = internalRouteMap[resourceType];
  if (!pattern) return null;
  return pattern.buildPath({ id: resourceId });
}
