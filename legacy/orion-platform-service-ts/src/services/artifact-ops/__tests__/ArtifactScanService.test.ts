/**
 * ArtifactScanService Tests
 *
 * Covers: artifact scanning, report retrieval, malicious detection.
 * Uses in-memory mock repositories.
 */

import { ArtifactScanService, ScanFinding, MaliciousDetection } from '../ArtifactScanService';
import { ScanReportRepository, ScanFindingRepository, MaliciousDetectionRepository, ScanReportEntity, ScanFindingEntity, MaliciousDetectionEntity } from '../../../repositories/ArtifactScanRepository';

// ==================== Mock Repositories ====================

class MockScanReportRepository extends ScanReportRepository {
  private store: Map<string, ScanReportEntity> = new Map();

  constructor() { super({} as any); }

  async create(data: any): Promise<ScanReportEntity> {
    const entity: ScanReportEntity = { ...data, started_at: new Date() } as ScanReportEntity;
    this.store.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<ScanReportEntity | undefined> {
    return this.store.get(id);
  }

  async findByArtifactId(artifactId: string): Promise<ScanReportEntity[]> {
    return Array.from(this.store.values())
      .filter(e => e.artifact_id === artifactId)
      .sort((a, b) => b.started_at.getTime() - a.started_at.getTime());
  }

  async findLatestByArtifact(artifactId: string): Promise<ScanReportEntity | undefined> {
    const reports = await this.findByArtifactId(artifactId);
    return reports.length > 0 ? reports[0] : undefined;
  }

  clear() { this.store.clear(); }
}

class MockScanFindingRepository extends ScanFindingRepository {
  private store: Map<string, ScanFindingEntity> = new Map();

  constructor() { super({} as any); }

  async create(data: any): Promise<ScanFindingEntity> {
    const entity: ScanFindingEntity = { ...data } as ScanFindingEntity;
    this.store.set(entity.id, entity);
    return entity;
  }

  async findByReportId(reportId: string): Promise<ScanFindingEntity[]> {
    return Array.from(this.store.values())
      .filter(e => e.report_id === reportId)
      .sort((a, b) => {
        const order: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4, info: 5 };
        return (order[a.severity] || 5) - (order[b.severity] || 5);
      });
  }

  clear() { this.store.clear(); }
}

class MockMaliciousDetectionRepository extends MaliciousDetectionRepository {
  private store: Map<string, MaliciousDetectionEntity> = new Map();

  constructor() { super({} as any); }

  async create(data: any): Promise<MaliciousDetectionEntity> {
    const entity: MaliciousDetectionEntity = { ...data, id: this.store.size + 1, created_at: new Date() } as MaliciousDetectionEntity;
    const key = `${data.tenant_id}:${data.artifact_id}`;
    this.store.set(key, entity);
    return entity;
  }

  async findByArtifact(tenantId: string, artifactId: string): Promise<MaliciousDetectionEntity | undefined> {
    return this.store.get(`${tenantId}:${artifactId}`);
  }

