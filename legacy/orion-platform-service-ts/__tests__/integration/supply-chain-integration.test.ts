/**
 * Supply Chain Integration Tests
 *
 * SBOM generation + dependency poisoning detection flow
 */

// Mock Node.js https to avoid real network calls during dependency resolution
jest.mock('https', () => {
  const { EventEmitter } = require('events');

  // Canned npm registry responses
  const registryResponses: Record<string, any> = {
    'express@4.18.2': {
      name: 'express',
      version: '4.18.2',
      dependencies: {
        accepts: '~1.3.8',
        'body-parser': '~1.20.1',
        'content-disposition': '~0.5.4',
        cookie: '~0.4.2',
        'cookie-signature': '~1.0.6',
        debug: '~2.6.9',
        depd: '~1.1.2',
        encodeurl: '~1.0.2',
        'escape-html': '~1.0.3',
        etag: '~1.8.1',
        finalhandler: '~1.1.2',
        fresh: '~0.5.2',
        'merge-descriptors': '~1.0.1',
        methods: '~1.1.3',
        'on-finished': '~2.3.0',
        parseurl: '~1.3.3',
        'path-to-regexp': '~0.1.10',
        'proxy-addr': '~2.0.7',
        qs: '~6.5.3',
        'range-parser': '~1.2.1',
        'safe-buffer': '~5.2.0',
        send: '~0.17.1',
        'serve-static': '~1.14.2',
        setprototypeof: '~1.1.1',
        statuses: '~2.0.1',
        'type-is': '~1.6.18',
        'utils-merge': '~1.0.1',
        vary: '~1.1.2',
      },
    },
    express: {
      name: 'express',
      versions: { '4.18.2': { name: 'express', version: '4.18.2' } },
      'dist-tags': { latest: '4.18.2' },
    },
  };

  // Generic response for any other package (returns no deps to keep recursion bounded)
  function getGenericResponse(pkgName: string, version: string) {
    return {
      name: pkgName,
      version,
      dependencies: {},
      devDependencies: {},
    };
  }

  function mockGet(url: string, _options: any, callback: (res: any) => void) {
    let body = '';
    const pkgMatch = url.match(/registry\.npmjs\.org\/([^/]+)(?:\/([^/]+))?/);
    let statusCode = 200;

    if (pkgMatch) {
      const pkgName = decodeURIComponent(pkgMatch[1]);
      const version = pkgMatch[2] ? decodeURIComponent(pkgMatch[2]) : null;
      const cacheKey = version ? `${pkgName}@${version}` : pkgName;

      if (registryResponses[cacheKey]) {
        body = JSON.stringify(registryResponses[cacheKey]);
      } else if (version) {
        body = JSON.stringify(getGenericResponse(pkgName, version));
      } else {
        // Version listing request - return minimal metadata
        body = JSON.stringify({
          name: pkgName,
          versions: { [version || '1.0.0']: { name: pkgName, version: version || '1.0.0' } },
          'dist-tags': { latest: version || '1.0.0' },
        });
      }
    } else {
      statusCode = 404;
    }

    const res = new EventEmitter() as any;
    res.statusCode = statusCode;

    // Emit response data asynchronously (simulates network)
    setImmediate(() => {
      callback(res);
      setImmediate(() => {
        res.emit('data', body);
        res.emit('end');
      });
    });

    return {
      on: (_event: string, fn: () => void) => { res.on('error', fn); return {}; },
      setHeader: jest.fn(),
      setTimeout: jest.fn(),
      destroy: jest.fn(),
    };
  }

  return {
    default: {
      get: jest.fn(mockGet),
      request: jest.fn(),
    },
    get: jest.fn(mockGet),
  };
});

import { SupplyChainService, SBOMInput, DependencyPoisoningReport } from '@/services/security/SupplyChainService';

// ============================================================
// Mock Database
// ============================================================

class MockSupplyChainDb {
  private sboms: any[] = [];
  private signatures: any[] = [];
  private dependencyGraphs: any[] = [];
  private poisoningScans: any[] = [];
  private idCounter = 0;

