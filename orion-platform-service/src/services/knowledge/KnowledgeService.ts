/**
 * KnowledgeService - Business logic layer for Knowledge operations (M28)
 *
 * Orchestrates space, document, and search operations through the repository layer.
 */

import { createLogger } from '../utils/logger';

const logger = pino({ name: 'LKnowledge-LService' });
import {
  KnowledgeRepository,
  KnowledgeSpace,
  CreateSpaceInput,
  UpdateSpaceInput,
  KnowledgeDoc,
  CreateDocInput,
  UpdateDocInput,
  DocVersion,
  KnowledgeSearchResult,
} from './KnowledgeRepository';

export interface DocTag {
  name: string;
  count: number;
}

export interface DocTocItem {
  id: string;
  title: string;
  parentId: string | null;
  order: number;
}

export interface SyncLog {
  id: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startedAt: Date;
  completedAt: Date | null;
  totalDocs: number;
  successDocs: number;
  failedDocs: number;
  errorMessage: string | null;
}

export class KnowledgeServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'KnowledgeServiceError'; }
}

export class KnowledgeService {
  private repository: KnowledgeRepository;
  constructor(repository: KnowledgeRepository) { this.repository = repository; }

  // ============================================================================
  // Space operations
  // ============================================================================

  async createSpace(tenantId: string, input: CreateSpaceInput): Promise<KnowledgeSpace> {
    if (!tenantId || !input.name) throw new KnowledgeServiceError('Tenant ID and space name are required', 'INVALID_INPUT');
    return this.repository.createSpace(tenantId, input);
  }

  async getSpace(id: string): Promise<KnowledgeSpace> {
    const space = await this.repository.findSpaceById(id);
    if (!space) throw new KnowledgeServiceError(`Space not found: ${id}`, 'NOT_FOUND');
    return space;
  }

  async listSpaces(tenantId: string, params?: { type?: string; search?: string; limit?: number; offset?: number }): Promise<KnowledgeSpace[]> {
    return this.repository.findAllSpaces(tenantId, params);
  }

  async updateSpace(id: string, input: UpdateSpaceInput): Promise<KnowledgeSpace> {
    const existing = await this.repository.findSpaceById(id);
    if (!existing) throw new KnowledgeServiceError(`Space not found: ${id}`, 'NOT_FOUND');
    const updated = await this.repository.updateSpace(id, input);
    if (!updated) throw new KnowledgeServiceError(`Failed to update space: ${id}`, 'UPDATE_FAILED');
    return updated;
  }

  async deleteSpace(id: string): Promise<boolean> {
    const existing = await this.repository.findSpaceById(id);
    if (!existing) throw new KnowledgeServiceError(`Space not found: ${id}`, 'NOT_FOUND');
    return this.repository.deleteSpace(id);
  }

  // ============================================================================
  // Document operations
  // ============================================================================

  async createDoc(tenantId: string, input: CreateDocInput): Promise<KnowledgeDoc> {
    if (!tenantId || !input.title || !input.content || !input.space_id) {
      throw new KnowledgeServiceError('Tenant ID, title, content, and space_id are required', 'INVALID_INPUT');
    }

    // Verify space exists and belongs to tenant
    const space = await this.repository.findSpaceById(input.space_id);
    if (!space || space.tenant_id !== tenantId) {
      throw new KnowledgeServiceError(`Space not found: ${input.space_id}`, 'NOT_FOUND');
    }

    return this.repository.createDoc(tenantId, input);
  }

  async getDoc(id: string): Promise<KnowledgeDoc> {
    const doc = await this.repository.findDocById(id);
    if (!doc) throw new KnowledgeServiceError(`Document not found: ${id}`, 'NOT_FOUND');
    return doc;
  }

  async listDocs(tenantId: string, params?: { spaceId?: string; status?: string; tag?: string; search?: string; type?: string; limit?: number; offset?: number }): Promise<KnowledgeDoc[]> {
    return this.repository.findAllDocs(tenantId, params);
  }

