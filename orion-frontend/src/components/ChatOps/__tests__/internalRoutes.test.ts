import { describe, it, expect } from 'vitest';
import { buildInternalRoute, internalRouteMap } from '../internalRoutes';

describe('internalRoutes', () => {
  describe('buildInternalRoute', () => {
    it('returns correct path for known resource types with id', () => {
      expect(buildInternalRoute('deployment', 'dep-123')).toBe('/deployments/dep-123');
      expect(buildInternalRoute('pipeline', 'pipe-456')).toBe('/pipelines/pipe-456');
      expect(buildInternalRoute('sbom', 'sbom-789')).toBe('/sbom/sbom-789');
      expect(buildInternalRoute('ticket', 'tkt-001')).toBe('/tickets/tkt-001');
      expect(buildInternalRoute('ephemeralEnv', 'env-100')).toBe('/ephemeral-envs/env-100');
      expect(buildInternalRoute('selfHealing', 'inc-200')).toBe('/console/self-healing/incidents/inc-200');
    });

    it('returns list path for types without id requirement', () => {
      expect(buildInternalRoute('alert', '')).toBe('/alerts');
      expect(buildInternalRoute('canary-analysis', '')).toBe('/canary-analysis');
      expect(buildInternalRoute('buildEnv', '')).toBe('/console/build-env');
      expect(buildInternalRoute('codeRepo', '')).toBe('/console/code-mgmt/repos');
    });

    it('returns null for unknown resource type', () => {
      expect(buildInternalRoute('unknown_type', '123')).toBeNull();
      expect(buildInternalRoute('', '')).toBeNull();
    });
  });

  describe('internalRouteMap', () => {
    it('has expected resource types', () => {
      const expectedTypes = [
        'deployment', 'alert', 'pipeline', 'sbom', 'ticket',
        'canary-analysis', 'ephemeralEnv', 'buildEnv', 'codeRepo', 'selfHealing',
      ];
      for (const type of expectedTypes) {
        expect(internalRouteMap[type]).toBeDefined();
        expect(internalRouteMap[type].label).toBeTruthy();
        expect(typeof internalRouteMap[type].buildPath).toBe('function');
      }
    });
  });
});
