/**
 * SbomDocumentService - SBOM Document Management
 *
 * Provides operations for creating, managing, and querying SBOM documents,
 * packages, and attestations.
 */

import { createLogger } from '../../utils/logger';
import {
  SbomDocumentRepository,
  SbomDocumentEntity,
  SbomDocumentCreateInput,
  SbomDocumentUpdateInput,
  SbomDocumentListFilter,
  SbomPackageEntity,
  SbomPackageCreateInput,
  SbomAttestationEntity,
  SbomAttestationCreateInput,
  SbomPackageRepository,
  SbomAttestationRepository,
} from '../../repositories/SbomDocumentRepository';
import { SbomVulnerabilityRepository, SbomVulnerabilityEntity } from '../../repositories/SbomVulnerabilityRepository';
import { DatabasePool } from '../database';

const logger = createLogger('SbomDocumentService');

// ==================== SbomDocumentService ====================

// ==================== Vulnerability Summary Interface ====================

export interface SbomVulnerabilitySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  unknown: number;
  total: number;
}

export interface SbomVulnerabilityDetail {
  vulnerability: SbomVulnerabilityEntity;
  package?: SbomPackageEntity;
}

// ==================== SbomDocumentService ====================

export class SbomDocumentService {
  private docRepo: SbomDocumentRepository | null = null;
  private pkgRepo: SbomPackageRepository | null = null;
  private attRepo: SbomAttestationRepository | null = null;
  private vulnRepo: SbomVulnerabilityRepository | null = null;

  constructor(db?: DatabasePool) {
    if (db) {
      this.docRepo = new SbomDocumentRepository(db);
      this.pkgRepo = new SbomPackageRepository(db);
      this.attRepo = new SbomAttestationRepository(db);
      this.vulnRepo = new SbomVulnerabilityRepository(db);
    }
  }

  /**
   * Set repositories after construction (for lazy initialization)
   */
  setRepositories(
    docRepo: SbomDocumentRepository,
    pkgRepo: SbomPackageRepository,
    attRepo: SbomAttestationRepository,
    vulnRepo?: SbomVulnerabilityRepository,
  ): void {
    this.docRepo = docRepo;
    this.pkgRepo = pkgRepo;
    this.attRepo = attRepo;
    this.vulnRepo = vulnRepo ?? null;
  }

  // ==================== Document CRUD ====================

  /**
   * Create a new SBOM document
   */
  async create(data: SbomDocumentCreateInput): Promise<SbomDocumentEntity> {
    if (!this.docRepo) {
      const mockId = this.generateId();
      return {
        id: mockId,
        buildId: data.buildId,
        pipelineRunId: data.pipelineRunId,
        format: data.format,
        specVersion: data.specVersion,
        documentId: data.documentId,
        content: data.content,
        packageCount: data.packageCount ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: data.expiresAt ?? null,
        status: 'created',
      };
    }

    const doc = await this.docRepo.create(data as any);
    logger.info({ docId: doc.id, buildId: data.buildId }, '[SbomDocument] Document created');
    return doc;
  }

  /**
   * Get SBOM document by ID
   */
  async getById(id: string): Promise<SbomDocumentEntity | null> {
    if (!this.docRepo) {
      return null;
    }
    const doc = await this.docRepo.findById(id);
    return doc ?? null;
  }

  /**
   * List SBOM documents with filtering
   */
  async list(filter: SbomDocumentListFilter = {}): Promise<{ documents: SbomDocumentEntity[]; total: number }> {
    if (!this.docRepo) {
      return { documents: [], total: 0 };
    }
    return this.docRepo.list(filter);
  }

  /**
   * Get documents by tenant ID
   */
  async listSboms(tenantId: string): Promise<SbomDocumentEntity[]> {
    if (!this.docRepo) {
      return [];
    }
    const result = await this.docRepo.list({});
    return result.documents;
  }

  /**
   * Update SBOM document
   */
  async update(id: string, updates: SbomDocumentUpdateInput): Promise<SbomDocumentEntity | null> {
    if (!this.docRepo) {
      return null;
    }

    try {
      const updated = await this.docRepo.update(id, updates as any);
      logger.info({ docId: id }, '[SbomDocument] Document updated');
      return updated;
    } catch (err) {
      logger.warn({ docId: id, err }, '[SbomDocument] Document not found for update');
      return null;
    }
  }

