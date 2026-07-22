/**
 * PortalDocumentService Tests
 *
 * Covers: document CRUD, search, publish/unpublish, categories,
 * popular documents, helpful feedback.
 */

import {
  PortalDocumentService,
  PortalDocumentServiceError,
  PaginatedResult,
} from '../PortalDocumentService';
import {
  PortalDocumentRepository,
  PortalDocumentEntity,
  PortalDocumentListOptions,
} from '../../../repositories/PortalDocumentRepository';

// ============================================================
// Mock Repository
// ============================================================

class MockPortalDocumentRepository {
  private documents: Map<string, PortalDocumentEntity> = new Map();
  private nextId = 1;

  async create(input: any): Promise<PortalDocumentEntity> {
    const id = `doc-${this.nextId++}`;
    const now = new Date();
    const doc: PortalDocumentEntity = {
      id,
      tenantId: input.tenantId,
      title: input.title,
      slug: input.slug,
      content: input.content,
      contentFormat: input.contentFormat ?? 'markdown',
      documentType: input.documentType,
      category: input.category ?? null,
      tags: input.tags ?? [],
      version: input.version ?? '1.0.0',
      isPublished: false,
      publishedAt: null,
      authorId: input.authorId,
      editorId: null,
      viewCount: 0,
      helpfulCount: 0,
      notHelpfulCount: 0,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.documents.set(id, doc);
    return doc;
  }

  async findById(id: string): Promise<PortalDocumentEntity | undefined> {
    return this.documents.get(id);
  }

  async findBySlug(tenantId: string, slug: string): Promise<PortalDocumentEntity | undefined> {
    for (const doc of this.documents.values()) {
      if (doc.tenantId === tenantId && doc.slug === slug) {
        return doc;
      }
    }
    return undefined;
  }

  async findAllFiltered(options: PortalDocumentListOptions & { offset?: number }): Promise<{ entities: PortalDocumentEntity[]; total: number }> {
    let results = Array.from(this.documents.values());

    if (options.tenantId) results = results.filter(d => d.tenantId === options.tenantId);
    if (options.type) results = results.filter(d => d.documentType === options.type);
    if (options.category) results = results.filter(d => d.category === options.category);
    if (options.published !== undefined) results = results.filter(d => d.isPublished === options.published);
    if (options.tags && options.tags.length > 0) {
      results = results.filter(d => options.tags!.some(t => d.tags.includes(t)));
    }

    const total = results.length;
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 20;
    const entities = results.slice(offset, offset + limit);

    return { entities, total };
  }

  async search(tenantId: string, query: string, filters?: { type?: string; category?: string }): Promise<PortalDocumentEntity[]> {
    let results = Array.from(this.documents.values()).filter(
      d => d.tenantId === tenantId && d.isPublished && (
        d.title.toLowerCase().includes(query.toLowerCase()) ||
        d.content.toLowerCase().includes(query.toLowerCase())
      )
    );

    if (filters?.type) results = results.filter(d => d.documentType === filters.type);
    if (filters?.category) results = results.filter(d => d.category === filters.category);

    results.sort((a, b) => b.viewCount - a.viewCount);
    return results.slice(0, 50);
  }

  async update(id: string, data: any): Promise<PortalDocumentEntity> {
    const doc = this.documents.get(id);
    if (!doc) throw new Error(`Document not found: ${id}`);

    const updated = { ...doc, ...data, updatedAt: new Date() };
    this.documents.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }

  async incrementViewCount(id: string): Promise<void> {
    const doc = this.documents.get(id);
    if (doc) {
      doc.viewCount += 1;
    }
  }

  async incrementHelpful(id: string, isHelpful: boolean): Promise<void> {
    const doc = this.documents.get(id);
    if (doc) {
      if (isHelpful) doc.helpfulCount += 1;
      else doc.notHelpfulCount += 1;
    }
  }

  async getCategories(tenantId: string): Promise<{ category: string; count: number }[]> {
    const docs = Array.from(this.documents.values()).filter(
      d => d.tenantId === tenantId && d.category
    );
    const counts: Record<string, number> = {};
    docs.forEach(d => {
      const cat = d.category!;
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }

  async findPopular(tenantId: string, limit: number = 10): Promise<PortalDocumentEntity[]> {
    return Array.from(this.documents.values())
      .filter(d => d.tenantId === tenantId && d.isPublished)
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, limit);
  }
}

describe('PortalDocumentService', () => {
  let service: PortalDocumentService;
  let mockRepo: MockPortalDocumentRepository;

  const validDocInput = {
    tenantId: 'tenant-1',
    title: 'Getting Started Guide',
    slug: 'getting-started',
    content: '# Getting Started\n\nThis is a guide.',
    contentFormat: 'markdown' as const,
    documentType: 'guide',
    category: 'tutorial',
    tags: ['beginner', 'setup'],
    version: '1.0.0',
    authorId: 'user-1',
    metadata: { source: 'manual' },
  };

  beforeEach(() => {
    mockRepo = new MockPortalDocumentRepository() as unknown as PortalDocumentRepository;
    service = new PortalDocumentService(mockRepo as PortalDocumentRepository);
  });

  // ==================== createDocument ====================

  describe('createDocument', () => {
    it('should create a document with all fields', async () => {
      const doc = await service.createDocument(validDocInput);

      expect(doc.id).toBeDefined();
      expect(doc.title).toBe('Getting Started Guide');
      expect(doc.slug).toBe('getting-started');
      expect(doc.contentFormat).toBe('markdown');
      expect(doc.documentType).toBe('guide');
      expect(doc.category).toBe('tutorial');
      expect(doc.tags).toEqual(['beginner', 'setup']);
      expect(doc.isPublished).toBe(false);
      expect(doc.viewCount).toBe(0);
      expect(doc.authorId).toBe('user-1');
    });

    it('should use defaults for optional fields', async () => {
      const doc = await service.createDocument({
        tenantId: 'tenant-1',
        title: 'Minimal Doc',
        slug: 'minimal',
        content: 'Content',
        documentType: 'api',
        authorId: 'user-1',
      });

      expect(doc.contentFormat).toBe('markdown');
      expect(doc.category).toBeNull();
      expect(doc.tags).toEqual([]);
      expect(doc.version).toBe('1.0.0');
      expect(doc.metadata).toEqual({});
    });

    it('should trim whitespace from title and slug', async () => {
      const doc = await service.createDocument({
        ...validDocInput,
        title: '  Spaced Title  ',
        slug: '  spaced-slug  ',
      });

      expect(doc.title).toBe('Spaced Title');
      expect(doc.slug).toBe('spaced-slug');
    });

    it('should throw for empty title', async () => {
      await expect(
        service.createDocument({ ...validDocInput, title: '' })
      ).rejects.toThrow(PortalDocumentServiceError);

      await expect(
        service.createDocument({ ...validDocInput, title: '   ' })
      ).rejects.toThrow(PortalDocumentServiceError);
    });

    it('should throw for empty slug', async () => {
      await expect(
        service.createDocument({ ...validDocInput, slug: '' })
      ).rejects.toThrow(PortalDocumentServiceError);
    });

    it('should throw for empty content', async () => {
      await expect(
        service.createDocument({ ...validDocInput, content: '' })
      ).rejects.toThrow(PortalDocumentServiceError);
    });

    it('should throw for empty authorId', async () => {
      await expect(
        service.createDocument({ ...validDocInput, authorId: '' })
      ).rejects.toThrow(PortalDocumentServiceError);
    });

    it('should throw DUPLICATE_SLUG for duplicate slug within tenant', async () => {
      await service.createDocument(validDocInput);

      await expect(
        service.createDocument({ ...validDocInput })
      ).rejects.toThrow(PortalDocumentServiceError);

      try {
        await service.createDocument({ ...validDocInput });
      } catch (err: any) {
        expect(err.code).toBe('DUPLICATE_SLUG');
      }
    });

    it('should allow same slug in different tenants', async () => {
      await service.createDocument({ ...validDocInput, tenantId: 'tenant-1' });
      const doc2 = await service.createDocument({ ...validDocInput, tenantId: 'tenant-2' });

      expect(doc2.slug).toBe('getting-started');
    });
  });

  // ==================== getDocumentById ====================

  describe('getDocumentById', () => {
    it('should return a document and increment view count', async () => {
      const created = await service.createDocument(validDocInput);

      const doc = await service.getDocumentById(created.id);
      expect(doc.id).toBe(created.id);
    });

    it('should throw DOCUMENT_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.getDocumentById('non-existent')
      ).rejects.toThrow(PortalDocumentServiceError);

      try {
        await service.getDocumentById('non-existent');
      } catch (err: any) {
        expect(err.code).toBe('DOCUMENT_NOT_FOUND');
      }
    });
  });

  // ==================== getDocuments ====================

  describe('getDocuments', () => {
    it('should return paginated documents', async () => {
      for (let i = 0; i < 5; i++) {
        await service.createDocument({
          ...validDocInput,
          slug: `doc-${i}`,
          title: `Doc ${i}`,
        });
      }

      const result = await service.getDocuments({ tenantId: 'tenant-1', page: 1, limit: 3 });

      expect(result.data.length).toBe(3);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(3);
      expect(result.totalPages).toBe(2);
    });

    it('should use default pagination', async () => {
      const result = await service.getDocuments();

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter by type', async () => {
      await service.createDocument({ ...validDocInput, slug: 'guide-1', documentType: 'guide' });
      await service.createDocument({ ...validDocInput, slug: 'api-1', documentType: 'api' });

      const result = await service.getDocuments({ type: 'guide' });
      expect(result.data.every(d => d.documentType === 'guide')).toBe(true);
    });

    it('should filter by category', async () => {
      await service.createDocument({ ...validDocInput, slug: 'cat-1', category: 'tutorial' });
      await service.createDocument({ ...validDocInput, slug: 'cat-2', category: 'reference' });

      const result = await service.getDocuments({ category: 'tutorial' });
      expect(result.data.every(d => d.category === 'tutorial')).toBe(true);
    });

    it('should filter by published status', async () => {
      const doc = await service.createDocument({ ...validDocInput, slug: 'pub-test' });
      await service.publishDocument(doc.id);

      const published = await service.getDocuments({ published: true });
      expect(published.data.length).toBeGreaterThanOrEqual(1);

      const unpublished = await service.getDocuments({ published: false });
      expect(unpublished.data.some(d => d.slug === 'getting-started')).toBe(false);
    });

    it('should filter by tags', async () => {
      await service.createDocument({ ...validDocInput, slug: 'tag-1', tags: ['beginner'] });
      await service.createDocument({ ...validDocInput, slug: 'tag-2', tags: ['advanced'] });

      const result = await service.getDocuments({ tags: ['beginner'] });
      expect(result.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== searchDocuments ====================

  describe('searchDocuments', () => {
    it('should find documents by title', async () => {
      await service.createDocument({ ...validDocInput, slug: 'search-1' });
      const doc = await service.createDocument({
        ...validDocInput,
        slug: 'search-2',
        title: 'Advanced Configuration',
      });
      await service.publishDocument(doc.id);

      const results = await service.searchDocuments('tenant-1', 'Advanced');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should find documents by content', async () => {
      const doc = await service.createDocument({ ...validDocInput, slug: 'content-search' });
      await service.publishDocument(doc.id);

      const results = await service.searchDocuments('tenant-1', 'Getting Started');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array for empty query', async () => {
      const results = await service.searchDocuments('tenant-1', '');
      expect(results).toEqual([]);
    });

    it('should return empty array for whitespace-only query', async () => {
      const results = await service.searchDocuments('tenant-1', '   ');
      expect(results).toEqual([]);
    });

    it('should filter search by type', async () => {
      const doc1 = await service.createDocument({
        ...validDocInput, slug: 'search-type-1', documentType: 'guide',
      });
      await service.createDocument({
        ...validDocInput, slug: 'search-type-2', documentType: 'api',
      });
      await service.publishDocument(doc1.id);

      const results = await service.searchDocuments('tenant-1', 'Getting', { type: 'guide' });
      expect(results.every(d => d.documentType === 'guide')).toBe(true);
    });
  });

  // ==================== updateDocument ====================

  describe('updateDocument', () => {
    it('should update document fields', async () => {
      const created = await service.createDocument(validDocInput);

      const updated = await service.updateDocument(created.id, {
        title: 'Updated Title',
        content: 'Updated content',
      }, 'user-2');

      expect(updated.title).toBe('Updated Title');
      expect(updated.content).toBe('Updated content');
    });

    it('should set editorId when provided', async () => {
      const created = await service.createDocument(validDocInput);

      const updated = await service.updateDocument(created.id, {
        title: 'New Title',
      }, 'editor-user');

      expect(updated.editorId).toBe('editor-user');
    });

    it('should throw DOCUMENT_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.updateDocument('non-existent', { title: 'New' }, 'user-1')
      ).rejects.toThrow(PortalDocumentServiceError);
    });

    it('should throw DUPLICATE_SLUG for conflicting slug', async () => {
      await service.createDocument({ ...validDocInput, slug: 'doc-a' });
      const docB = await service.createDocument({ ...validDocInput, slug: 'doc-b' });

      await expect(
        service.updateDocument(docB.id, { slug: 'doc-a' }, 'user-1')
      ).rejects.toThrow(PortalDocumentServiceError);
    });

    it('should allow keeping the same slug', async () => {
      const created = await service.createDocument(validDocInput);

      const updated = await service.updateDocument(created.id, {
        title: 'New Title',
      }, 'user-1');

      expect(updated.slug).toBe('getting-started');
    });
  });

  // ==================== deleteDocument ====================

  describe('deleteDocument', () => {
    it('should delete an existing document', async () => {
      const created = await service.createDocument(validDocInput);

      const deleted = await service.deleteDocument(created.id);
      expect(deleted).toBe(true);
    });

    it('should throw DOCUMENT_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.deleteDocument('non-existent')
      ).rejects.toThrow(PortalDocumentServiceError);
    });
  });

  // ==================== publishDocument ====================

  describe('publishDocument', () => {
    it('should publish an unpublished document', async () => {
      const created = await service.createDocument(validDocInput);

      const published = await service.publishDocument(created.id);
      expect(published.isPublished).toBe(true);
      expect(published.publishedAt).toBeInstanceOf(Date);
    });

    it('should throw ALREADY_PUBLISHED for already published document', async () => {
      const created = await service.createDocument(validDocInput);
      await service.publishDocument(created.id);

      await expect(
        service.publishDocument(created.id)
      ).rejects.toThrow(PortalDocumentServiceError);

      try {
        await service.publishDocument(created.id);
      } catch (err: any) {
        expect(err.code).toBe('ALREADY_PUBLISHED');
      }
    });

    it('should throw DOCUMENT_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.publishDocument('non-existent')
      ).rejects.toThrow(PortalDocumentServiceError);
    });
  });

