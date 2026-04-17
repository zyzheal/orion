/**
 * SBOM Document Service - 管理 SBOM 文档和包清单
 */

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

export interface SbomDocumentListFilter {
  buildId?: string;
  pipelineRunId?: string;
  format?: SbomFormat;
  status?: SbomStatus;
  page?: number;
  perPage?: number;
}

export class SbomDocumentService {
  private documents: Map<string, SbomDocument> = new Map();
  private packages: Map<string, SbomPackage[]> = new Map();
  private attestations: Map<string, SbomAttestation> = new Map();
  private eventBus?: EventBusService;

  constructor(options?: { eventBus?: EventBusService }) {
    this.eventBus = options?.eventBus;
  }

  async create(input: SbomDocumentCreateInput): Promise<SbomDocument> {
    const doc = createSbomDocument(input);
    this.documents.set(doc.id, doc);
    this.packages.set(doc.id, []);

    await this.eventBus?.publish('sbom.document.created', { documentId: doc.id, buildId: input.buildId });
    return doc;
  }

  async getById(id: string): Promise<SbomDocument | undefined> {
    return this.documents.get(id);
  }

  async list(filter: SbomDocumentListFilter = {}): Promise<{ documents: SbomDocument[]; total: number }> {
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
    const doc = this.documents.get(id);
    if (!doc) return undefined;

    if (input.status !== undefined) doc.status = input.status;
    if (input.expiresAt !== undefined) doc.expiresAt = input.expiresAt;
    doc.updatedAt = new Date();

    this.documents.set(id, doc);
    await this.eventBus?.publish('sbom.document.updated', { documentId: id, status: doc.status });
    return doc;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = this.documents.delete(id);
    this.packages.delete(id);
    this.attestations.delete(id);
    if (deleted) {
      await this.eventBus?.publish('sbom.document.deleted', { documentId: id });
    }
    return deleted;
  }

  // Package management
  async addPackage(input: SbomPackageCreateInput): Promise<SbomPackage> {
    const pkg = createSbomPackage(input);
    const packages = this.packages.get(input.sbomId) ?? [];
    packages.push(pkg);
    this.packages.set(input.sbomId, packages);

    // Update package count
    const doc = this.documents.get(input.sbomId);
    if (doc) {
      doc.packageCount = packages.length;
    }

    return pkg;
  }

  async getPackages(sbomId: string): Promise<SbomPackage[]> {
    return this.packages.get(sbomId) ?? [];
  }

  // Attestation management
  async createAttestation(input: SbomAttestationCreateInput): Promise<SbomAttestation> {
    const attestation = createSbomAttestation(input);
    this.attestations.set(attestation.id, attestation);

    await this.eventBus?.publish('sbom.attestation.created', {
      sbomId: input.sbomId,
      attestationType: input.attestationType,
    });
    return attestation;
  }

  async getAttestationBySbomId(sbomId: string): Promise<SbomAttestation | undefined> {
    return Array.from(this.attestations.values()).find(a => a.sbomId === sbomId);
  }

  async verifyAttestation(id: string): Promise<SbomAttestation | undefined> {
    const attestation = this.attestations.get(id);
    if (!attestation) return undefined;

    attestation.verified = true;
    attestation.verifiedAt = new Date();
    this.attestations.set(id, attestation);

    await this.eventBus?.publish('sbom.attestation.verified', { attestationId: id });
    return attestation;
  }
}