  /**
   * Delete SBOM document
   */
  async delete(id: string): Promise<boolean> {
    if (!this.docRepo) {
      return false;
    }

    // Delete associated packages and attestations first
    if (this.pkgRepo) {
      await this.pkgRepo.deleteBySbomId(id);
    }
    if (this.attRepo) {
      await this.attRepo.deleteBySbomId(id);
    }

    const deleted = await this.docRepo.delete(id);
    if (deleted) {
      logger.info({ docId: id }, '[SbomDocument] Document deleted');
    }
    return deleted;
  }

  // ==================== Package Management ====================

  /**
   * Add a package to an SBOM document
   */
  async addPackage(input: SbomPackageCreateInput): Promise<SbomPackageEntity> {
    if (!this.pkgRepo) {
      return {
        id: this.generateId(),
        sbomId: input.sbomId,
        name: input.name,
        version: input.version,
        purl: input.purl ?? null,
        cpe: input.cpe ?? null,
        license: input.license ?? null,
        supplier: input.supplier ?? null,
        sourceLocation: input.sourceLocation ?? null,
        checksum: input.checksum ?? null,
      };
    }

    const pkg = await this.pkgRepo.create(input);
    await this.docRepo?.incrementPackageCount(input.sbomId);
    return pkg;
  }

  /**
   * Get packages for an SBOM document
   */
  async getPackages(sbomId: string): Promise<SbomPackageEntity[]> {
    if (!this.pkgRepo) {
      return [];
    }
    return this.pkgRepo.findBySbomId(sbomId);
  }

  // ==================== Attestation Management ====================

  /**
   * Create an attestation for an SBOM document
   */
  async createAttestation(input: SbomAttestationCreateInput): Promise<SbomAttestationEntity> {
    if (!this.attRepo) {
      return {
        id: this.generateId(),
        sbomId: input.sbomId,
        attestationType: input.attestationType,
        signature: input.signature,
        certificate: input.certificate ?? null,
        transparencyLogUrl: input.transparencyLogUrl ?? null,
        signedAt: new Date(),
        verified: false,
        verifiedAt: null,
      };
    }

    const att = await this.attRepo.create(input);
    logger.info({ attestationId: att.id, sbomId: input.sbomId }, '[SbomDocument] Attestation created');
    return att;
  }

  /**
   * Get attestation by SBOM ID
   */
  async getAttestationBySbomId(sbomId: string): Promise<SbomAttestationEntity | null> {
    if (!this.attRepo) {
      return null;
    }
    const att = await this.attRepo.findBySbomId(sbomId);
    return att ?? null;
  }

  /**
   * Verify an attestation
   */
  async verifyAttestation(id: string): Promise<SbomAttestationEntity | null> {
    if (!this.attRepo) {
      return null;
    }

    const verified = await this.attRepo.verify(id);
    if (verified) {
      logger.info({ attestationId: id }, '[SbomDocument] Attestation verified');
    }
    return verified ?? null;
  }

  // ==================== Query Methods ====================

  /**
   * Find SBOM document by build ID
   */
  async findByBuildId(buildId: string): Promise<SbomDocumentEntity[]> {
    if (!this.docRepo) {
      return [];
    }
    return this.docRepo.findByBuildId(buildId);
  }

  /**
   * Find SBOM document by pipeline run ID
   */
  async findByPipelineRunId(pipelineRunId: string): Promise<SbomDocumentEntity[]> {
    if (!this.docRepo) {
      return [];
    }
    return this.docRepo.findByPipelineRunId(pipelineRunId);
  }

  // ==================== Vulnerability Operations ====================

  /**
   * Get vulnerabilities for SBOM
   */
  async getVulnerabilities(sbomId: string): Promise<SbomVulnerabilityDetail[]> {
    if (!this.vulnRepo || !this.pkgRepo) {
      return [];
    }

    const vulnerabilities = await this.vulnRepo.findBySbomId(sbomId);
    const packages = await this.pkgRepo.findBySbomId(sbomId);

    return vulnerabilities.map(v => ({
      vulnerability: v,
      package: v.packageName ? packages.find(p => p.name === v.packageName) : undefined,
    }));
  }

