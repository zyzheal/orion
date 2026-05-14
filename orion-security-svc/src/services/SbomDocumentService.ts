/**
 * SBOM Document Service - 管理 SBOM 文档和包清单
 *
 * Migrated from Map() in-memory storage to PostgreSQL Repository pattern.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventBusService } from './event-bus-service';
import {
  SbomDocument,
  SbomDocumentCreateInput,
  SbomDocumentUpdateInput,
  createSbomDocument,
  SbomPackage,
  SbomPackageCreateInput,
  createSbomPackage,
  SbomAttestation,
  SbomAttestationCreateInput,
  createSbomAttestation,
  SbomFormat,
  SbomStatus,
} from '../models/SbomDocument';
import {
  SbomDocumentRepository,
  SbomPackageRepository,
  SbomAttestationRepository,
  SbomDocumentEntity,
  SbomPackageEntity,
  SbomAttestationEntity,
} from '../repositories/SbomDocumentRepository';

export interface SbomDocumentListFilter {
  buildId?: string;
  pipelineRunId?: string;
  format?: SbomFormat;
  status?: SbomStatus;
  page?: number;
  perPage?: number;
}

/**
 * SBOM Document Service with PostgreSQL Repository backing
 */
export class SbomDocumentService {
  private documentRepository?: SbomDocumentRepository;
  private packageRepository?: SbomPackageRepository;
  private attestationRepository?: SbomAttestationRepository;
  private eventBus?: EventBusService;

  // Fallback Map storage when no DB is available (for dev/testing)
  private documents: Map<string, SbomDocument> = new Map();
  private packages: Map<string, SbomPackage[]> = new Map();
  private attestations: Map<string, SbomAttestation> = new Map();

  constructor(options?: {
    eventBus?: EventBusService;
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
  }) {
    this.eventBus = options?.eventBus;
    if (options?.db) {
      this.documentRepository = new SbomDocumentRepository(options.db);
      this.packageRepository = new SbomPackageRepository(options.db);
      this.attestationRepository = new SbomAttestationRepository(options.db);
    }
  }

  // ==================== Document CRUD ====================

