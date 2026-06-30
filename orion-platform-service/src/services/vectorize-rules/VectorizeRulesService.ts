/**
 * Vectorize Rules Service
 * Manages automatic vectorization rules for document processing
 * Migrated from in-memory Map() to PostgreSQL Repository pattern
 */

import { v4 as uuidv4 } from 'uuid';
import { VectorizeRulesRepository, VectorizeRuleEntity } from '../../repositories/VectorizeRulesRepository';

export interface VectorizeRule {
  id: string;
  tenant_id: string;
  name: string;
  source_type: 'upload' | 'git' | 'api' | 'database';
  file_types: string[];
  chunk_size: number;
  chunk_overlap: number;
  embedding_model: string;
  target_collection: string;
  enabled: boolean;
  last_run: string | null;
  processed_count: number;
  created_at: string;
  updated_at: string;
}

export class VectorizeRulesService {
  private repo: VectorizeRulesRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.repo = new VectorizeRulesRepository(db);
  }

  async createRule(input: {
    tenant_id: string;
    name: string;
    source_type: string;
    file_types: string[];
    chunk_size?: number;
    chunk_overlap?: number;
    embedding_model?: string;
    target_collection: string;
  }): Promise<VectorizeRule> {
    const entity = await this.repo.create({
      id: uuidv4(),
      tenantId: input.tenant_id,
      name: input.name,
      sourceType: input.source_type,
      fileTypes: input.file_types,
      chunkSize: input.chunk_size || 512,
      chunkOverlap: input.chunk_overlap || 50,
      embeddingModel: input.embedding_model || 'text-embedding-3-small',
      targetCollection: input.target_collection,
      enabled: true,
      lastRun: null,
      processedCount: 0,
    });
    return this.entityToDto(entity);
  }

  async listRules(tenantId: string): Promise<VectorizeRule[]> {
    const { entities } = await this.repo.findByTenant(tenantId);
    return entities.map(e => this.entityToDto(e));
  }

  async getRule(id: string): Promise<VectorizeRule | undefined> {
    const entity = await this.repo.findById(id);
    return entity ? this.entityToDto(entity) : undefined;
  }

  async updateRule(id: string, input: Partial<VectorizeRule>): Promise<VectorizeRule | undefined> {
    const existing = await this.repo.findById(id);
    if (!existing) return undefined;

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.source_type !== undefined) updateData.sourceType = input.source_type;
    if (input.file_types !== undefined) updateData.fileTypes = input.file_types;
    if (input.chunk_size !== undefined) updateData.chunkSize = input.chunk_size;
    if (input.chunk_overlap !== undefined) updateData.chunkOverlap = input.chunk_overlap;
    if (input.embedding_model !== undefined) updateData.embeddingModel = input.embedding_model;
    if (input.target_collection !== undefined) updateData.targetCollection = input.target_collection;
    if (input.enabled !== undefined) updateData.enabled = input.enabled;

    if (Object.keys(updateData).length === 0) return this.entityToDto(existing);

    const updated = await this.repo.update(id, updateData);
    return this.entityToDto(updated);
  }

  async deleteRule(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }

  async toggleRule(id: string, enabled: boolean): Promise<VectorizeRule | undefined> {
    const entity = await this.repo.toggleEnabled(id, enabled);
    return entity ? this.entityToDto(entity) : undefined;
  }

  private entityToDto(entity: VectorizeRuleEntity): VectorizeRule {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      name: entity.name,
      source_type: entity.sourceType as VectorizeRule['source_type'],
      file_types: entity.fileTypes,
      chunk_size: entity.chunkSize,
      chunk_overlap: entity.chunkOverlap,
      embedding_model: entity.embeddingModel,
      target_collection: entity.targetCollection,
      enabled: entity.enabled,
      last_run: entity.lastRun ? new Date(entity.lastRun).toISOString() : null,
      processed_count: entity.processedCount,
      created_at: entity.createdAt ? new Date(entity.createdAt).toISOString() : new Date().toISOString(),
      updated_at: entity.updatedAt ? new Date(entity.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}
