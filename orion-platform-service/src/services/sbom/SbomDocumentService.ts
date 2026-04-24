/**
 * SBOM Document Service - 管理 SBOM 文档和包清单
 *
 * Migrated from Map() in-memory storage to PostgreSQL Repository pattern.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventBusService } from '../event-bus-service';
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
} from '../../models/SbomDocument';
import {
  SbomDocumentRepository,
  SbomPackageRepository,
  SbomAttestationRepository,
  SbomDocumentEntity,
  SbomPackageEntity,
  SbomAttestationEntity,
} from '../../repositories/SbomDocumentRepository';

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
        documents: result.documents.map(entity => this.mapEntityToDocument(entity)),
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
      return entities.map(entity => this.mapEntityToPackage(entity));
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
}
