/**
 * PortalDocumentService - 开发者门户文档业务逻辑层
 *
 * Handles document CRUD, publishing, search, version management, and analytics.
 */

import {
  PortalDocumentRepository,
  PortalDocumentEntity,
  PortalDocumentCreateInput,
  PortalDocumentUpdateInput,
  PortalDocumentListOptions,
} from '../../repositories/PortalDocumentRepository';

export class PortalDocumentServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PortalDocumentServiceError';
  }
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class PortalDocumentService {
  private repository: PortalDocumentRepository;

  constructor(repository: PortalDocumentRepository) {
    this.repository = repository;
  }

  // ==================== Document CRUD ====================

  /**
   * Create a new document
   */
  async createDocument(input: PortalDocumentCreateInput): Promise<PortalDocumentEntity> {
    if (!input.title || input.title.trim().length === 0) {
      throw new PortalDocumentServiceError('Title is required', 'INVALID_INPUT');
    }
    if (!input.slug || input.slug.trim().length === 0) {
      throw new PortalDocumentServiceError('Slug is required', 'INVALID_INPUT');
    }
    if (!input.content || input.content.trim().length === 0) {
      throw new PortalDocumentServiceError('Content is required', 'INVALID_INPUT');
    }
    if (!input.authorId || input.authorId.trim().length === 0) {
      throw new PortalDocumentServiceError('Author ID is required', 'INVALID_INPUT');
    }

    // Check for duplicate slug within tenant
    const existing = await this.repository.findBySlug(input.tenantId, input.slug);
    if (existing) {
      throw new PortalDocumentServiceError('Slug already exists for this tenant', 'DUPLICATE_SLUG');
    }

    const entity = await this.repository.create({
      tenantId: input.tenantId,
      title: input.title.trim(),
      slug: input.slug.trim(),
      content: input.content,
      contentFormat: input.contentFormat ?? 'markdown',
      documentType: input.documentType,
      category: input.category ?? undefined,
      tags: input.tags ?? [],
      version: input.version ?? '1.0.0',
      authorId: input.authorId,
      metadata: input.metadata ?? {},
    });

    return entity;
  }

  /**
   * Get document by ID (auto-increment view count)
   */
  async getDocumentById(id: string): Promise<PortalDocumentEntity> {
    const doc = await this.repository.findById(id);
    if (!doc) {
      throw new PortalDocumentServiceError(`Document not found: ${id}`, 'DOCUMENT_NOT_FOUND');
    }

    // Increment view count asynchronously (non-blocking)
    await this.repository.incrementViewCount(id);

    return doc;
  }

  /**
   * List documents with filtering and pagination
   */
  async getDocuments(options: PortalDocumentListOptions = {}): Promise<PaginatedResult<PortalDocumentEntity>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const result = await this.repository.findAllFiltered({
      ...options,
      page: undefined,
      limit,
      offset,
    });

    return {
      data: result.entities,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  /**
   * Search documents with full-text search
   */
  async searchDocuments(
    tenantId: string,
    query: string,
    filters?: { type?: string; category?: string },
  ): Promise<PortalDocumentEntity[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }
    return this.repository.search(tenantId, query.trim(), filters);
  }

  /**
   * Update document
   */
  async updateDocument(id: string, input: PortalDocumentUpdateInput, editorId?: string): Promise<PortalDocumentEntity> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new PortalDocumentServiceError(`Document not found: ${id}`, 'DOCUMENT_NOT_FOUND');
    }

    // If slug is changing, check for conflicts within tenant
    if (input.slug && input.slug !== existing.slug) {
      const slugConflict = await this.repository.findBySlug(existing.tenantId, input.slug);
      if (slugConflict && slugConflict.id !== id) {
        throw new PortalDocumentServiceError('Slug already exists for this tenant', 'DUPLICATE_SLUG');
      }
    }

    const updateData: PortalDocumentUpdateInput = { ...input };
    if (editorId) {
      updateData.editorId = editorId;
    }

    const updated = await this.repository.update(id, updateData);
    return updated;
  }

  /**
   * Delete document
   */
  async deleteDocument(id: string): Promise<boolean> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new PortalDocumentServiceError(`Document not found: ${id}`, 'DOCUMENT_NOT_FOUND');
    }

    return this.repository.delete(id);
  }

  // ==================== Publishing ====================

  /**
   * Publish a document (set isPublished = true, set publishedAt)
   */
  async publishDocument(id: string): Promise<PortalDocumentEntity> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new PortalDocumentServiceError(`Document not found: ${id}`, 'DOCUMENT_NOT_FOUND');
    }
    if (existing.isPublished) {
      throw new PortalDocumentServiceError('Document is already published', 'ALREADY_PUBLISHED');
    }

    const updated = await this.repository.update(id, {
      isPublished: true,
      publishedAt: new Date(),
    });
    return updated;
  }

  /**
   * Unpublish a document (set isPublished = false)
   */
  async unpublishDocument(id: string): Promise<PortalDocumentEntity> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new PortalDocumentServiceError(`Document not found: ${id}`, 'DOCUMENT_NOT_FOUND');
    }
    if (!existing.isPublished) {
      throw new PortalDocumentServiceError('Document is not published', 'NOT_PUBLISHED');
    }

    const updated = await this.repository.update(id, {
      isPublished: false,
    });
    return updated;
  }

  // ==================== Categories & Analytics ====================

  /**
   * Get all distinct categories for a tenant
   */
  async getCategories(tenantId: string): Promise<{ category: string; count: number }[]> {
    return this.repository.getCategories(tenantId);
  }

  /**
   * Get popular documents by view count
   */
  async getPopularDocuments(tenantId: string, limit: number = 10): Promise<PortalDocumentEntity[]> {
    return this.repository.findPopular(tenantId, limit);
  }

  /**
   * Record helpful/not-helpful feedback
   */
  async recordHelpful(id: string, isHelpful: boolean): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new PortalDocumentServiceError(`Document not found: ${id}`, 'DOCUMENT_NOT_FOUND');
    }
    await this.repository.incrementHelpful(id, isHelpful);
  }

  // ==================== Version Management ====================

  /**
   * Create a new version of a document (snapshot the current and create new draft)
   */
  async createNewVersion(id: string, newVersion: string, editorId?: string): Promise<PortalDocumentEntity> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new PortalDocumentServiceError(`Document not found: ${id}`, 'DOCUMENT_NOT_FOUND');
    }

    if (!newVersion || newVersion.trim().length === 0) {
      throw new PortalDocumentServiceError('Version string is required', 'INVALID_INPUT');
    }

    // Create a new document as a new version
    const newDoc = await this.repository.create({
      tenantId: existing.tenantId,
      title: existing.title,
      slug: `${existing.slug}-v${newVersion.replace(/\./g, '-')}`,
      content: existing.content,
      contentFormat: existing.contentFormat,
      documentType: existing.documentType,
      category: existing.category ?? undefined,
      tags: [...existing.tags],
      version: newVersion.trim(),
      authorId: editorId ?? existing.authorId,
      metadata: { ...existing.metadata, previousVersionId: id, previousVersion: existing.version },
    });

    return newDoc;
  }

  /**
   * Get all versions of a document (by matching slug pattern or metadata)
   */
  async getDocumentVersions(id: string): Promise<PortalDocumentEntity[]> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new PortalDocumentServiceError(`Document not found: ${id}`, 'DOCUMENT_NOT_FOUND');
    }

    // Find all documents with the same base slug pattern
    const baseSlug = existing.slug.replace(/-v[\d-]+$/, '');
    const result = await this.repository.findAllFiltered({
      tenantId: existing.tenantId,
      limit: 100,
    });

    // Filter by base slug or metadata references
    return result.entities.filter(
      (doc) =>
        doc.slug === existing.slug ||
        doc.slug.startsWith(`${baseSlug}-v`) ||
        (doc.metadata as Record<string, unknown>)?.previousVersionId === id ||
        (existing.metadata as Record<string, unknown>)?.previousVersionId === doc.id
    ).sort((a, b) => {
      const vA = a.version || '0.0.0';
      const vB = b.version || '0.0.0';
      return vB.localeCompare(vA, undefined, { numeric: true });
    });
  }

  // ==================== Publish Workflow ====================

  /**
   * Submit document for review (transition to review state via metadata)
   */
  async submitForReview(id: string, submitterId: string): Promise<PortalDocumentEntity> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new PortalDocumentServiceError(`Document not found: ${id}`, 'DOCUMENT_NOT_FOUND');
    }
    if (existing.isPublished) {
      throw new PortalDocumentServiceError('Published documents cannot be submitted for review', 'ALREADY_PUBLISHED');
    }

    const metadata = { ...(existing.metadata || {}) };
    metadata.reviewStatus = 'pending_review';
    metadata.submittedBy = submitterId;
    metadata.submittedAt = new Date().toISOString();

    return this.repository.update(id, { metadata });
  }

  /**
   * Approve document review
   */
  async approveReview(id: string, reviewerId: string): Promise<PortalDocumentEntity> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new PortalDocumentServiceError(`Document not found: ${id}`, 'DOCUMENT_NOT_FOUND');
    }

    const metadata = { ...(existing.metadata || {}) };
    metadata.reviewStatus = 'approved';
    metadata.reviewedBy = reviewerId;
    metadata.reviewedAt = new Date().toISOString();

    return this.repository.update(id, { metadata });
  }

  /**
   * Reject document review
   */
  async rejectReview(id: string, reviewerId: string, reason: string): Promise<PortalDocumentEntity> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new PortalDocumentServiceError(`Document not found: ${id}`, 'DOCUMENT_NOT_FOUND');
    }

    const metadata = { ...(existing.metadata || {}) };
    metadata.reviewStatus = 'rejected';
    metadata.reviewedBy = reviewerId;
    metadata.reviewedAt = new Date().toISOString();
    metadata.rejectReason = reason;

    return this.repository.update(id, { metadata });
  }

  /**
   * Get document statistics for a tenant
   */
  async getDocumentStats(tenantId: string): Promise<{
    total: number;
    published: number;
    draft: number;
    inReview: number;
    totalViews: number;
    totalHelpful: number;
  }> {
    const result = await this.repository.findAllFiltered({ tenantId, limit: 10000 });
    const docs = result.entities;
    return {
      total: docs.length,
      published: docs.filter((d) => d.isPublished).length,
      draft: docs.filter((d) => !d.isPublished && (d.metadata as Record<string, string>)?.reviewStatus !== 'pending_review').length,
      inReview: docs.filter((d) => (d.metadata as Record<string, string>)?.reviewStatus === 'pending_review').length,
      totalViews: docs.reduce((sum, d) => sum + d.viewCount, 0),
      totalHelpful: docs.reduce((sum, d) => sum + d.helpfulCount, 0),
    };
  }
}