  async query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number | null }> {
    // ================== SBOMs ==================
    if (text.includes('INSERT INTO supply_chain_sboms')) {
      const id = `sbom-${++this.idCounter}`;
      const sbom = {
        id,
        tenant_id: params[0],
        artifact_id: params[1],
        pipeline_id: params[2],
        sbom_format: params[3],
        sbom_version: params[4],
        components: typeof params[5] === 'string' ? JSON.parse(params[5]) : params[5],
        dependencies: typeof params[6] === 'string' ? JSON.parse(params[6]) : params[6],
        vulnerabilities: typeof params[7] === 'string' ? JSON.parse(params[7]) : params[7],
        metadata: typeof params[8] === 'string' ? JSON.parse(params[8]) : params[8],
        created_at: new Date(),
      };
      this.sboms.push(sbom);
      return { rows: [sbom], rowCount: 1 };
    }

    if (text.includes('SELECT') && text.includes('supply_chain_sboms')) {
      if (text.includes('WHERE id =')) {
        const sbom = this.sboms.find(s => s.id === params?.[0]);
        return { rows: sbom ? [sbom] : [], rowCount: sbom ? 1 : 0 };
      }
      if (text.includes('COUNT')) {
        let filtered = [...this.sboms];
        if (params?.[0]) filtered = filtered.filter(s => s.tenant_id === params[0]);
        if (params?.[1]) filtered = filtered.filter(s => s.pipeline_id === params[1]);
        return { rows: [{ total_sboms: String(filtered.length) }], rowCount: 1 };
      }
      let rows = [...this.sboms];
      if (params?.[0]) rows = rows.filter(r => r.tenant_id === params[0]);
      return { rows, rowCount: rows.length };
    }

    if (text.includes('SUM') && text.includes('supply_chain_sboms')) {
      const total = this.sboms.reduce((sum, s) => sum + (s.vulnerabilities?.length || 0), 0);
      return { rows: [{ total_vulnerabilities: String(total) }], rowCount: 1 };
    }

    // ================== Signatures ==================
    if (text.includes('INSERT INTO artifact_signatures')) {
      const id = params[0];
      const sig = {
        id,
        tenant_id: params[1],
        artifact_id: params[2],
        signature: params[3],
        signed_by: params[4],
        signed_at: params[5],
        verified: params[6] ?? false,
        verified_at: null,
        created_at: new Date(),
      };
      this.signatures.push(sig);
      return { rows: [sig], rowCount: 1 };
    }

    if (text.includes('SELECT') && text.includes('artifact_signatures')) {
      if (text.includes('COUNT')) {
        let filtered = [...this.signatures];
        if (params?.[0]) filtered = filtered.filter(s => s.tenant_id === params[0]);
        const verified = filtered.filter(s => s.verified).length;
        return { rows: [{ total: String(filtered.length), verified: String(verified) }], rowCount: 1 };
      }
      if (text.includes('artifact_id')) {
        const sigs = this.signatures.filter(s => s.artifact_id === params?.[0] && s.signature === params?.[1]);
        return { rows: sigs, rowCount: sigs.length };
      }
      let rows = [...this.signatures];
      if (params?.[0]) rows = rows.filter(r => r.tenant_id === params[0]);
      return { rows, rowCount: rows.length };
    }

    if (text.includes('UPDATE') && text.includes('artifact_signatures')) {
      const sig = this.signatures.find(s => s.id === params?.[0]);
      if (sig) {
        sig.verified = true;
        sig.verified_at = new Date();
      }
      return { rows: [], rowCount: sig ? 1 : 0 };
    }

    // ================== Dependency Graphs ==================
    if (text.includes('INSERT INTO dependency_graphs')) {
      const id = `depgraph-${++this.idCounter}`;
      const graph = {
        id,
        tenant_id: params[0],
        package_name: params[1],
        package_version: params[2],
        direct_deps: typeof params[3] === 'string' ? JSON.parse(params[3]) : params[3],
        transitive_deps: typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4],
        vulnerable_paths: typeof params[5] === 'string' ? JSON.parse(params[5]) : params[5],
        depth: params[6],
        created_at: new Date(),
      };
      this.dependencyGraphs.push(graph);
      return { rows: [graph], rowCount: 1 };
    }

    if (text.includes('SELECT') && text.includes('dependency_graphs')) {
      let rows = [...this.dependencyGraphs];
      if (params?.[0]) rows = rows.filter(r => r.tenant_id === params[0]);
      if (params?.[1]) rows = rows.filter(r => r.package_name === params[1]);
      if (params?.[2]) rows = rows.filter(r => r.package_version === params[2]);
      return { rows, rowCount: rows.length };
    }

    // ================== Poisoning Scans ==================
    if (text.includes('INSERT INTO dependency_poisoning_scans')) {
      const id = `poison-${++this.idCounter}`;
      const scan = {
        id,
        tenant_id: params[0],
        packages_scanned: params[1],
        malicious_found: params[2],
        typosquatting_found: params[3],
        risk_score: params[4],
        risk_level: params[5],
        scan_data: typeof params[6] === 'string' ? JSON.parse(params[6]) : params[6],
        created_at: new Date(),
      };
      this.poisoningScans.push(scan);
      return { rows: [scan], rowCount: 1 };
    }

    if (text.includes('SELECT') && text.includes('dependency_poisoning_scans')) {
      let filtered = [...this.poisoningScans];
      if (params?.[0]) filtered = filtered.filter(s => s.tenant_id === params[0]);
      const critical = filtered.filter(s => ['high', 'critical'].includes(s.risk_level)).length;
      if (text.includes('COUNT')) {
        return { rows: [{ total: String(filtered.length), critical: String(critical) }], rowCount: 1 };
      }
      return { rows: filtered, rowCount: filtered.length };
    }

    return { rows: [], rowCount: 0 };
  }
}