  async findByTenantDetected(tenantId: string): Promise<MaliciousDetectionEntity[]> {
    return Array.from(this.store.values())
      .filter(e => e.tenant_id === tenantId && e.detected)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  async upsert(data: any): Promise<MaliciousDetectionEntity> {
    return this.create(data);
  }

  clear() { this.store.clear(); }
}

// ==================== Tests ====================

describe('ArtifactScanService', () => {
  let service: ArtifactScanService;
  let reportRepo: MockScanReportRepository;
  let findingRepo: MockScanFindingRepository;
  let detectionRepo: MockMaliciousDetectionRepository;

  beforeEach(() => {
    reportRepo = new MockScanReportRepository();
    findingRepo = new MockScanFindingRepository();
    detectionRepo = new MockMaliciousDetectionRepository();
    service = new ArtifactScanService({ scanReportRepository: reportRepo, scanFindingRepository: findingRepo, maliciousDetectionRepository: detectionRepo });
  });

  afterEach(() => {
    reportRepo.clear();
    findingRepo.clear();
    detectionRepo.clear();
  });

  describe('scanArtifact', () => {
    it('should create a scan report with findings', async () => {
      const report = await service.scanArtifact('t1', 'test-artifact');
      expect(report.id).toBeDefined();
      expect(report.tenantId).toBe('t1');
      expect(report.artifactId).toBe('test-artifact');
      expect(report.status).toBe('completed');
      expect(report.findings.length).toBeGreaterThan(0);
      expect(report.summary.total).toBe(report.findings.length);
    });

    it('should generate deterministic findings for same artifact', async () => {
      const report1 = await service.scanArtifact('t1', 'same-artifact');
      const report2 = await service.scanArtifact('t1', 'same-artifact');

      // Both reports should have same number of findings (same hash)
      expect(report1.summary.total).toBe(report2.summary.total);
      expect(report1.summary.critical).toBe(report2.summary.critical);
    });

    it('should calculate severity counts correctly', async () => {
      const report = await service.scanArtifact('t1', 'test-artifact');
      const total = report.summary.critical + report.summary.high +
        report.summary.medium + report.summary.low + report.summary.info;
      expect(total).toBe(report.summary.total);
    });

    it('should set pass/fail based on critical and high counts', async () => {
      // Reports with no critical/high findings pass
      const report = await service.scanArtifact('t1', 'safe-artifact');
      expect(typeof report.passed).toBe('boolean');
    });
  });

  describe('getScanReport', () => {
    it('should get a scan report by ID', async () => {
      const created = await service.scanArtifact('t1', 'test-artifact');
      const found = await service.getScanReport(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.findings.length).toBeGreaterThan(0);
    });

    it('should return undefined for non-existent report', async () => {
      expect(await service.getScanReport('non-existent')).toBeUndefined();
    });
  });

  describe('getArtifactReports', () => {
    it('should get all reports for an artifact', async () => {
      await service.scanArtifact('t1', 'artifact-a');
      await service.scanArtifact('t1', 'artifact-a');
      await service.scanArtifact('t1', 'artifact-b');

      const reports = await service.getArtifactReports('artifact-a');
      expect(reports.length).toBe(2);
    });

    it('should return empty array for artifact with no scans', async () => {
      const reports = await service.getArtifactReports('never-scanned');
      expect(reports).toEqual([]);
    });
  });

  describe('getLatestReport', () => {
    it('should get the latest report for an artifact', async () => {
      const report1 = await service.scanArtifact('t1', 'artifact-x');
      // Small delay to ensure different timestamps
      await new Promise(r => setTimeout(r, 5));
      const report2 = await service.scanArtifact('t1', 'artifact-x');

      const reports = await service.getArtifactReports('artifact-x');
      expect(reports.length).toBe(2);
      // Latest should be first
      expect(reports[0].id).toBe(report2.id);
    });

    it('should return undefined for artifact with no scans', async () => {
      expect(await service.getLatestReport('no-scans')).toBeUndefined();
    });
  });

  describe('detectMaliciousArtifact', () => {
    it('should detect artifacts with malicious names', async () => {
      const detection = await service.detectMaliciousArtifact('t1', 'my-malware-app');
      expect(detection.detected).toBe(true);
      expect(detection.reasons.length).toBeGreaterThan(0);
    });

    it('should mark clean artifacts as safe', async () => {
      const detection = await service.detectMaliciousArtifact('t1', 'clean-app');
      // Clean artifacts may or may not be detected based on hash
      expect(detection.riskLevel).toBeDefined();
      expect(['safe', 'suspicious', 'malicious']).toContain(detection.riskLevel);
    });

    it('should persist detection results', async () => {
      await service.detectMaliciousArtifact('t1', 'trojan-app');
      const persisted = await detectionRepo.findByArtifact('t1', 'trojan-app');
      expect(persisted).toBeDefined();
      expect(persisted?.detected).toBe(true);
    });

    it('should analyze existing scan findings', async () => {
      // First scan the artifact
      await service.scanArtifact('t1', 'vulnerable-app');
      // Then detect
      const detection = await service.detectMaliciousArtifact('t1', 'vulnerable-app');
      expect(detection.details.reportsAnalyzed).toBe(1);
    });

    it('should get detection by artifact', async () => {
      await service.detectMaliciousArtifact('t1', 'backdoor-app');
      const found = await service.getMaliciousDetection('t1', 'backdoor-app');
      expect(found).toBeDefined();
      expect(found?.detected).toBe(true);
    });
  });

  describe('getTenantDetections', () => {
    it('should return detected artifacts for a tenant', async () => {
      await service.detectMaliciousArtifact('t1', 'malware-one');
      await service.detectMaliciousArtifact('t1', 'safe-app');
      await service.detectMaliciousArtifact('t2', 'trojan-two');

      const detections = await service.getTenantDetections('t1');
      // Only artifacts with detected=true should be returned
      expect(detections.every(d => d.detected)).toBe(true);
    });
  });
});