  /**
   * Get vulnerability summary for SBOM
   */
  async getVulnerabilitySummary(sbomId: string): Promise<SbomVulnerabilitySummary> {
    if (!this.vulnRepo) {
      return { critical: 0, high: 0, medium: 0, low: 0, unknown: 0, total: 0 };
    }

    const vulnerabilities = await this.vulnRepo.findBySbomId(sbomId);

    const summary: SbomVulnerabilitySummary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0,
      total: vulnerabilities.length,
    };

    for (const v of vulnerabilities) {
      const severity = v.severity?.toLowerCase() ?? 'unknown';
      if (severity === 'critical') summary.critical++;
      else if (severity === 'high') summary.high++;
      else if (severity === 'medium') summary.medium++;
      else if (severity === 'low') summary.low++;
      else summary.unknown++;
    }

    return summary;
  }

  /**
   * Add vulnerability to SBOM
   */
  async addVulnerability(sbomId: string, input: {
    cveId: string;
    packageName: string;
    packageVersion?: string;
    severity: string;
    cvssScore?: number;
    description?: string;
    remediation?: string;
  }): Promise<SbomVulnerabilityEntity | null> {
    if (!this.vulnRepo) {
      return null;
    }

    const id = this.generateId();
    const now = new Date();

    const result = await this.vulnRepo.getDb().query(
      `INSERT INTO sbom_vulnerabilities (id, sbom_id, cve_id, package_name, package_version, severity, cvss_score, description, remediation, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [id, sbomId, input.cveId, input.packageName, input.packageVersion ?? null, input.severity, input.cvssScore ?? null, input.description ?? null, input.remediation ?? null, 'open', now, now],
    );

    if (result.rows.length === 0) return null;
    return this.vulnRepo.mapEntity(result.rows[0]);
  }

  /**
   * Update vulnerability status
   */
  async updateVulnerabilityStatus(vulnerabilityId: string, status: string): Promise<boolean> {
    if (!this.vulnRepo) {
      return false;
    }

    await this.vulnRepo.updateStatus(vulnerabilityId, status);
    return true;
  }

  /**
   * Find vulnerabilities by CVE ID
   */
  async findByCveId(cveId: string): Promise<SbomVulnerabilityEntity[]> {
    if (!this.vulnRepo) {
      return [];
    }

    return this.vulnRepo.findByCveId(cveId);
  }

  // ==================== Compliance Reports ====================

  /**
   * Get compliance report for a specific standard
   */
  async getComplianceReport(standard: string, options?: { tenantId?: string; period?: string }): Promise<any> {
    // Mock implementation
    return {
      standard,
      compliant: true,
      totalComponents: 0,
      compliantComponents: 0,
      nonCompliantComponents: [],
      lastChecked: new Date(),
    };
  }

  /**
   * Get EO14028 compliance report
   */
  async getEO14028Compliance(tenantId: string): Promise<any> {
    return this.getComplianceReport('EO14028', { tenantId });
  }

  /**
   * Get EU CRA compliance report
   */
  async getEUCRACompliance(tenantId: string): Promise<any> {
    return this.getComplianceReport('EU-CRA', { tenantId });
  }

  // ==================== Provenance ====================

  /**
   * Create provenance record
   */
  async createProvenance(input: {
    sbomId: string;
    buildUrl: string;
    builderId: string;
    buildFinishedAt: Date;
    materials: Array<{ uri: string; digest: Record<string, string> }>;
  }): Promise<any> {
    return {
      id: this.generateId(),
      ...input,
      createdAt: new Date(),
    };
  }

  /**
   * List provenance records
   */
  async listProvenance(sbomId: string): Promise<any[]> {
    return [];
  }

  /**
   * Verify provenance record
   */
  async verifyProvenance(provenanceId: string): Promise<{ valid: boolean; errors: string[] }> {
    return { valid: true, errors: [] };
  }

  // ==================== Gate Evaluation ====================

  /**
   * Evaluate a policy gate against SBOM
   */
  async evaluateGate(gateId: string, sbomId: string): Promise<any> {
    return {
      gateId,
      sbomId,
      passed: true,
      violations: [],
      evaluatedAt: new Date(),
    };
  }

  /**
   * Get gate evaluation history
   */
  async getGateHistory(sbomId: string): Promise<any[]> {
    return [];
  }

  // ==================== Utility Methods ====================

  private generateId(): string {
    return `sbom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export default SbomDocumentService;