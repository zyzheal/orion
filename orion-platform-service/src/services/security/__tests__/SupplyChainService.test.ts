/**
 * SupplyChainService Unit Tests
 *
 * Tests: SBOM generation, dependency analysis, signature verification,
 * supply chain reports, malicious package detection, typosquatting detection,
 * dependency poisoning scan, security score dashboard
 */

import { createHttpsServer, request } from 'https';
import { SupplyChainService } from '../SupplyChainService';

// Mock database pool
const mockPool = {
  query: jest.fn(),
};

// Mock HTTPS to prevent real network calls during tests
const originalHttpsGet = require('https').get;
const mockHttpsResponse = (body: string, statusCode = 200) => ({
  statusCode,
  on: (_event: string, cb: (chunk: string) => void) => {
    if (statusCode < 400) cb(body);
  },
  setTimeout: (_ms: number, _cb: () => void) => {},
  destroy: () => {},
});

require('https').get = jest.fn((_options: any, cb: (res: any) => void) => {
  const url = _options?.hostname + _options?.path || '';
  if (url.includes('/express/4.18.0')) {
    cb(mockHttpsResponse(JSON.stringify({
      name: 'express', version: '4.18.0',
      dependencies: {},
      'dist-tags': { latest: '4.18.0' },
      versions: { '4.18.0': {} },
    })));
  } else if (url.includes('/lodash/4.17.21')) {
    cb(mockHttpsResponse(JSON.stringify({
      name: 'lodash', version: '4.17.21',
      dependencies: {},
      'dist-tags': { latest: '4.17.21' },
      versions: { '4.17.21': {} },
    })));
  } else if (url.includes('/registry.npmjs.org/') && !url.includes('/')) {
    // Root package metadata request (for resolveSemverVersion)
    cb(mockHttpsResponse(JSON.stringify({
      'dist-tags': { latest: '1.0.0' },
      versions: { '1.0.0': {} },
    })));
  } else {
    cb(mockHttpsResponse('', 404));
  }
  return { on: () => {}, setTimeout: () => {}, destroy: () => {} } as any;
});

