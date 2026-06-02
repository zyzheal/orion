/**
 * DependencyGraphService - Unit Tests
 *
 * Tests for dependency graph building, vulnerability path finding,
 * and transitive dependency resolution.
 */

import { DependencyGraphService } from '../DependencyGraphService';

describe('DependencyGraphService', () => {
  let service: DependencyGraphService;
  let mockPool: { query: jest.Mock };

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    service = new DependencyGraphService(mockPool as any);
  });

  // ==================== buildDependencyGraph ====================

  describe('buildDependencyGraph', () => {
    it('should build graph with nodes and edges', async () => {
      const packages = [
        { name: 'pkg-a', version: '1.0.0' },
        { name: 'pkg-b', version: '2.0.0' },
        { name: 'pkg-c', version: '3.0.0' },
      ];

      const result = await service.buildDependencyGraph(packages);

      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(2);
      expect(result.nodes[0].id).toBe('pkg-a@1.0.0');
      expect(result.nodes[1].id).toBe('pkg-b@2.0.0');
      expect(result.edges[0].source).toBe('pkg-a@1.0.0');
      expect(result.edges[0].target).toBe('pkg-b@2.0.0');
      expect(result.edges[0].type).toBe('depends_on');
    });

    it('should handle single package (no edges)', async () => {
      const packages = [{ name: 'pkg-a', version: '1.0.0' }];
      const result = await service.buildDependencyGraph(packages);

      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(0);
    });

    it('should handle empty packages', async () => {
      const result = await service.buildDependencyGraph([]);

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it('should include name and version in nodes', async () => {
      const packages = [{ name: 'lodash', version: '4.17.21' }];
      const result = await service.buildDependencyGraph(packages);

      expect(result.nodes[0].name).toBe('lodash');
      expect(result.nodes[0].version).toBe('4.17.21');
    });
  });

  // ==================== findVulnerablePaths ====================

  describe('findVulnerablePaths', () => {
    it('should find packages with known vulnerabilities', async () => {
      const packages = [
        { name: 'pkg-a', version: '1.0.0' },
        { name: 'pkg-b', version: '2.0.0' },
      ];
      const vulnDb = {
        'pkg-a@1.0.0': [{ cve: 'CVE-2026-0001', severity: 'high' }],
      };

      const result = await service.findVulnerablePaths(packages, vulnDb);

      expect(result).toHaveLength(1);
      expect(result[0].package).toBe('pkg-a');
      expect(result[0].vulnerabilities).toEqual([{ cve: 'CVE-2026-0001', severity: 'high' }]);
    });

    it('should return empty array when no vulnerabilities', async () => {
      const packages = [{ name: 'pkg-a', version: '1.0.0' }];
      const vulnDb = {};

      const result = await service.findVulnerablePaths(packages, vulnDb);

      expect(result).toHaveLength(0);
    });

    it('should handle multiple vulnerable packages', async () => {
      const packages = [
        { name: 'pkg-a', version: '1.0.0' },
        { name: 'pkg-b', version: '2.0.0' },
      ];
      const vulnDb = {
        'pkg-a@1.0.0': [{ cve: 'CVE-1' }],
        'pkg-b@2.0.0': [{ cve: 'CVE-2' }],
      };

      const result = await service.findVulnerablePaths(packages, vulnDb);

      expect(result).toHaveLength(2);
    });

    it('should use empty vulnDb by default', async () => {
      const packages = [{ name: 'pkg-a', version: '1.0.0' }];

      const result = await service.findVulnerablePaths(packages);

      expect(result).toHaveLength(0);
    });
  });

  // ==================== getTransitiveDependencies ====================

  describe('getTransitiveDependencies', () => {
    it('should return transitive dependencies from DB', async () => {
      const deps = [
        { name: 'dep-1', version: '1.0.0' },
        { name: 'dep-2', version: '2.0.0' },
      ];
      mockPool.query.mockResolvedValue({
        rows: [{ transitive_deps: deps }],
        rowCount: 1,
      });

      const result = await service.getTransitiveDependencies('my-package');

      expect(result).toEqual(deps);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('dependency_graphs'),
        ['my-package']
      );
    });

    it('should return empty array when no data found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.getTransitiveDependencies('unknown-package');

      expect(result).toEqual([]);
    });

    it('should return empty array when transitive_deps is null', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ transitive_deps: null }],
        rowCount: 1,
      });

      const result = await service.getTransitiveDependencies('my-package');

      expect(result).toEqual([]);
    });

    it('should accept custom depth parameter', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await service.getTransitiveDependencies('my-package', 5);

      expect(mockPool.query).toHaveBeenCalled();
    });
  });
});