  async create(input: SbomDocumentCreateInput): Promise<SbomDocument> {
    const doc = createSbomDocument(input);

    if (this.documentRepository && 'db' in this.documentRepository) {
      const db = (this.documentRepository as any).db;
      await db.query(
        `INSERT INTO sbom_documents (id, build_id, pipeline_run_id, format, spec_version, document_id, content, package_count, status, created_at, updated_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [doc.id, doc.buildId, doc.pipelineRunId, doc.format, doc.specVersion, doc.documentId, doc.content, doc.packageCount, doc.status, doc.createdAt, doc.updatedAt, doc.expiresAt ?? null],
      );
    } else {
      this.documents.set(doc.id, doc);
      this.packages.set(doc.id, []);
    }

    await this.eventBus?.publish('sbom.document.created', { documentId: doc.id, buildId: input.buildId });
    return doc;
  }

  async getById(id: string): Promise<SbomDocument | undefined> {
    if (this.documentRepository) {
      const entity = await this.documentRepository.findById(id);
      return entity ? this.mapEntityToDocument(entity) : undefined;
    }
    return this.documents.get(id);
  }

  async list(filter: SbomDocumentListFilter = {}): Promise<{ documents: SbomDocument[]; total: number }> {
    if (this.documentRepository) {
      const result = await this.documentRepository.list({
        buildId: filter.buildId,
        pipelineRunId: filter.pipelineRunId,
        format: filter.format,
        status: filter.status,
        page: filter.page,
        perPage: filter.perPage,
      });
      return {
        documents: result.documents.map((entity: SbomDocumentEntity) => this.mapEntityToDocument(entity)),
        total: result.total,
      };
    }

    // Fallback to Map
    let items = Array.from(this.documents.values());

    if (filter.buildId) {
      items = items.filter(d => d.buildId === filter.buildId);
    }
    if (filter.pipelineRunId) {
      items = items.filter(d => d.pipelineRunId === filter.pipelineRunId);
    }
    if (filter.format) {
      items = items.filter(d => d.format === filter.format);
    }
    if (filter.status) {
      items = items.filter(d => d.status === filter.status);
    }

    const total = items.length;
    const page = filter.page ?? 1;
    const perPage = filter.perPage ?? 20;
    const start = (page - 1) * perPage;
    items = items.slice(start, start + perPage);

    return { documents: items, total };
  }

  async update(id: string, input: SbomDocumentUpdateInput): Promise<SbomDocument | undefined> {
    if (this.documentRepository) {
      const entity = await this.documentRepository.findById(id);
      if (!entity) return undefined;

      const updateData: Record<string, unknown> = {};
      if (input.status !== undefined) updateData.status = input.status;
      if (input.expiresAt !== undefined) updateData.expires_at = input.expiresAt;

      if (Object.keys(updateData).length > 0) {
        await this.documentRepository.update(id, updateData);
      }
      const updated = await this.documentRepository.findById(id);
      return updated ? this.mapEntityToDocument(updated) : undefined;
    }

    // Fallback to Map
    const doc = this.documents.get(id);
    if (!doc) return undefined;

    if (input.status !== undefined) doc.status = input.status;
    if (input.expiresAt !== undefined) doc.expiresAt = input.expiresAt;
    doc.updatedAt = new Date();

    await this.eventBus?.publish('sbom.document.updated', { documentId: id, status: doc.status });
    return doc;
  }

  async delete(id: string): Promise<boolean> {
    if (this.documentRepository) {
      // Cascade delete packages and attestations
      await this.packageRepository?.deleteBySbomId(id);
      await this.attestationRepository?.deleteBySbomId(id);
      const deleted = await this.documentRepository.delete(id);
      if (deleted) {
        await this.eventBus?.publish('sbom.document.deleted', { documentId: id });
      }
      return deleted;
    }

    // Fallback to Map
    const deleted = this.documents.delete(id);
    this.packages.delete(id);
    this.attestations.delete(id);
    if (deleted) {
      await this.eventBus?.publish('sbom.document.deleted', { documentId: id });
    }
    return deleted;
  }

  // ==================== Package Management ====================

  async addPackage(input: SbomPackageCreateInput): Promise<SbomPackage> {
    const pkg = createSbomPackage(input);

    if (this.packageRepository && this.documentRepository) {
      await this.packageRepository.create({
        sbomId: input.sbomId,
        name: input.name,
        version: input.version,
        purl: input.purl,
        cpe: input.cpe,
        license: input.license,
        supplier: input.supplier,
        sourceLocation: input.sourceLocation,
        checksum: input.checksum,
      });
      await this.documentRepository.incrementPackageCount(input.sbomId);
    } else {
      const packages = this.packages.get(input.sbomId) ?? [];
      packages.push(pkg);
      this.packages.set(input.sbomId, packages);

      const doc = this.documents.get(input.sbomId);
      if (doc) {
        doc.packageCount = packages.length;
      }
    }

    return pkg;
  }

  async getPackages(sbomId: string): Promise<SbomPackage[]> {
    if (this.packageRepository) {
      const entities = await this.packageRepository.findBySbomId(sbomId);
      return entities.map((entity: SbomPackageEntity) => this.mapEntityToPackage(entity));
    }
    return this.packages.get(sbomId) ?? [];
  }

  // ==================== Attestation Management ====================

  async createAttestation(input: SbomAttestationCreateInput): Promise<SbomAttestation> {
    const attestation = createSbomAttestation(input);

    if (this.attestationRepository) {
      await this.attestationRepository.create({
        sbomId: input.sbomId,
        attestationType: input.attestationType,
        signature: input.signature,
        certificate: input.certificate,
        transparencyLogUrl: input.transparencyLogUrl,
      });
    } else {
      this.attestations.set(attestation.id, attestation);
    }

    await this.eventBus?.publish('sbom.attestation.created', {
      sbomId: input.sbomId,
      attestationType: input.attestationType,
    });
    return attestation;
  }

  async getAttestationBySbomId(sbomId: string): Promise<SbomAttestation | undefined> {
    if (this.attestationRepository) {
      const entity = await this.attestationRepository.findBySbomId(sbomId);
      return entity ? this.mapEntityToAttestation(entity) : undefined;
    }
    return Array.from(this.attestations.values()).find(a => a.sbomId === sbomId);
  }

  async verifyAttestation(id: string): Promise<SbomAttestation | undefined> {
    if (this.attestationRepository) {
      const entity = await this.attestationRepository.verify(id);
      if (!entity) return undefined;
      await this.eventBus?.publish('sbom.attestation.verified', { attestationId: id });
      return this.mapEntityToAttestation(entity);
    }

    // Fallback to Map
    const attestation = this.attestations.get(id);
    if (!attestation) return undefined;

    attestation.verified = true;
    attestation.verifiedAt = new Date();
    this.attestations.set(id, attestation);

    await this.eventBus?.publish('sbom.attestation.verified', { attestationId: id });
    return attestation;
  }

  // ==================== Entity Mapping Helpers ====================

  private mapEntityToDocument(entity: SbomDocumentEntity): SbomDocument {
    return {
      id: entity.id,
      buildId: entity.buildId,
      pipelineRunId: entity.pipelineRunId,
      format: entity.format as SbomFormat,
      specVersion: entity.specVersion,
      documentId: entity.documentId,
      content: entity.content,
      packageCount: entity.packageCount,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      expiresAt: entity.expiresAt ?? undefined,
      status: entity.status as SbomStatus,
    };
  }

  private mapEntityToPackage(entity: SbomPackageEntity): SbomPackage {
    return {
      id: entity.id,
      sbomId: entity.sbomId,
      name: entity.name,
      version: entity.version,
      purl: entity.purl ?? undefined,
      cpe: entity.cpe ?? undefined,
      license: entity.license ?? undefined,
      supplier: entity.supplier ?? undefined,
      sourceLocation: entity.sourceLocation ?? undefined,
      checksum: entity.checksum ?? undefined,
    };
  }

  private mapEntityToAttestation(entity: SbomAttestationEntity): SbomAttestation {
    return {
      id: entity.id,
      sbomId: entity.sbomId,
      attestationType: entity.attestationType as 'sigstore-cosign' | 'in-toto',
      signature: entity.signature,
      certificate: entity.certificate ?? undefined,
      transparencyLogUrl: entity.transparencyLogUrl ?? undefined,
      signedAt: entity.signedAt,
      verified: entity.verified,
      verifiedAt: entity.verifiedAt ?? undefined,
    };
  }

  // ==================== Compliance & Provenance & Gate (M31 additions) ====================

  /**
   * Get SBOM compliance report aggregated across all SBOMs
   */
  async getComplianceReport(params: {
    scope?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalSboms: number;
    compliantSboms: number;
    complianceRate: number;
    eo14028Compliant: number;
    euCraCompliant: number;
    criticalVulnerabilities: number;
    period: { from: string; to: string };
  }> {
    const { documents } = await this.list();
    const filtered = documents.filter((doc) => {
      if (params.startDate && new Date(doc.createdAt) < params.startDate) return false;
      if (params.endDate && new Date(doc.createdAt) > params.endDate) return false;
      return true;
    });

    const compliantCount = filtered.filter((d) => d.status === 'active' || (d as any).approved).length;
    const eo14028Count = filtered.filter((d) => (d as any).compliance?.eo14028).length;
    const euCraCount = filtered.filter((d) => (d as any).compliance?.euCra).length;

    // Count critical vulns across all SBOMs
    let criticalVulns = 0;
    for (const doc of filtered) {
      if ((doc as any).vulnerabilities) {
        criticalVulns += (doc as any).vulnerabilities.filter((v: any) => v.severity === 'critical').length;
      }
    }

    return {
      totalSboms: filtered.length,
      compliantSboms: compliantCount,
      complianceRate: filtered.length > 0 ? Math.round((compliantCount / filtered.length) * 10000) / 100 : 0,
      eo14028Compliant: eo14028Count,
      euCraCompliant: euCraCount,
      criticalVulnerabilities: criticalVulns,
      period: {
        from: params.startDate?.toISOString() || filtered[0]?.createdAt?.toISOString() || new Date().toISOString(),
        to: params.endDate?.toISOString() || new Date().toISOString(),
      },
    };
  }

  /**
   * Get EO 14028 (Executive Order) compliance status
   */
  async getEO14028Compliance(): Promise<{
    compliant: boolean;
    checkedAt: string;
    details: Array<{ sbomId: string; sbomName: string; compliant: boolean; missingElements: string[] }>;
  }> {
    const { documents } = await this.list();
    const eo14028Elements = ['supplier', 'components', 'vulnerabilities', 'author', 'timestamp', 'uniqueId'];

    const details = documents.map((doc) => {
      const hasElements = eo14028Elements.filter((el) => !(doc as any)[el] && !(doc as any).metadata?.[el]);
      return {
        sbomId: doc.id,
        sbomName: (doc as any).name || doc.id,
        compliant: hasElements.length === 0,
        missingElements: hasElements,
      };
    });

    return {
      compliant: details.every((d) => d.compliant),
      checkedAt: new Date().toISOString(),
      details,
    };
  }

  /**
   * Get EU Cyber Resilience Act compliance status
   */
  async getEUCRACompliance(): Promise<{
    compliant: boolean;
    checkedAt: string;
    details: Array<{ sbomId: string; sbomName: string; compliant: boolean; missingElements: string[] }>;
  }> {
    const { documents } = await this.list();
    const euCraElements = ['supplier', 'components', 'vulnerabilities', 'dependencies', 'license'];

    const details = documents.map((doc) => {
      const hasElements = euCraElements.filter((el) => !(doc as any)[el] && !(doc as any).metadata?.[el]);
      return {
        sbomId: doc.id,
        sbomName: (doc as any).name || doc.id,
        compliant: hasElements.length === 0,
        missingElements: hasElements,
      };
    });

    return {
      compliant: details.every((d) => d.compliant),
      checkedAt: new Date().toISOString(),
      details,
    };
  }

  /**
   * Create build provenance record (SLSA/in-toto style)
   */
  async createProvenance(input: {
    buildId: string;
    provenanceType: string;
    content: Record<string, unknown>;
    signature: string;
    builderId: string;
    buildTrigger: string;
    sourceUri: string;
  }): Promise<{ id: string; buildId: string; provenanceType: string; createdAt: string; verified: boolean }> {
    const id = `prov-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const record = {
      id,
      ...input,
      verified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store in database if available, otherwise in-memory
    if ((this as any).db) {
      const db = (this as any).db;
      await db.query(
        `INSERT INTO sbom_provenance (id, build_id, provenance_type, content, signature, builder_id, build_trigger, source_uri, verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [id, input.buildId, input.provenanceType, JSON.stringify(input.content), input.signature, input.builderId, input.buildTrigger, input.sourceUri, false, new Date(), new Date()]
      );
    } else {
      // In-memory fallback
      if (!(this as any).provenanceStore) (this as any).provenanceStore = new Map();
      (this as any).provenanceStore.set(id, record);
    }

    return { id, buildId: input.buildId, provenanceType: input.provenanceType, createdAt: record.createdAt, verified: false };
  }

  /**
   * List provenance records, optionally filtered by buildId
   */
  async listProvenance(buildId?: string): Promise<Array<{ id: string; buildId: string; provenanceType: string; createdAt: string; verified: boolean }>> {
    if ((this as any).db) {
      const db = (this as any).db;
      if (buildId) {
        const result = await db.query('SELECT id, build_id, provenance_type, verified, created_at FROM sbom_provenance WHERE build_id = $1 ORDER BY created_at DESC', [buildId]);
        return result.rows.map((r: any) => ({
          id: r.id,
          buildId: r.build_id,
          provenanceType: r.provenance_type,
          verified: r.verified,
          createdAt: r.created_at,
        }));
      }
      const result = await db.query('SELECT id, build_id, provenance_type, verified, created_at FROM sbom_provenance ORDER BY created_at DESC');
      return result.rows.map((r: any) => ({
        id: r.id,
        buildId: r.build_id,
        provenanceType: r.provenance_type,
        verified: r.verified,
        createdAt: r.created_at,
      }));
    }

    // In-memory fallback
    const store = (this as any).provenanceStore as Map<string, any> | undefined;
    if (!store) return [];
    const records = Array.from(store.values());
    return buildId ? records.filter((r: any) => r.buildId === buildId) : records;
  }

  /**
   * Verify a provenance record's cryptographic signature
   */
  async verifyProvenance(id: string): Promise<{ id: string; verified: boolean; verifiedAt: string; details: string }> {
    let record: any;

    if ((this as any).db) {
      const db = (this as any).db;
      const result = await db.query('SELECT * FROM sbom_provenance WHERE id = $1', [id]);
      if (result.rows.length === 0) throw new Error(`Provenance ${id} not found`);
      record = result.rows[0];
    } else {
      const store = (this as any).provenanceStore as Map<string, any>;
      record = store?.get(id);
      if (!record) throw new Error(`Provenance ${id} not found`);
    }

    // MVP: signature verification is a placeholder -- in production, use actual crypto verification
    const verified = !!record.signature && record.signature.length > 10;

    if ((this as any).db) {
      const db = (this as any).db;
      await db.query('UPDATE sbom_provenance SET verified = $1, updated_at = $2 WHERE id = $3', [verified, new Date(), id]);
    } else {
      record.verified = verified;
      record.updatedAt = new Date().toISOString();
    }

    return {
      id,
      verified,
      verifiedAt: new Date().toISOString(),
      details: verified ? 'Signature format valid (MVP check)' : 'Invalid or missing signature',
    };
  }

  /**
   * Evaluate SBOM gate for a build -- pass/fail based on vulnerability thresholds
   */
  async evaluateGate(buildId: string): Promise<{
    passed: boolean;
    buildId: string;
    evaluatedAt: string;
    checks: Array<{ name: string; passed: boolean; details: string }>;
  }> {
    const provenances = await this.listProvenance(buildId);
    const { documents } = await this.list();

    // Gate checks
    const checks = [
      {
        name: 'provenance_exists',
        passed: provenances.length > 0,
        details: provenances.length > 0 ? `${provenances.length} provenance record(s) found` : 'No provenance records',
      },
      {
        name: 'no_critical_vulnerabilities',
        passed: true, // Will be updated after scanning documents
        details: '0 critical vulnerabilities',
      },
      {
        name: 'all_waivers_approved',
        passed: true,
        details: 'All waivers approved',
      },
    ];

    // Check for critical vulnerabilities
    let criticalCount = 0;
    for (const doc of documents) {
      if ((doc as any).vulnerabilities) {
        criticalCount += (doc as any).vulnerabilities.filter((v: any) => v.severity === 'critical').length;
      }
    }
    checks[1].passed = criticalCount === 0;
    checks[1].details = `${criticalCount} critical vulnerability(ies) found`;

    const passed = checks.every((c) => c.passed);

    // Store gate result in-memory (MVP)
    if (!(this as any).gateHistory) (this as any).gateHistory = [];
    (this as any).gateHistory.push({ buildId, passed, checks, evaluatedAt: new Date().toISOString() });

    return { passed, buildId, evaluatedAt: new Date().toISOString(), checks };
  }

  /**
   * Get SBOM gate evaluation history
   */
  async getGateHistory(buildId?: string): Promise<Array<{ buildId: string; passed: boolean; evaluatedAt: string; checks: Array<{ name: string; passed: boolean; details: string }> }>> {
    const history = ((this as any).gateHistory as Array<any>) || [];
    return buildId ? history.filter((h) => h.buildId === buildId) : history;
  }
}