describe('Supply Chain Integration - SBOM + Poisoning Detection', () => {
  let mockDb: MockSupplyChainDb;
  let service: SupplyChainService;

  beforeEach(() => {
    mockDb = new MockSupplyChainDb();
    service = new SupplyChainService(mockDb as any);
  });

  describe('E2E: SBOM Generation', () => {
    it('should generate SBOM for an artifact', async () => {
      const input: SBOMInput = {
        artifactId: 'artifact-123',
        pipelineId: 'pipeline-456',
        format: 'cyclonedx',
        version: '1.4',
        components: [
          { name: 'express', version: '4.18.2', type: 'framework' },
          { name: 'lodash', version: '4.17.21', type: 'utility' },
          { name: 'pg', version: '8.11.0', type: 'database' },
        ],
        dependencies: [
          { name: 'accepts', version: '1.3.8', parent: 'express' },
          { name: 'body-parser', version: '1.20.0', parent: 'express' },
        ],
      };

      const sbom = await service.generateSBOM('tenant-1', input);

      expect(sbom.id).toBeDefined();
      expect(sbom.artifact_id).toBe('artifact-123');
      expect(sbom.sbom_format).toBe('cyclonedx');
      expect(Array.isArray(sbom.vulnerabilities)).toBe(true);
    });

    it('should detect vulnerable components in SBOM', async () => {
      const sbom = await service.generateSBOM('tenant-1', {
        artifactId: 'vulnerable-artifact',
        components: [
          { name: 'old-lib', version: '0.9.0', type: 'library' },
          { name: 'stable-lib', version: '2.0.0', type: 'library' },
        ],
      });

      expect(sbom.vulnerabilities.length).toBeGreaterThanOrEqual(1);
      expect(sbom.vulnerabilities.some((v: any) => v.component === 'old-lib')).toBe(true);
    });

    it('should get SBOM by id', async () => {
      const created = await service.generateSBOM('tenant-1', {
        artifactId: 'findable-sbom',
        components: [{ name: 'dep', version: '1.0.0' }],
      });

      const found = await service.getSBOM(created.id);
      expect(found).not.toBeNull();
      expect(found.artifact_id).toBe('findable-sbom');
    });

    it('should return null for non-existent SBOM', async () => {
      const found = await service.getSBOM('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('E2E: Dependency Analysis', () => {
    it('should analyze dependencies for a package', async () => {
      const result = await service.analyzeDependencies('tenant-1', {
        packageName: 'express',
        packageVersion: '4.18.2',
        depth: 2,
      });

      expect(result.id).toBeDefined();
      expect(result.package_name).toBe('express');
      expect(result.direct_deps).toBeDefined();
      expect(Array.isArray(result.direct_deps)).toBe(true);
      expect(result.transitive_deps).toBeDefined();
      expect(Array.isArray(result.transitive_deps)).toBe(true);
    });

    it('should return cached analysis if exists', async () => {
      const first = await service.analyzeDependencies('tenant-1', {
        packageName: 'cached-pkg',
        packageVersion: '1.0.0',
      });

      const second = await service.analyzeDependencies('tenant-1', {
        packageName: 'cached-pkg',
        packageVersion: '1.0.0',
      });

      expect(first.id).toBe(second.id);
    });

    it('should find vulnerable paths', async () => {
      const result = await service.analyzeDependencies('tenant-1', {
        packageName: 'vulnerable-pkg',
        packageVersion: '0.1.0',
      });

      expect(Array.isArray(result.vulnerable_paths)).toBe(true);
    });
  });

  describe('E2E: Dependency Poisoning Detection', () => {
    it('should detect known malicious packages', async () => {
      const packages = [
        { name: 'express', version: '4.18.2' },
        { name: 'event-stream', version: '3.3.6' }, // Known malicious
        { name: 'lodash', version: '4.17.21' },
      ];

      const findings = service.detectMaliciousPackages(packages);

      expect(findings.length).toBe(1);
      expect(findings[0].package).toBe('event-stream');
      expect(findings[0].info.severity).toBe('critical');
    });

    it('should detect typosquatting attempts', async () => {
      const packageNames = [
        'react',
        'reac',          // Typo of react
        'express',
        'exprss',        // Typo of express
        'lodahs',        // Typo of lodash
        'unrelated-pkg',
      ];

      const alerts = service.detectTyposquatting(packageNames);

      expect(alerts.length).toBeGreaterThanOrEqual(2);
      expect(alerts.some(a => a.legitimate === 'react')).toBe(true);
    });

    it('should classify typosquatting types', async () => {
      // Combo attack: legit + suffix (starts with legit name, longer, no hyphen namespace pattern)
      const comboAlerts = service.detectTyposquatting(['expressjs']);
      expect(comboAlerts.some(a => a.legitimate === 'express' && a.type === 'combo')).toBe(true);

      // Homograph: similar length, one character difference
      const homoAlerts = service.detectTyposquatting(['reaxt']);
      expect(homoAlerts.some(a => a.type === 'homograph')).toBe(true);
    });

    it('should perform full poisoning scan', async () => {
      const packages = [
        { name: 'express', version: '4.18.2' },
        { name: 'event-stream', version: '3.3.6' },
        { name: 'reac', version: '1.0.0' },
        { name: 'colors', version: '1.4.2' },
      ];

      const report = await service.scanDependencyPoisoning('tenant-1', packages);

      expect(report.maliciousPackages.length).toBeGreaterThanOrEqual(1);
      expect(report.typosquattingAlerts.length).toBeGreaterThanOrEqual(0);
      expect(report.riskScore).toBeGreaterThan(0);
      expect(['safe', 'low', 'medium', 'high', 'critical']).toContain(report.riskLevel);
      expect(report.totalPackagesScanned).toBe(4);
    });

    it('should calculate correct risk level', async () => {
      // Safe packages
      const safeReport = await service.scanDependencyPoisoning('tenant-1', [
        { name: 'express', version: '4.18.2' },
        { name: 'lodash', version: '4.17.21' },
      ]);
      expect(safeReport.riskLevel).toBe('safe');

      // Critical packages
      const criticalReport = await service.scanDependencyPoisoning('tenant-1', [
        { name: 'event-stream', version: '3.3.6' },
        { name: 'node-ipc', version: '11.0.0' },
        { name: 'ua-parser-js', version: '0.7.29' },
      ]);
      expect(criticalReport.riskLevel).toBe('critical');
    });
  });

  describe('E2E: Signature Verification', () => {
    it('should verify a valid signature', async () => {
      // Insert a signature first
      await mockDb.query(
        `INSERT INTO artifact_signatures (id, tenant_id, artifact_id, signature, signed_by, signed_at, verified) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['sig-1', 'tenant-1', 'artifact-123', 'sha256:abc123', 'signer@example.com', new Date(), false]
      );

      const result = await service.verifySignature('artifact-123', 'sha256:abc123');
      expect(result.verified).toBe(true);
      expect(result.signedBy).toBe('signer@example.com');
    });

    it('should reject invalid signature', async () => {
      const result = await service.verifySignature('artifact-123', 'sha256:wrong');
      expect(result.verified).toBe(false);
      expect(result.reason).toBe('Signature not found');
    });
  });

  describe('E2E: Supply Chain Report & Dashboard', () => {
    it('should generate supply chain report', async () => {
      // Generate some SBOMs
      await service.generateSBOM('tenant-1', {
        artifactId: 'artifact-1',
        pipelineId: 'pipeline-1',
        components: [{ name: 'dep', version: '1.0.0' }],
      });

      const report = await service.getSupplyChainReport('tenant-1', 'pipeline-1');
      expect(report.totalSboms).toBeGreaterThanOrEqual(1);
    });

    it('should generate security score dashboard', async () => {
      // No data scenario
      const dashboard = await service.getSecurityScoreDashboard('tenant-1');

      expect(dashboard.overall_score).toBeGreaterThanOrEqual(0);
      expect(dashboard.overall_score).toBeLessThanOrEqual(100);
      expect(dashboard.components).toBeDefined();
      expect(dashboard.recommendations).toBeDefined();
      expect(dashboard.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide healthy recommendations when security posture is good', async () => {
      // Insert SBOMs and verified signatures
      await service.generateSBOM('tenant-1', {
        artifactId: 'artifact-1',
        components: [{ name: 'dep', version: '1.0.0' }],
      });

      // Insert a verified signature
      await mockDb.query(
        `INSERT INTO artifact_signatures (id, tenant_id, artifact_id, signature, signed_by, signed_at, verified) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['sig-1', 'tenant-1', 'artifact-1', 'sha256:verified', 'signer', new Date(), true]
      );

      // No critical poisoning findings
      const dashboard = await service.getSecurityScoreDashboard('tenant-1');
      expect(dashboard.alerts.critical_poison_findings).toBe(0);
    });
  });
});