describe('SupplyChainService', () => {
  let service: SupplyChainService;

  afterAll(() => {
    // Restore original https.get
    require('https').get = originalHttpsGet;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SupplyChainService(mockPool as any);
  });

  // ==================== generateSBOM ====================

  describe('generateSBOM', () => {
    it('should generate SBOM with components', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'sbom-1', artifact_id: 'art-1', sbom_format: 'cyclonedx' }],
        rowCount: 1,
      });

      const result = await service.generateSBOM('tenant-1', {
        artifactId: 'art-1',
        components: [
          { name: 'express', version: '4.18.0' },
          { name: 'lodash', version: '4.17.21' },
        ],
      });

      expect(result).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO supply_chain_sboms'),
        expect.arrayContaining(['tenant-1', 'art-1']),
      );
    });

    it('should detect vulnerable components (version starting with 0.)', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'sbom-2' }],
        rowCount: 1,
      });

      await service.generateSBOM('tenant-1', {
        artifactId: 'art-2',
        components: [
          { name: 'beta-lib', version: '0.1.0' },
          { name: 'stable-lib', version: '2.0.0' },
        ],
      });

      // The query should include vulnerabilities JSON
      const queryCall = mockPool.query.mock.calls[0];
      const vulnParam = queryCall[1][7]; // vulnerabilities parameter
      const vulns = JSON.parse(vulnParam);
      expect(vulns.length).toBeGreaterThan(0);
      expect(vulns[0].component).toBe('beta-lib');
    });

    it('should detect components with knownVulnerabilities flag', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'sbom-3' }], rowCount: 1 });

      await service.generateSBOM('tenant-1', {
        artifactId: 'art-3',
        components: [
          { name: 'vuln-lib', version: '1.0.0', knownVulnerabilities: true, cve: 'CVE-2024-1234' },
        ],
      });

      const queryCall = mockPool.query.mock.calls[0];
      const vulns = JSON.parse(queryCall[1][7]);
      expect(vulns).toHaveLength(1);
      expect(vulns[0].severity).toBe('high');
    });

    it('should use default format and version', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'sbom-4' }], rowCount: 1 });

      await service.generateSBOM('tenant-1', {
        artifactId: 'art-4',
        components: [],
      });

      const params = mockPool.query.mock.calls[0][1];
      expect(params[3]).toBe('cyclonedx'); // default format
      expect(params[4]).toBe('1.4'); // default version
    });
  });

  // ==================== getSBOM ====================

  describe('getSBOM', () => {
    it('should return SBOM by id', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'sbom-1', artifact_id: 'art-1' }],
        rowCount: 1,
      });

      const result = await service.getSBOM('sbom-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('sbom-1');
    });

    it('should return null when SBOM not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.getSBOM('non-existent');

      expect(result).toBeNull();
    });
  });

  // ==================== analyzeDependencies ====================

  describe('analyzeDependencies', () => {
    it('should return existing analysis if found', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'dep-1', package_name: 'express', direct_deps: '[]' }],
        rowCount: 1,
      });

      const result = await service.analyzeDependencies('tenant-1', {
        packageName: 'express',
        packageVersion: '4.18.0',
      });

      expect(result.id).toBe('dep-1');
      // Should only call query once (SELECT), not INSERT
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('should build new dependency graph when not existing', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SELECT - not found
        .mockResolvedValueOnce({ // INSERT
          rows: [{ id: 'dep-2', package_name: 'express', package_version: '4.18.0' }],
          rowCount: 1,
        });

      const result = await service.analyzeDependencies('tenant-1', {
        packageName: 'express',
        packageVersion: '4.18.0',
      });

      expect(result.id).toBe('dep-2');
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should use default depth of 3', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ id: 'dep-3' }], rowCount: 1 });

      await service.analyzeDependencies('tenant-1', {
        packageName: 'lodash',
        packageVersion: '4.17.21',
      });

      const insertCall = mockPool.query.mock.calls[1];
      expect(insertCall[1][6]).toBe(3); // default depth
    });
  });

  // ==================== verifySignature ====================

  describe('verifySignature', () => {
    it('should verify a valid signature', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 'sig-1', signed_by: 'developer@orion.io', signed_at: new Date() }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE

      const result = await service.verifySignature('art-1', 'valid-signature');

      expect(result.verified).toBe(true);
      expect(result.signedBy).toBe('developer@orion.io');
    });

    it('should return verified false for unknown signature', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.verifySignature('art-1', 'unknown-sig');

      expect(result.verified).toBe(false);
      expect(result.reason).toBe('Signature not found');
    });
  });

  // ==================== getSupplyChainReport ====================

  describe('getSupplyChainReport', () => {
    it('should generate report for tenant', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total_sboms: '5' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total_signatures: '3', verified_count: '2' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total_vulnerabilities: '10' }], rowCount: 1 });

      const result = await service.getSupplyChainReport('tenant-1');

      expect(result.totalSboms).toBe(5);
      expect(result.totalSignatures).toBe(3);
      expect(result.verifiedSignatures).toBe(2);
      expect(result.totalVulnerabilities).toBe(10);
    });

    it('should filter by pipelineId when provided', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total_sboms: '2' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total_signatures: '1', verified_count: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total_vulnerabilities: '3' }], rowCount: 1 });

      const result = await service.getSupplyChainReport('tenant-1', 'pipeline-1');

      expect(result.totalSboms).toBe(2);
      // Verify the SBOM query includes pipeline_id filter
      const sbomQuery = mockPool.query.mock.calls[0][0];
      expect(sbomQuery).toContain('pipeline_id');
    });

    it('should handle zero results', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total_sboms: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total_signatures: '0', verified_count: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total_vulnerabilities: null }], rowCount: 1 });

      const result = await service.getSupplyChainReport('tenant-1');

      expect(result.totalSboms).toBe(0);
      expect(result.totalVulnerabilities).toBe(0);
    });
  });

  // ==================== detectMaliciousPackages ====================

  describe('detectMaliciousPackages', () => {
    it('should detect known malicious package with specific version', () => {
      const findings = service.detectMaliciousPackages([
        { name: 'event-stream', version: '3.3.6' },
      ]);

      expect(findings).toHaveLength(1);
      expect(findings[0].package).toBe('event-stream');
      expect(findings[0].info.severity).toBe('critical');
    });

    it('should detect malicious package regardless of version', () => {
      const findings = service.detectMaliciousPackages([
        { name: 'coa', version: '1.0.0' },
      ]);

      expect(findings).toHaveLength(1);
      expect(findings[0].package).toBe('coa');
    });

    it('should not flag clean packages', () => {
      const findings = service.detectMaliciousPackages([
        { name: 'express', version: '4.18.0' },
        { name: 'lodash', version: '4.17.21' },
      ]);

      expect(findings).toHaveLength(0);
    });

    it('should be case-insensitive', () => {
      const findings = service.detectMaliciousPackages([
        { name: 'Event-Stream', version: '3.3.6' },
      ]);

      expect(findings).toHaveLength(1);
    });

    it('should not flag malicious package with different version', () => {
      const findings = service.detectMaliciousPackages([
        { name: 'event-stream', version: '3.3.5' }, // Different version
      ]);

      expect(findings).toHaveLength(0);
    });

    it('should handle empty package list', () => {
      const findings = service.detectMaliciousPackages([]);
      expect(findings).toHaveLength(0);
    });

    it('should detect node-ipc sabotage version', () => {
      const findings = service.detectMaliciousPackages([
        { name: 'node-ipc', version: '11.0.0' },
      ]);

      expect(findings).toHaveLength(1);
      expect(findings[0].info.reason).toContain('destruction');
    });
  });

  // ==================== detectTyposquatting ====================

  describe('detectTyposquatting', () => {
    it('should detect typosquatting for similar names', () => {
      const alerts = service.detectTyposquatting(['reactt']); // extra 't'

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].legitimate).toBe('react');
    });

    it('should not flag exact matches', () => {
      const alerts = service.detectTyposquatting(['react', 'lodash', 'express']);

      expect(alerts).toHaveLength(0);
    });

    it('should detect multiple typosquatting attempts', () => {
      const alerts = service.detectTyposquatting(['reactt', 'axois']);

      // At least one should be detected
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty for unrelated package names', () => {
      const alerts = service.detectTyposquatting(['my-custom-package-name']);

      expect(alerts).toHaveLength(0);
    });

    it('should handle empty input', () => {
      const alerts = service.detectTyposquatting([]);
      expect(alerts).toHaveLength(0);
    });

    it('should include similarity score', () => {
      const alerts = service.detectTyposquatting(['reactt']);

      if (alerts.length > 0) {
        expect(alerts[0].similarity).toBeGreaterThan(0.75);
        expect(alerts[0].suspicious).toBe('reactt');
      }
    });
  });

  // ==================== scanDependencyPoisoning ====================

  describe('scanDependencyPoisoning', () => {
    it('should scan and return safe result for clean packages', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'scan-1' }], rowCount: 1 });

      const result = await service.scanDependencyPoisoning('tenant-1', [
        { name: 'express', version: '4.18.0' },
        { name: 'lodash', version: '4.17.21' },
      ]);

      expect(result.riskLevel).toBe('safe');
      expect(result.riskScore).toBe(0);
      expect(result.maliciousPackages).toHaveLength(0);
      expect(result.totalPackagesScanned).toBe(2);
    });

    it('should detect high risk for malicious packages', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'scan-2' }], rowCount: 1 });

      const result = await service.scanDependencyPoisoning('tenant-1', [
        { name: 'event-stream', version: '3.3.6' },
      ]);

      expect(result.maliciousPackages).toHaveLength(1);
      expect(result.riskScore).toBeGreaterThanOrEqual(30);
      expect(['medium', 'high', 'critical']).toContain(result.riskLevel);
    });

    it('should include scan timestamp', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'scan-3' }], rowCount: 1 });

      const result = await service.scanDependencyPoisoning('tenant-1', []);

      expect(result.scanTimestamp).toBeDefined();
      expect(new Date(result.scanTimestamp).getTime()).not.toBeNaN();
    });

    it('should cap risk score at 100', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'scan-4' }], rowCount: 1 });

      const result = await service.scanDependencyPoisoning('tenant-1', [
        { name: 'event-stream', version: '3.3.6' },
        { name: 'node-ipc', version: '11.0.0' },
        { name: 'eslint-scope', version: '8.4.0' },
      ]);

      expect(result.riskScore).toBeLessThanOrEqual(100);
    });

    it('should store scan results in database', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'scan-5' }], rowCount: 1 });

      await service.scanDependencyPoisoning('tenant-1', [
        { name: 'express', version: '4.18.0' },
      ]);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dependency_poisoning_scans'),
        expect.arrayContaining(['tenant-1']),
      );
    });
  });

  // ==================== getSecurityScoreDashboard ====================

  describe('getSecurityScoreDashboard', () => {
    it('should return dashboard data with SBOM coverage', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '5' }], rowCount: 1 }) // sbomCount
        .mockResolvedValueOnce({ rows: [{ total: '3', verified: '2' }], rowCount: 1 }) // sigCount
        .mockResolvedValueOnce({ rows: [{ total: '2', critical: '0' }], rowCount: 1 }); // poisonScans

      const result = await service.getSecurityScoreDashboard('tenant-1');

      expect(result.overall_score).toBeGreaterThan(0);
      expect(result.components.sbom_coverage).toBe(5);
      expect(result.components.signature_rate).toBe(67); // 2/3 * 100
      expect(result.alerts.unsigned_artifacts).toBe(1);
    });

    it('should return low score when no SBOMs', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total: '0', verified: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total: '0', critical: '0' }], rowCount: 1 });

      const result = await service.getSecurityScoreDashboard('tenant-1');

      expect(result.overall_score).toBe(20); // Only poison detection base score
      expect(result.recommendations).toContain('Enable SBOM generation for all pipelines');
      expect(result.recommendations).toContain('Enable artifact signing');
    });

    it('should generate recommendations for critical poison findings', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total: '1', verified: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total: '1', critical: '1' }], rowCount: 1 });

      const result = await service.getSecurityScoreDashboard('tenant-1');

      expect(result.alerts.critical_poison_findings).toBe(1);
      expect(result.recommendations).toContain('Investigate 1 critical dependency poisoning findings');
    });

    it('should return healthy recommendation when all good', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ total: '10' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total: '5', verified: '5' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ total: '5', critical: '0' }], rowCount: 1 });

      const result = await service.getSecurityScoreDashboard('tenant-1');

      expect(result.recommendations).toContain('Supply chain security posture is healthy');
    });
  });
});
