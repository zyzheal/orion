/**
 * SbomDocumentService 单元测试
 */

import { SbomDocumentService } from '../SbomDocumentService';

// Mock repositories
const mockDocRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  list: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByBuildId: jest.fn(),
  findByPipelineRunId: jest.fn(),
  incrementPackageCount: jest.fn(),
};

const mockPkgRepo = {
  create: jest.fn(),
  findBySbomId: jest.fn(),
  deleteBySbomId: jest.fn(),
};

const mockAttRepo = {
  create: jest.fn(),
  findBySbomId: jest.fn(),
  findById: jest.fn(),
  verify: jest.fn(),
  deleteBySbomId: jest.fn(),
};

const mockVulnRepo = {
  findBySbomId: jest.fn(),
  findByCveId: jest.fn(),
  updateStatus: jest.fn(),
  getDb: jest.fn(),
  mapEntity: jest.fn(),
};

describe('SbomDocumentService', () => {
  let service: SbomDocumentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SbomDocumentService();
    service.setRepositories(mockDocRepo as any, mockPkgRepo as any, mockAttRepo as any, mockVulnRepo as any);
  });

  describe('constructor', () => {
    it('should create service without db', () => {
      const svc = new SbomDocumentService();
      expect(svc).toBeDefined();
    });

    it('should create service with db', () => {
      const mockDb = { query: jest.fn() };
      const svc = new SbomDocumentService(mockDb as any);
      expect(svc).toBeDefined();
    });
  });

  describe('setRepositories', () => {
    it('should set all repositories', () => {
      const svc = new SbomDocumentService();
      svc.setRepositories(mockDocRepo as any, mockPkgRepo as any, mockAttRepo as any);
      expect(svc).toBeDefined();
    });

    it('should set repositories without vulnRepo', () => {
      const svc = new SbomDocumentService();
      svc.setRepositories(mockDocRepo as any, mockPkgRepo as any, mockAttRepo as any);
      // Should not throw
      expect(svc).toBeDefined();
    });
  });

  describe('create', () => {
    it('should create a document with repo', async () => {
      const mockDoc = {
        id: 'doc-1',
        buildId: 'build-1',
        pipelineRunId: 'run-1',
        format: 'cyclonedx',
        specVersion: '1.4',
        documentId: 'doc-1',
        content: { components: [] },
        packageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
        status: 'created',
      };
      mockDocRepo.create.mockResolvedValue(mockDoc);

      const result = await service.create({
        buildId: 'build-1',
        pipelineRunId: 'run-1',
        format: 'cyclonedx',
        specVersion: '1.4',
        documentId: 'doc-1',
        content: { components: [] },
      });

      expect(result.id).toBe('doc-1');
      expect(result.buildId).toBe('build-1');
      expect(mockDocRepo.create).toHaveBeenCalled();
    });

    it('should create mock document without repo', async () => {
      const svc = new SbomDocumentService();
      const result = await svc.create({
        buildId: 'build-1',
        pipelineRunId: 'run-1',
        format: 'cyclonedx',
        specVersion: '1.4',
        documentId: 'doc-1',
        content: { components: [] },
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe('created');
    });
  });

  describe('getById', () => {
    it('should get document by id', async () => {
      const mockDoc = { id: 'doc-1', buildId: 'build-1' };
      mockDocRepo.findById.mockResolvedValue(mockDoc);

      const result = await service.getById('doc-1');

      expect(result).toEqual(mockDoc);
      expect(mockDocRepo.findById).toHaveBeenCalledWith('doc-1');
    });

    it('should return null if not found', async () => {
      mockDocRepo.findById.mockResolvedValue(undefined);

      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null without repo', async () => {
      const svc = new SbomDocumentService();
      const result = await svc.getById('doc-1');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list documents with filter', async () => {
      const mockResult = {
        documents: [{ id: 'doc-1' }, { id: 'doc-2' }],
        total: 2,
      };
      mockDocRepo.list.mockResolvedValue(mockResult);

      const result = await service.list({ buildId: 'build-1' });

      expect(result.total).toBe(2);
      expect(result.documents.length).toBe(2);
    });

    it('should return empty list without repo', async () => {
      const svc = new SbomDocumentService();
      const result = await svc.list();
      expect(result).toEqual({ documents: [], total: 0 });
    });
  });

  describe('listSboms', () => {
    it('should list sboms by tenant id', async () => {
      mockDocRepo.list.mockResolvedValue({
        documents: [{ id: 'doc-1' }],
        total: 1,
      });

      const result = await service.listSboms('tenant-1');

      expect(result.length).toBe(1);
    });

    it('should return empty array without repo', async () => {
      const svc = new SbomDocumentService();
      const result = await svc.listSboms('tenant-1');
      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update document', async () => {
      const mockUpdated = { id: 'doc-1', status: 'published' };
      mockDocRepo.update.mockResolvedValue(mockUpdated);

      const result = await service.update('doc-1', { status: 'published' });

      expect(result).toEqual(mockUpdated);
      expect(mockDocRepo.update).toHaveBeenCalledWith('doc-1', { status: 'published' });
    });

    it('should return null if update throws', async () => {
      mockDocRepo.update.mockRejectedValue(new Error('Not found'));

      const result = await service.update('nonexistent', { status: 'published' });

      expect(result).toBeNull();
    });

    it('should return null without repo', async () => {
      const svc = new SbomDocumentService();
      const result = await svc.update('doc-1', { status: 'published' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete document and associated data', async () => {
      mockPkgRepo.deleteBySbomId.mockResolvedValue(true);
      mockAttRepo.deleteBySbomId.mockResolvedValue(true);
      mockDocRepo.delete.mockResolvedValue(true);

      const result = await service.delete('doc-1');

      expect(result).toBe(true);
      expect(mockPkgRepo.deleteBySbomId).toHaveBeenCalledWith('doc-1');
      expect(mockAttRepo.deleteBySbomId).toHaveBeenCalledWith('doc-1');
      expect(mockDocRepo.delete).toHaveBeenCalledWith('doc-1');
    });

    it('should return false if delete fails', async () => {
      mockPkgRepo.deleteBySbomId.mockResolvedValue(true);
      mockAttRepo.deleteBySbomId.mockResolvedValue(true);
      mockDocRepo.delete.mockResolvedValue(false);

      const result = await service.delete('doc-1');

      expect(result).toBe(false);
    });

    it('should return false without repo', async () => {
      const svc = new SbomDocumentService();
      const result = await svc.delete('doc-1');
      expect(result).toBe(false);
    });
  });

  describe('addPackage', () => {
    it('should add package to sbom', async () => {
      const mockPkg = {
        id: 'pkg-1',
        sbomId: 'doc-1',
        name: 'express',
        version: '4.18.2',
        purl: 'pkg:npm/express@4.18.2',
        cpe: null,
        license: 'MIT',
        supplier: null,
        sourceLocation: null,
        checksum: null,
      };
      mockPkgRepo.create.mockResolvedValue(mockPkg);
      mockDocRepo.incrementPackageCount.mockResolvedValue(1);

      const result = await service.addPackage({
        sbomId: 'doc-1',
        name: 'express',
        version: '4.18.2',
        purl: 'pkg:npm/express@4.18.2',
        license: 'MIT',
      });

      expect(result.name).toBe('express');
      expect(mockPkgRepo.create).toHaveBeenCalled();
      expect(mockDocRepo.incrementPackageCount).toHaveBeenCalledWith('doc-1');
    });

    it('should return mock package without repo', async () => {
      const svc = new SbomDocumentService();
      const result = await svc.addPackage({
        sbomId: 'doc-1',
        name: 'lodash',
        version: '4.17.21',
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe('lodash');
    });
  });

  describe('getPackages', () => {
    it('should get packages for sbom', async () => {
      mockPkgRepo.findBySbomId.mockResolvedValue([
        { id: 'pkg-1', name: 'express' },
        { id: 'pkg-2', name: 'lodash' },
      ]);

      const result = await service.getPackages('doc-1');

      expect(result.length).toBe(2);
      expect(mockPkgRepo.findBySbomId).toHaveBeenCalledWith('doc-1');
    });

    it('should return empty array without repo', async () => {
      const svc = new SbomDocumentService();
      const result = await svc.getPackages('doc-1');
      expect(result).toEqual([]);
    });
  });

  describe('createAttestation', () => {
    it('should create attestation', async () => {
      const mockAtt = {
        id: 'att-1',
        sbomId: 'doc-1',
        attestationType: 'provenance',
        signature: 'sig-123',
        certificate: null,
        transparencyLogUrl: null,
        signedAt: new Date(),
        verified: false,
        verifiedAt: null,
      };
      mockAttRepo.create.mockResolvedValue(mockAtt);

      const result = await service.createAttestation({
        sbomId: 'doc-1',
        attestationType: 'provenance',
        signature: 'sig-123',
      });

      expect(result.id).toBe('att-1');
      expect(mockAttRepo.create).toHaveBeenCalled();
    });

    it('should return mock attestation without repo', async () => {
      const svc = new SbomDocumentService();
      const result = await svc.createAttestation({
        sbomId: 'doc-1',
        attestationType: 'provenance',
        signature: 'sig-123',
      });

      expect(result.id).toBeDefined();
      expect(result.verified).toBe(false);
    });
  });

  describe('getAttestationBySbomId', () => {
    it('should get attestation by sbom id', async () => {
      mockAttRepo.findBySbomId.mockResolvedValue({ id: 'att-1', sbomId: 'doc-1' });

      const result = await service.getAttestationBySbomId('doc-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('att-1');
    });

    it('should return null if no attestation', async () => {
      mockAttRepo.findBySbomId.mockResolvedValue(undefined);

      const result = await service.getAttestationBySbomId('doc-1');

      expect(result).toBeNull();
    });

    it('should return null without repo', async () => {
      const svc = new SbomDocumentService();
      const result = await svc.getAttestationBySbomId('doc-1');
      expect(result).toBeNull();
    });
  });

  describe('verifyAttestation', () => {
    it('should verify attestation', async () => {
      const mockVerified = { id: 'att-1', verified: true, verifiedAt: new Date() };
      mockAttRepo.verify.mockResolvedValue(mockVerified);

      const result = await service.verifyAttestation('att-1');

      expect(result).toBeDefined();
      expect(result!.verified).toBe(true);
      expect(mockAttRepo.verify).toHaveBeenCalledWith('att-1');
    });

    it('should return null if verification fails', async () => {
      mockAttRepo.verify.mockResolvedValue(undefined);

      const result = await service.verifyAttestation('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null without repo', async () => {
      const svc = new SbomDocumentService();
      const result = await svc.verifyAttestation('att-1');
      expect(result).toBeNull();
    });
  });

  describe('findByBuildId', () => {
    it('should find documents by build id', async () => {
      mockDocRepo.findByBuildId.mockResolvedValue([{ id: 'doc-1' }]);

      const result = await service.findByBuildId('build-1');

      expect(result.length).toBe(1);
      expect(mockDocRepo.findByBuildId).toHaveBeenCalledWith('build-1');
    });

    it('should return empty array without repo', async () => {
      const svc = new SbomDocumentService();
      const result = await svc.findByBuildId('build-1');
      expect(result).toEqual([]);
    });
  });

  describe('findByPipelineRunId', () => {
    it('should find documents by pipeline run id', async () => {
      mockDocRepo.findByPipelineRunId.mockResolvedValue([{ id: 'doc-1' }]);

      const result = await service.findByPipelineRunId('run-1');

      expect(result.length).toBe(1);
      expect(mockDocRepo.findByPipelineRunId).toHaveBeenCalledWith('run-1');
    });

    it('should return empty array without repo', async () => {
      const svc = new SbomDocumentService();
      const result = await svc.findByPipelineRunId('run-1');
      expect(result).toEqual([]);
    });
  });

  describe('getVulnerabilities', () => {
    it('should get vulnerabilities with packages', async () => {
      mockVulnRepo.findBySbomId.mockResolvedValue([
        { id: 'vuln-1', packageName: 'log4j', severity: 'critical' },
      ]);
      mockPkgRepo.findBySbomId.mockResolvedValue([
        { id: 'pkg-1', name: 'log4j' },
      ]);

      const result = await service.getVulnerabilities('doc-1');

      expect(result.length).toBe(1);
      expect(result[0].vulnerability.id).toBe('vuln-1');
      expect(result[0].package).toBeDefined();
    });

    it('should return empty array without repos', async () => {
      const svc = new SbomDocumentService();
      const result = await svc.getVulnerabilities('doc-1');
      expect(result).toEqual([]);
    });
  });

  describe('getVulnerabilitySummary', () => {
    it('should return vulnerability summary', async () => {
      mockVulnRepo.findBySbomId.mockResolvedValue([
        { severity: 'critical' },
        { severity: 'critical' },
        { severity: 'high' },
        { severity: 'medium' },
        { severity: 'low' },
        { severity: 'unknown' },
      ]);

      const result = await service.getVulnerabilitySummary('doc-1');

      expect(result.critical).toBe(2);
      expect(result.high).toBe(1);
      expect(result.medium).toBe(1);
      expect(result.low).toBe(1);
      expect(result.unknown).toBe(1);
      expect(result.total).toBe(6);
    });

    it('should return zero summary without repo', async () => {
      const svc = new SbomDocumentService();
      const result = await svc.getVulnerabilitySummary('doc-1');
      expect(result).toEqual({ critical: 0, high: 0, medium: 0, low: 0, unknown: 0, total: 0 });
    });

    it('should handle null severity as unknown', async () => {
      mockVulnRepo.findBySbomId.mockResolvedValue([
        { severity: null },
      ]);

      const result = await service.getVulnerabilitySummary('doc-1');

      expect(result.unknown).toBe(1);
      expect(result.total).toBe(1);
    });
  });

  describe('updateVulnerabilityStatus', () => {
    it('should update vulnerability status', async () => {
      mockVulnRepo.updateStatus.mockResolvedValue(undefined);

      const result = await service.updateVulnerabilityStatus('vuln-1', 'fixed');

      expect(result).toBe(true);
      expect(mockVulnRepo.updateStatus).toHaveBeenCalledWith('vuln-1', 'fixed');
    });

    it('should return false without repo', async () => {
      const svc = new SbomDocumentService();
      const result = await svc.updateVulnerabilityStatus('vuln-1', 'fixed');
      expect(result).toBe(false);
    });
  });

  describe('findByCveId', () => {
    it('should find vulnerabilities by cve id', async () => {
      mockVulnRepo.findByCveId.mockResolvedValue([{ id: 'vuln-1', cveId: 'CVE-2021-44228' }]);

      const result = await service.findByCveId('CVE-2021-44228');

      expect(result.length).toBe(1);
      expect(mockVulnRepo.findByCveId).toHaveBeenCalledWith('CVE-2021-44228');
    });

    it('should return empty array without repo', async () => {
      const svc = new SbomDocumentService();
      const result = await svc.findByCveId('CVE-2021-44228');
      expect(result).toEqual([]);
    });
  });

  describe('compliance reports', () => {
    it('should get compliance report', async () => {
      const result = await service.getComplianceReport('EO14028');

      expect(result.standard).toBe('EO14028');
      expect(result.compliant).toBe(true);
    });

    it('should get EO14028 compliance', async () => {
      const result = await service.getEO14028Compliance('tenant-1');

      expect(result.standard).toBe('EO14028');
    });

    it('should get EU CRA compliance', async () => {
      const result = await service.getEUCRACompliance('tenant-1');

      expect(result.standard).toBe('EU-CRA');
    });
  });

  describe('provenance', () => {
    it('should create provenance record', async () => {
      const result = await service.createProvenance({
        sbomId: 'doc-1',
        buildUrl: 'https://ci.example.com/build/1',
        builderId: 'builder-1',
        buildFinishedAt: new Date(),
        materials: [{ uri: 'git://repo', digest: { sha256: 'abc123' } }],
      });

      expect(result.id).toBeDefined();
      expect(result.sbomId).toBe('doc-1');
    });

    it('should list provenance records', async () => {
      const result = await service.listProvenance('doc-1');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should verify provenance', async () => {
      const result = await service.verifyProvenance('prov-1');

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('gate evaluation', () => {
    it('should evaluate gate', async () => {
      const result = await service.evaluateGate('gate-1', 'doc-1');

      expect(result.gateId).toBe('gate-1');
      expect(result.passed).toBe(true);
    });

    it('should get gate history', async () => {
      const result = await service.getGateHistory('doc-1');

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