  async updateDoc(id: string, input: UpdateDocInput): Promise<KnowledgeDoc> {
    const existing = await this.repository.findDocById(id);
    if (!existing) throw new KnowledgeServiceError(`Document not found: ${id}`, 'NOT_FOUND');
    const updated = await this.repository.updateDoc(id, input);
    if (!updated) throw new KnowledgeServiceError(`Failed to update document: ${id}`, 'UPDATE_FAILED');
    return updated;
  }

  async deleteDoc(id: string): Promise<boolean> {
    const existing = await this.repository.findDocById(id);
    if (!existing) throw new KnowledgeServiceError(`Document not found: ${id}`, 'NOT_FOUND');
    return this.repository.deleteDoc(id);
  }

  // ============================================================================
  // Version operations
  // ============================================================================

  async getDocVersions(docId: string): Promise<DocVersion[]> {
    // Verify doc exists
    const doc = await this.repository.findDocById(docId);
    if (!doc) throw new KnowledgeServiceError(`Document not found: ${docId}`, 'NOT_FOUND');
    return this.repository.getDocVersions(docId);
  }

  // ============================================================================
  // Search / RAG
  // ============================================================================

  async search(tenantId: string, query: string, params?: { spaceId?: string; limit?: number }): Promise<KnowledgeSearchResult[]> {
    if (!query || query.trim().length === 0) {
      throw new KnowledgeServiceError('Search query cannot be empty', 'INVALID_INPUT');
    }
    return this.repository.search(tenantId, query.trim(), params);
  }

  async retrieve(tenantId: string, query: string, params?: { spaceId?: string; topK?: number }): Promise<KnowledgeSearchResult[]> {
    // RAG retrieve: semantic or text search for retrieval purposes
    return this.repository.search(tenantId, query, { spaceId: params?.spaceId, limit: params?.topK || 5 });
  }

  // ============================================================================
  // Document Center (type=docs)
  // ============================================================================

  async listDocsByType(tenantId: string, params?: { tag?: string; search?: string; limit?: number; offset?: number }): Promise<KnowledgeDoc[]> {
    return this.repository.findAllDocs(tenantId, { ...params, type: 'docs' });
  }

  async getDocTags(tenantId: string): Promise<DocTag[]> {
    const docs = await this.repository.findAllDocs(tenantId, { type: 'docs', limit: 1000 });
    const tagMap = new Map<string, number>();

    for (const doc of docs) {
      for (const tag of doc.tags || []) {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
      }
    }

    return Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getDocToc(tenantId: string): Promise<DocTocItem[]> {
    const docs = await this.repository.findAllDocs(tenantId, { type: 'docs', status: 'published', limit: 200 });
    return docs.map((doc, index) => ({
      id: doc.id,
      title: doc.title,
      parentId: null,
      order: index,
    }));
  }

  async triggerSync(tenantId: string, source?: string): Promise<SyncLog> {
    // Generate a sync log entry (in production this would trigger an async job)
    const syncLog: SyncLog = {
      id: `sync-${Date.now()}`,
      status: 'success',
      startedAt: new Date(),
      completedAt: new Date(),
      totalDocs: 0,
      successDocs: 0,
      failedDocs: 0,
      errorMessage: null,
    };

    // In production: trigger async document sync from external source
    // For now, return mock success
    logger.info(`[DocumentCenter] Sync triggered for tenant ${tenantId}, source: ${source || 'manual'}`);

    return syncLog;
  }

  async getSyncLogs(tenantId: string, limit: number = 10): Promise<SyncLog[]> {
    // Return mock sync logs (in production, store in database)
    const logs: SyncLog[] = [];
    const now = new Date();

    for (let i = 0; i < Math.min(limit, 5); i++) {
      logs.push({
        id: `sync-${now.getTime() - i * 3600000}`,
        status: i === 0 ? 'success' : 'success',
        startedAt: new Date(now.getTime() - i * 3600000),
        completedAt: new Date(now.getTime() - i * 3600000 + 5000),
        totalDocs: Math.floor(Math.random() * 50) + 10,
        successDocs: Math.floor(Math.random() * 45) + 10,
        failedDocs: 0,
        errorMessage: null,
      });
    }

    return logs;
  }
}
