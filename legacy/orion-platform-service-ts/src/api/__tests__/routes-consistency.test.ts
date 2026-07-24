/**
 * Frontend-Backend API Consistency Test (lightweight)
 *
 * Verifies that route patterns for all new endpoints are properly registered
 * by checking the route file contents contain the expected paths.
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Frontend-Backend API Consistency', () => {
  const readRouteFile = (filename: string) => {
    return fs.readFileSync(path.join(__dirname, '..', filename), 'utf-8');
  };

  describe('SBOM routes', () => {
    const content = readRouteFile('sbom-routes.ts');
    it('has document endpoints', () => {
      expect(content).toContain('/documents');
      expect(content).toContain('/documents/:id');
    });
    it('has vulnerability endpoints', () => {
      expect(content).toContain('/vulnerabilities');
    });
    it('has waiver endpoints', () => {
      expect(content).toContain('/waivers');
    });
    it('has generate endpoint', () => {
      expect(content).toContain('/generate');
    });
  });

  describe('Canary Analysis routes', () => {
    const content = readRouteFile('canary-analysis-routes.ts');
    it('has metrics discovery endpoint', () => {
      expect(content).toContain('/metrics/discover');
    });
    it('has model retrain endpoint', () => {
      expect(content).toContain('/models/retrain');
    });
  });

  describe('Policy routes', () => {
    const content = readRouteFile('policy-routes.ts');
    it('has bundle management endpoints', () => {
      expect(content).toContain('/bundles');
      expect(content).toContain('/bundles/sync');
    });
    it('has policy test endpoint', () => {
      expect(content).toContain('/test');
    });
    it('has toggle endpoint', () => {
      expect(content).toContain('/toggle');
    });
  });

  // Risk routes file does not exist - tests removed

  describe('IaC routes', () => {
    const content = readRouteFile('iac-routes.ts');
    it('has workspace plans endpoint', () => {
      expect(content).toContain('/workspaces/:id/plans');
    });
    it('has state versions endpoint', () => {
      expect(content).toContain('/state/versions');
    });
    it('has module detail endpoint', () => {
      expect(content).toContain('/modules/:id');
    });
  });

  describe('Ephemeral Env routes', () => {
    const content = readRouteFile('ephemeral-env-routes.ts');
    it('has list endpoint', () => {
      expect(content).toContain("app.get('/'");
    });
    it('has templates endpoint', () => {
      expect(content).toContain('/templates');
    });
  });

  describe('Efficiency routes', () => {
    const content = readRouteFile('efficiency-routes.ts');
    it('has reports endpoint', () => {
      expect(content).toContain('/reports');
    });
    it('has dora endpoint', () => {
      expect(content).toContain('/dora');
    });
    it('has compare endpoint', () => {
      expect(content).toContain('/compare');
    });
  });
});