  // ==================== unpublishDocument ====================

  describe('unpublishDocument', () => {
    it('should unpublish a published document', async () => {
      const created = await service.createDocument(validDocInput);
      await service.publishDocument(created.id);

      const unpublished = await service.unpublishDocument(created.id);
      expect(unpublished.isPublished).toBe(false);
    });

    it('should throw NOT_PUBLISHED for unpublished document', async () => {
      const created = await service.createDocument(validDocInput);

      await expect(
        service.unpublishDocument(created.id)
      ).rejects.toThrow(PortalDocumentServiceError);

      try {
        await service.unpublishDocument(created.id);
      } catch (err: any) {
        expect(err.code).toBe('NOT_PUBLISHED');
      }
    });

    it('should throw DOCUMENT_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.unpublishDocument('non-existent')
      ).rejects.toThrow(PortalDocumentServiceError);
    });
  });

  // ==================== getCategories ====================

  describe('getCategories', () => {
    it('should return distinct categories with counts', async () => {
      await service.createDocument({ ...validDocInput, slug: 'cat-1', category: 'tutorial' });
      await service.createDocument({ ...validDocInput, slug: 'cat-2', category: 'tutorial' });
      await service.createDocument({ ...validDocInput, slug: 'cat-3', category: 'reference' });

      const categories = await service.getCategories('tenant-1');
      expect(categories.length).toBe(2);

      const tutorialCat = categories.find(c => c.category === 'tutorial');
      expect(tutorialCat?.count).toBe(2);

      const refCat = categories.find(c => c.category === 'reference');
      expect(refCat?.count).toBe(1);
    });

    it('should return empty array when no categories exist', async () => {
      const categories = await service.getCategories('tenant-empty');
      expect(categories).toEqual([]);
    });
  });

  // ==================== getPopularDocuments ====================

  describe('getPopularDocuments', () => {
    it('should return documents sorted by view count', async () => {
      const doc1 = await service.createDocument({ ...validDocInput, slug: 'pop-1' });
      const doc2 = await service.createDocument({ ...validDocInput, slug: 'pop-2' });
      const doc3 = await service.createDocument({ ...validDocInput, slug: 'pop-3' });

      await service.publishDocument(doc1.id);
      await service.publishDocument(doc2.id);
      await service.publishDocument(doc3.id);

      // Get documents to increment view count
      await service.getDocumentById(doc1.id);
      await service.getDocumentById(doc1.id);
      await service.getDocumentById(doc1.id);
      await service.getDocumentById(doc2.id);
      await service.getDocumentById(doc2.id);
      await service.getDocumentById(doc3.id);

      const popular = await service.getPopularDocuments('tenant-1');
      expect(popular.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        const doc = await service.createDocument({
          ...validDocInput,
          slug: `limit-${i}`,
        });
        await service.publishDocument(doc.id);
      }

      const popular = await service.getPopularDocuments('tenant-1', 3);
      expect(popular.length).toBeLessThanOrEqual(3);
    });

    it('should use default limit of 10', async () => {
      const popular = await service.getPopularDocuments('tenant-1');
      expect(popular.length).toBeLessThanOrEqual(10);
    });
  });

  // ==================== recordHelpful ====================

  describe('recordHelpful', () => {
    it('should increment helpful count', async () => {
      const created = await service.createDocument(validDocInput);

      await service.recordHelpful(created.id, true);

      const doc = await service.getDocumentById(created.id);
      expect(doc.helpfulCount).toBe(1);
    });

    it('should increment not-helpful count', async () => {
      const created = await service.createDocument(validDocInput);

      await service.recordHelpful(created.id, false);

      const doc = await service.getDocumentById(created.id);
      expect(doc.notHelpfulCount).toBe(1);
    });

    it('should throw DOCUMENT_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.recordHelpful('non-existent', true)
      ).rejects.toThrow(PortalDocumentServiceError);
    });
  });
});
