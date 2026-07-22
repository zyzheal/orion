/**
 * SbomDocument 模型测试
 */
import {
  createSbomDocument,
  createSbomPackage,
  createSbomAttestation,
  createSbomVulnerabilityResult,
  createSbomVulnerabilityDetail,
  createSbomWaiver,
} from '../SbomDocument';

describe('SbomDocument', () => {
  describe('createSbomDocument', () => {
    it('should create document with defaults', () => {
      const doc = createSbomDocument({
        buildId: 'build-1',
        pipelineRunId: 'run-1',
        format: 'spdx',
        specVersion: '2.3',
        documentId: 'SPDXRef-DOCUMENT',
        content: { packages: [] },
      });

      expect(doc.id).toBeDefined();
      expect(doc.buildId).toBe('build-1');
      expect(doc.format).toBe('spdx');
      expect(doc.specVersion).toBe('2.3');
      expect(doc.packageCount).toBe(0);
      expect(doc.status).toBe('active');
      expect(doc.createdAt).toBeInstanceOf(Date);
      expect(doc.updatedAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const doc = createSbomDocument({
        buildId: 'b1',
        pipelineRunId: 'r1',
        format: 'cyclonedx',
        specVersion: '1.5',
        documentId: 'CDX-1',
        content: {},
        packageCount: 10,
        expiresAt: new Date('2030-01-01'),
      });

      expect(doc.format).toBe('cyclonedx');
      expect(doc.packageCount).toBe(10);
      expect(doc.expiresAt).toBeDefined();
    });
  });

  describe('createSbomPackage', () => {
    it('should create package', () => {
      const pkg = createSbomPackage({
        sbomId: 'sbom-1',
        name: 'lodash',
        version: '4.17.21',
      });

      expect(pkg.id).toBeDefined();
      expect(pkg.sbomId).toBe('sbom-1');
      expect(pkg.name).toBe('lodash');
      expect(pkg.version).toBe('4.17.21');
    });

    it('should accept optional fields', () => {
      const pkg = createSbomPackage({
        sbomId: 's1',
        name: 'express',
        version: '4.18.0',
        purl: 'pkg:npm/express@4.18.0',
        cpe: 'cpe:2.3:a:express:express:4.18.0:*:*:*:*:*:*:*',
        license: 'MIT',
        supplier: 'Express Team',
        sourceLocation: '/app/node_modules/express',
        checksum: 'sha256:abc',
      });

      expect(pkg.purl).toBe('pkg:npm/express@4.18.0');
      expect(pkg.license).toBe('MIT');
    });
  });

  describe('createSbomAttestation', () => {
    it('should create attestation', () => {
      const att = createSbomAttestation({
        sbomId: 'sbom-1',
        attestationType: 'sigstore-cosign',
        signature: 'MEUCIQD...',
      });

      expect(att.id).toBeDefined();
      expect(att.sbomId).toBe('sbom-1');
      expect(att.attestationType).toBe('sigstore-cosign');
      expect(att.verified).toBe(false);
      expect(att.signedAt).toBeInstanceOf(Date);
    });

    it('should accept optional fields', () => {
      const att = createSbomAttestation({
        sbomId: 's1',
        attestationType: 'in-toto',
        signature: 'sig',
        certificate: 'cert',
        transparencyLogUrl: 'https://rekor.example.com',
      });

      expect(att.attestationType).toBe('in-toto');
      expect(att.certificate).toBe('cert');
    });
  });

  describe('createSbomVulnerabilityResult', () => {
    it('should create result with no vulnerabilities', () => {
      const result = createSbomVulnerabilityResult({ sbomId: 's1' }, []);

      expect(result.id).toBeDefined();
      expect(result.totalVulns).toBe(0);
      expect(result.criticalCount).toBe(0);
      expect(result.gatePassed).toBe(true);
      expect(result.scanner).toBe('grype');
    });

    it('should count vulnerabilities by severity', () => {
      const details = [
        createSbomVulnerabilityDetail('r1', {
          cveId: 'CVE-1', severity: 'critical', affectedPackage: 'pkg1',
        }),
        createSbomVulnerabilityDetail('r1', {
          cveId: 'CVE-2', severity: 'high', affectedPackage: 'pkg2',
        }),
        createSbomVulnerabilityDetail('r1', {
          cveId: 'CVE-3', severity: 'medium', affectedPackage: 'pkg3',
        }),
        createSbomVulnerabilityDetail('r1', {
          cveId: 'CVE-4', severity: 'low', affectedPackage: 'pkg4',
        }),
      ];

      const result = createSbomVulnerabilityResult({ sbomId: 's1' }, details);

      expect(result.totalVulns).toBe(4);
      expect(result.criticalCount).toBe(1);
      expect(result.highCount).toBe(1);
      expect(result.mediumCount).toBe(1);
      expect(result.lowCount).toBe(1);
    });

    it('should enforce block-critical gate policy', () => {
      const details = [
        createSbomVulnerabilityDetail('r1', {
          cveId: 'CVE-1', severity: 'critical', affectedPackage: 'p1',
        }),
      ];

      const result = createSbomVulnerabilityResult(
        { sbomId: 's1', gatePolicy: 'block-critical' }, details
      );

      expect(result.gatePassed).toBe(false);
    });

    it('should enforce block-critical-high gate policy', () => {
      const details = [
        createSbomVulnerabilityDetail('r1', {
          cveId: 'CVE-1', severity: 'high', affectedPackage: 'p1',
        }),
      ];

      const result = createSbomVulnerabilityResult(
        { sbomId: 's1', gatePolicy: 'block-critical-high' }, details
      );

      expect(result.gatePassed).toBe(false);
    });
  });

  describe('createSbomWaiver', () => {
    it('should create waiver', () => {
      const waiver = createSbomWaiver({
        cveId: 'CVE-2024-1234',
        packageName: 'lodash',
        packageVersion: '4.17.20',
        reason: 'Not exploitable in our context',
        approvedBy: 'security-team',
        expiresAt: new Date('2030-01-01'),
      });

      expect(waiver.id).toBeDefined();
      expect(waiver.cveId).toBe('CVE-2024-1234');
      expect(waiver.scope).toBe('global');
      expect(waiver.approvedAt).toBeInstanceOf(Date);
    });

    it('should accept custom scope', () => {
      const waiver = createSbomWaiver({
        cveId: 'CVE-1',
        packageName: 'pkg',
        packageVersion: '1.0',
        reason: 'r',
        approvedBy: 'admin',
        expiresAt: new Date(),
        scope: 'project',
        scopeTarget: 'proj-1',
      });

      expect(waiver.scope).toBe('project');
      expect(waiver.scopeTarget).toBe('proj-1');
    });
  });
});
