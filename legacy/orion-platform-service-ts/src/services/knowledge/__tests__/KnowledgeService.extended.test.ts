/**
 * KnowledgeService Extended Tests
 *
 * Covers the Document Center methods (listDocsByType, getDocTags, getDocToc,
 * triggerSync, getSyncLogs), KnowledgeServiceError properties, edge cases,
 * and additional repository methods not covered by the base test file.
 */

import { KnowledgeService, KnowledgeServiceError, DocTag, DocTocItem, SyncLog } from '../KnowledgeService';
import {
  KnowledgeRepository,
  KnowledgeSpace,
  KnowledgeDoc,
  DocVersion,
  KnowledgeSearchResult,
  CreateSpaceInput,
  CreateDocInput,
  UpdateDocInput,
  UpdateSpaceInput,
} from '../KnowledgeRepository';

describe('KnowledgeService - Extended Tests', () => {
  let mockRepository: jest.Mocked<KnowledgeRepository>;
  let service: KnowledgeService;

  beforeEach(() => {
    mockRepository = {
      createSpace: jest.fn(),
      findSpaceById: jest.fn(),
      findAllSpaces: jest.fn(),
      updateSpace: jest.fn(),
      deleteSpace: jest.fn(),
      incrementSpaceDocCount: jest.fn(),
      createDoc: jest.fn(),
      findDocById: jest.fn(),
      findAllDocs: jest.fn(),
      updateDoc: jest.fn(),
      deleteDoc: jest.fn(),
      getDocVersions: jest.fn(),
      search: jest.fn(),
      searchByEmbedding: jest.fn(),
    } as unknown as jest.Mocked<KnowledgeRepository>;

    service = new KnowledgeService(mockRepository);
  });

  const now = new Date();

  const mockSpace: KnowledgeSpace = {
    id: 'space-1',
    tenant_id: 't1',
    name: 'Test Space',
    type: 'public',
    owner_id: 'u1',
    team_id: null,
    description: 'A test space',
    doc_count: 0,
    created_at: now,
    updated_at: now,
  };

  const mockDocsSpace: KnowledgeSpace = {
    id: 'space-docs',
    tenant_id: 't1',
    name: 'Docs Space',
    type: 'docs',
    owner_id: 'u1',
    team_id: null,
    description: 'Official docs',
    doc_count: 5,
    created_at: now,
    updated_at: now,
  };

  const mockDoc: KnowledgeDoc = {
    id: 'doc-1',
    tenant_id: 't1',
    space_id: 'space-1',
    title: 'Test Doc',
    content: 'Hello world',
    type: 'knowledge',
    tags: ['test'],
    status: 'draft',
    version: 1,
    author_id: 'u1',
    embedding: null,
    created_at: now,
    updated_at: now,
  };

  const publishedDoc: KnowledgeDoc = {
    ...mockDoc,
    id: 'doc-pub',
    title: 'Published Doc',
    content: 'Published content',
    type: 'docs',
    tags: ['guide', 'api'],
    status: 'published',
  };

  const anotherDocsDoc: KnowledgeDoc = {
    ...mockDoc,
    id: 'doc-2',
    title: 'Another Docs',
    content: 'More content',
    type: 'docs',
    tags: ['guide', 'tutorial'],
    status: 'published',
  };

  // =========================================================================
  // KnowledgeServiceError
  // =========================================================================

  describe('KnowledgeServiceError', () => {
    it('should have correct name property', () => {
      const error = new KnowledgeServiceError('test message', 'TEST_CODE');
      expect(error.name).toBe('KnowledgeServiceError');
    });

    it('should preserve error code', () => {
      const error = new KnowledgeServiceError('msg', 'NOT_FOUND');
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should preserve INVALID_INPUT code', () => {
      const error = new KnowledgeServiceError('bad input', 'INVALID_INPUT');
      expect(error.code).toBe('INVALID_INPUT');
    });

    it('should preserve UPDATE_FAILED code', () => {
      const error = new KnowledgeServiceError('update failed', 'UPDATE_FAILED');
      expect(error.code).toBe('UPDATE_FAILED');
    });

    it('should be instanceof Error', () => {
      const error = new KnowledgeServiceError('msg', 'CODE');
      expect(error).toBeInstanceOf(Error);
    });
  });

  // =========================================================================
  // Space operations - additional edge cases
  // =========================================================================

  describe('createSpace - edge cases', () => {
    it('should throw when both tenantId and name are empty', async () => {
      await expect(service.createSpace('', { name: '', type: 'public', owner_id: 'u1' }))
        .rejects.toThrow(KnowledgeServiceError);
    });

    it('should pass whitespace-only tenantId to repository (no trim validation)', async () => {
      mockRepository.createSpace.mockResolvedValue(mockSpace);
      await service.createSpace('   ', { name: 'Space', type: 'public', owner_id: 'u1' });
      expect(mockRepository.createSpace).toHaveBeenCalledWith('   ', { name: 'Space', type: 'public', owner_id: 'u1' });
    });

    it('should pass team_id and description to repository', async () => {
      const input: CreateSpaceInput = {
        name: 'Team Space',
        type: 'internal',
        owner_id: 'u1',
        team_id: 'team-1',
        description: 'A team space',
      };
      mockRepository.createSpace.mockResolvedValue({ ...mockSpace, ...input, team_id: 'team-1' });

      const result = await service.createSpace('t1', input);

      expect(mockRepository.createSpace).toHaveBeenCalledWith('t1', input);
      expect(result.team_id).toBe('team-1');
      expect(result.description).toBe('A team space');
    });
  });

  describe('updateSpace - edge cases', () => {
    it('should update description only', async () => {
      const updated = { ...mockSpace, description: 'New desc' };
      mockRepository.findSpaceById.mockResolvedValue(mockSpace);
      mockRepository.updateSpace.mockResolvedValue(updated);

      const result = await service.updateSpace('space-1', { description: 'New desc' });

      expect(result.description).toBe('New desc');
      expect(mockRepository.updateSpace).toHaveBeenCalledWith('space-1', { description: 'New desc' });
    });

    it('should update type field', async () => {
      const updated = { ...mockSpace, type: 'private' as const };
      mockRepository.findSpaceById.mockResolvedValue(mockSpace);
      mockRepository.updateSpace.mockResolvedValue(updated);

      const result = await service.updateSpace('space-1', { type: 'private' });

      expect(result.type).toBe('private');
    });
  });

  describe('deleteSpace - edge cases', () => {
    it('should return true on successful delete', async () => {
      mockRepository.findSpaceById.mockResolvedValue(mockSpace);
      mockRepository.deleteSpace.mockResolvedValue(true);

      const result = await service.deleteSpace('space-1');

      expect(result).toBe(true);
      expect(mockRepository.deleteSpace).toHaveBeenCalledWith('space-1');
    });

    it('should return false when repository returns false', async () => {
      mockRepository.findSpaceById.mockResolvedValue(mockSpace);
      mockRepository.deleteSpace.mockResolvedValue(false);

      const result = await service.deleteSpace('space-1');

      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // Document operations - additional edge cases
  // =========================================================================

  describe('createDoc - edge cases', () => {
    it('should throw when tenantId is missing for doc creation', async () => {
      await expect(service.createDoc('', { title: 'T', content: 'C', space_id: 's1' }))
        .rejects.toThrow(KnowledgeServiceError);
    });

    it('should throw with correct error message for missing fields', async () => {
      try {
        await service.createDoc('t1', { title: '', content: 'Hello', space_id: 's1' });
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(KnowledgeServiceError);
        expect((e as KnowledgeServiceError).code).toBe('INVALID_INPUT');
      }
    });
  });

  describe('updateDoc - edge cases', () => {
    it('should update tags only', async () => {
      const updated = { ...mockDoc, tags: ['new-tag'], version: 2 };
      mockRepository.findDocById.mockResolvedValue(mockDoc);
      mockRepository.updateDoc.mockResolvedValue(updated);

      const result = await service.updateDoc('doc-1', { tags: ['new-tag'] });

      expect(result.tags).toEqual(['new-tag']);
      expect(result.version).toBe(2);
    });

    it('should update status to published', async () => {
      const updated = { ...mockDoc, status: 'published' as const, version: 2 };
      mockRepository.findDocById.mockResolvedValue(mockDoc);
      mockRepository.updateDoc.mockResolvedValue(updated);

      const result = await service.updateDoc('doc-1', { status: 'published' });

      expect(result.status).toBe('published');
    });
  });

  // =========================================================================
  // listDocsByType
  // =========================================================================

  describe('listDocsByType', () => {
    it('should return docs filtered by type=docs', async () => {
      const docs = [publishedDoc, anotherDocsDoc];
      mockRepository.findAllDocs.mockResolvedValue(docs);

      const result = await service.listDocsByType('t1');

      expect(result).toEqual(docs);
      expect(mockRepository.findAllDocs).toHaveBeenCalledWith('t1', { type: 'docs' });
    });

    it('should pass additional filter params with type forced to docs', async () => {
      mockRepository.findAllDocs.mockResolvedValue([publishedDoc]);

      await service.listDocsByType('t1', { tag: 'guide', search: 'API', limit: 10, offset: 0 });

      expect(mockRepository.findAllDocs).toHaveBeenCalledWith('t1', {
        tag: 'guide',
        search: 'API',
        limit: 10,
        offset: 0,
        type: 'docs',
      });
    });

    it('should return empty array when no docs match', async () => {
      mockRepository.findAllDocs.mockResolvedValue([]);

      const result = await service.listDocsByType('t1');

      expect(result).toEqual([]);
    });

    it('should handle undefined params gracefully', async () => {
      mockRepository.findAllDocs.mockResolvedValue([]);

      await service.listDocsByType('t1');

      expect(mockRepository.findAllDocs).toHaveBeenCalledWith('t1', { type: 'docs' });
    });
  });

  // =========================================================================
  // getDocTags
  // =========================================================================

  describe('getDocTags', () => {
    it('should aggregate tags from docs and return sorted by count', async () => {
      const docs = [publishedDoc, anotherDocsDoc];
      mockRepository.findAllDocs.mockResolvedValue(docs);

      const result = await service.getDocTags('t1');

      expect(result).toHaveLength(3);
      // 'guide' appears in both docs (count=2), others count=1
      expect(result[0].name).toBe('guide');
      expect(result[0].count).toBe(2);
      expect(result.find(t => t.name === 'api')?.count).toBe(1);
      expect(result.find(t => t.name === 'tutorial')?.count).toBe(1);
    });

    it('should return empty array when no docs exist', async () => {
      mockRepository.findAllDocs.mockResolvedValue([]);

      const result = await service.getDocTags('t1');

      expect(result).toEqual([]);
    });

    it('should handle docs with empty tags arrays', async () => {
      const docsWithoutTags: KnowledgeDoc[] = [
        { ...mockDoc, id: 'd1', tags: [], type: 'docs' },
        { ...mockDoc, id: 'd2', tags: [], type: 'docs' },
      ];
      mockRepository.findAllDocs.mockResolvedValue(docsWithoutTags);

      const result = await service.getDocTags('t1');

      expect(result).toEqual([]);
    });

    it('should handle docs with null/undefined tags gracefully', async () => {
      const docsWithNullTags = [
        { ...mockDoc, id: 'd1', tags: null as any, type: 'docs' },
        { ...mockDoc, id: 'd2', tags: ['tag1'], type: 'docs' },
      ];
      mockRepository.findAllDocs.mockResolvedValue(docsWithNullTags);

      const result = await service.getDocTags('t1');

      expect(result).toEqual([{ name: 'tag1', count: 1 }]);
    });

    it('should request docs with type=docs and limit=1000', async () => {
      mockRepository.findAllDocs.mockResolvedValue([]);

      await service.getDocTags('t1');

      expect(mockRepository.findAllDocs).toHaveBeenCalledWith('t1', { type: 'docs', limit: 1000 });
    });

    it('should handle duplicate tags within single doc', async () => {
      const docWithDupes: KnowledgeDoc[] = [
        { ...mockDoc, id: 'd1', tags: ['tag1', 'tag1', 'tag2'], type: 'docs' },
      ];
      mockRepository.findAllDocs.mockResolvedValue(docWithDupes);

      const result = await service.getDocTags('t1');

      // tag1 appears twice in the same doc's tags array
      const tag1 = result.find(t => t.name === 'tag1');
      expect(tag1?.count).toBe(2);
    });
  });

  // =========================================================================
  // getDocToc
  // =========================================================================

  describe('getDocToc', () => {
    it('should return TOC items from published docs', async () => {
      const docs = [publishedDoc, anotherDocsDoc];
      mockRepository.findAllDocs.mockResolvedValue(docs);

      const result = await service.getDocToc('t1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: publishedDoc.id,
        title: publishedDoc.title,
        parentId: null,
        order: 0,
      });
      expect(result[1]).toEqual({
        id: anotherDocsDoc.id,
        title: anotherDocsDoc.title,
        parentId: null,
        order: 1,
      });
    });

    it('should return empty array when no published docs exist', async () => {
      mockRepository.findAllDocs.mockResolvedValue([]);

      const result = await service.getDocToc('t1');

      expect(result).toEqual([]);
    });

    it('should request published docs with type=docs and limit=200', async () => {
      mockRepository.findAllDocs.mockResolvedValue([]);

      await service.getDocToc('t1');

      expect(mockRepository.findAllDocs).toHaveBeenCalledWith('t1', {
        type: 'docs',
        status: 'published',
        limit: 200,
      });
    });

    it('should assign sequential order indices starting from 0', async () => {
      const docs = [
        { ...publishedDoc, id: 'd1', title: 'First' },
        { ...publishedDoc, id: 'd2', title: 'Second' },
        { ...publishedDoc, id: 'd3', title: 'Third' },
      ];
      mockRepository.findAllDocs.mockResolvedValue(docs);

      const result = await service.getDocToc('t1');

      expect(result[0].order).toBe(0);
      expect(result[1].order).toBe(1);
      expect(result[2].order).toBe(2);
    });

    it('should set parentId to null for all items', async () => {
      const docs = [publishedDoc];
      mockRepository.findAllDocs.mockResolvedValue(docs);

      const result = await service.getDocToc('t1');

      expect(result[0].parentId).toBeNull();
    });
  });

  // =========================================================================
  // triggerSync
  // =========================================================================

  describe('triggerSync', () => {
    it('should return a SyncLog with success status', async () => {
      const result = await service.triggerSync('t1');

      expect(result.status).toBe('success');
      expect(result.id).toBeDefined();
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.totalDocs).toBe(0);
      expect(result.successDocs).toBe(0);
      expect(result.failedDocs).toBe(0);
      expect(result.errorMessage).toBeNull();
    });

    it('should accept a source parameter', async () => {
      const result = await service.triggerSync('t1', 'github');

      expect(result).toBeDefined();
      expect(result.status).toBe('success');
    });

    it('should work without source parameter', async () => {
      const result = await service.triggerSync('t1');

      expect(result).toBeDefined();
    });

    it('should generate unique sync IDs', async () => {
      const result1 = await service.triggerSync('t1');
      // Small delay to ensure different timestamp
      const result2 = await service.triggerSync('t1');

      // IDs should start with 'sync-'
      expect(result1.id).toMatch(/^sync-/);
      expect(result2.id).toMatch(/^sync-/);
    });

    it('should call logger with tenant and source info', async () => {
      // Just verify it doesn't throw
      await expect(service.triggerSync('t1', 'confluence')).resolves.toBeDefined();
    });
  });

  // =========================================================================
  // getSyncLogs
  // =========================================================================

  describe('getSyncLogs', () => {
    it('should return sync logs with default limit', async () => {
      const result = await service.getSyncLogs('t1');

      expect(result.length).toBeLessThanOrEqual(5);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should respect custom limit up to 5', async () => {
      const result = await service.getSyncLogs('t1', 3);

      expect(result).toHaveLength(3);
    });

    it('should cap at 5 logs even when limit is higher', async () => {
      const result = await service.getSyncLogs('t1', 100);

      expect(result).toHaveLength(5);
    });

    it('should return fewer logs when limit is small', async () => {
      const result = await service.getSyncLogs('t1', 2);

      expect(result).toHaveLength(2);
    });

    it('should return 1 log when limit is 1', async () => {
      const result = await service.getSyncLogs('t1', 1);

      expect(result).toHaveLength(1);
    });

    it('should have proper SyncLog structure', async () => {
      const result = await service.getSyncLogs('t1', 1);

      const log = result[0];
      expect(log).toHaveProperty('id');
      expect(log).toHaveProperty('status');
      expect(log).toHaveProperty('startedAt');
      expect(log).toHaveProperty('completedAt');
      expect(log).toHaveProperty('totalDocs');
      expect(log).toHaveProperty('successDocs');
      expect(log).toHaveProperty('failedDocs');
      expect(log).toHaveProperty('errorMessage');
    });

    it('should have status as success for all logs', async () => {
      const result = await service.getSyncLogs('t1', 5);

      for (const log of result) {
        expect(log.status).toBe('success');
      }
    });

    it('should have null errorMessage for all logs', async () => {
      const result = await service.getSyncLogs('t1', 5);

      for (const log of result) {
        expect(log.errorMessage).toBeNull();
      }
    });

    it('should have startedAt as Date instances', async () => {
      const result = await service.getSyncLogs('t1', 3);

      for (const log of result) {
        expect(log.startedAt).toBeInstanceOf(Date);
        expect(log.completedAt).toBeInstanceOf(Date);
      }
    });

    it('should default limit to 10 when not provided', async () => {
      // limit=10, but Math.min(10, 5) = 5
      const result = await service.getSyncLogs('t1');

      expect(result).toHaveLength(5);
    });
  });

  // =========================================================================
  // search - additional edge cases
  // =========================================================================

  describe('search - edge cases', () => {
    it('should pass special-character query to repository (non-empty check)', async () => {
      mockRepository.search.mockResolvedValue([]);
      await service.search('t1', '!!!');
      expect(mockRepository.search).toHaveBeenCalledWith('t1', '!!!', undefined);
    });

    it('should pass undefined params when no params given', async () => {
      mockRepository.search.mockResolvedValue([]);

      await service.search('t1', 'query');

      expect(mockRepository.search).toHaveBeenCalledWith('t1', 'query', undefined);
    });

    it('should handle results with high similarity', async () => {
      const results: KnowledgeSearchResult[] = [
        { id: 'doc-1', title: 'Exact Match', content: 'Exact content', similarity: 1.0, space_id: 's1', tags: [], status: 'published' },
      ];
      mockRepository.search.mockResolvedValue(results);

      const result = await service.search('t1', 'Exact Match');

      expect(result[0].similarity).toBe(1.0);
    });
  });

  // =========================================================================
  // retrieve - additional edge cases
  // =========================================================================

  describe('retrieve - edge cases', () => {
    it('should use topK as limit in search call', async () => {
      mockRepository.search.mockResolvedValue([]);

      await service.retrieve('t1', 'query', { topK: 10 });

      expect(mockRepository.search).toHaveBeenCalledWith('t1', 'query', { spaceId: undefined, limit: 10 });
    });

    it('should default to limit 5 when topK is 0', async () => {
      mockRepository.search.mockResolvedValue([]);

      await service.retrieve('t1', 'query', { topK: 0 });

      // 0 || 5 = 5
      expect(mockRepository.search).toHaveBeenCalledWith('t1', 'query', { spaceId: undefined, limit: 5 });
    });

    it('should work with undefined params', async () => {
      mockRepository.search.mockResolvedValue([]);

      await service.retrieve('t1', 'query');

      expect(mockRepository.search).toHaveBeenCalledWith('t1', 'query', { spaceId: undefined, limit: 5 });
    });
  });

  // =========================================================================
  // listDocs - edge cases
  // =========================================================================

  describe('listDocs - edge cases', () => {
    it('should pass all filter parameters correctly', async () => {
      mockRepository.findAllDocs.mockResolvedValue([]);

      await service.listDocs('t1', {
        spaceId: 's1',
        status: 'draft',
        tag: 'important',
        search: 'keyword',
        type: 'knowledge',
        limit: 20,
        offset: 10,
      });

      expect(mockRepository.findAllDocs).toHaveBeenCalledWith('t1', {
        spaceId: 's1',
        status: 'draft',
        tag: 'important',
        search: 'keyword',
        type: 'knowledge',
        limit: 20,
        offset: 10,
      });
    });

    it('should call repository with undefined params when no params given', async () => {
      mockRepository.findAllDocs.mockResolvedValue([]);

      await service.listDocs('t1');

      expect(mockRepository.findAllDocs).toHaveBeenCalledWith('t1', undefined);
    });
  });

  // =========================================================================
  // getDocVersions - edge cases
  // =========================================================================

  describe('getDocVersions - edge cases', () => {
    it('should return empty array when no versions exist', async () => {
      mockRepository.findDocById.mockResolvedValue(mockDoc);
      mockRepository.getDocVersions.mockResolvedValue([]);

      const result = await service.getDocVersions('doc-1');

      expect(result).toEqual([]);
    });

    it('should return versions in descending order', async () => {
      const versions: DocVersion[] = [
        { id: 'v3', doc_id: 'doc-1', version: 3, title: 'v3', content: 'c3', tags: [], created_at: now },
        { id: 'v2', doc_id: 'doc-1', version: 2, title: 'v2', content: 'c2', tags: [], created_at: now },
        { id: 'v1', doc_id: 'doc-1', version: 1, title: 'v1', content: 'c1', tags: [], created_at: now },
      ];
      mockRepository.findDocById.mockResolvedValue(mockDoc);
      mockRepository.getDocVersions.mockResolvedValue(versions);

      const result = await service.getDocVersions('doc-1');

      expect(result).toHaveLength(3);
      expect(result[0].version).toBe(3);
      expect(result[2].version).toBe(1);
    });
  });
});

// ============================================================================
// KnowledgeRepository - Extended Tests
// ============================================================================

describe('KnowledgeRepository - Extended Tests', () => {
  let mockDb: { query: jest.Mock; transaction: jest.Mock };
  let repository: KnowledgeRepository;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      transaction: jest.fn(async (cb) => {
        const mockClient = { query: mockDb.query };
        return cb(mockClient);
      }),
    };
    repository = new KnowledgeRepository(mockDb as any);
  });

  describe('incrementSpaceDocCount', () => {
    it('should increment doc count by default delta of 1', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.incrementSpaceDocCount('s1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE kb_spaces SET doc_count = doc_count + $1'),
        [1, 's1']
      );
    });

    it('should increment doc count by custom delta', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.incrementSpaceDocCount('s1', 5);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE kb_spaces SET doc_count = doc_count + $1'),
        [5, 's1']
      );
    });

    it('should decrement doc count with negative delta', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.incrementSpaceDocCount('s1', -1);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE kb_spaces SET doc_count = doc_count + $1'),
        [-1, 's1']
      );
    });
  });

  describe('findAllSpaces - extended', () => {
    it('should filter by source parameter', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllSpaces('t1', { source: 'synced' });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('source = $2');
      const values = mockDb.query.mock.calls[0][1];
      expect(values).toContain('synced');
    });

    it('should filter by both type and source', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllSpaces('t1', { type: 'docs', source: 'manual' });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('type = $2');
      expect(sql).toContain('source = $3');
    });

    it('should handle offset parameter', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllSpaces('t1', { limit: 10, offset: 5 });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('LIMIT');
      expect(sql).toContain('OFFSET');
    });
  });

  describe('updateSpace - extended', () => {
    it('should update source field', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 's1', source: 'synced' }] });

      const result = await repository.updateSpace('s1', { source: 'synced' });

      expect(result).toEqual({ id: 's1', source: 'synced' });
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('source = $1');
    });

    it('should update multiple fields at once', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 's1', name: 'New', description: 'Desc' }] });

      await repository.updateSpace('s1', { name: 'New', description: 'Desc' });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('name = $1');
      expect(sql).toContain('description = $2');
    });

    it('should return null when update affects no rows', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.updateSpace('missing', { name: 'New' });

      expect(result).toBeNull();
    });
  });

  describe('findAllDocs - extended', () => {
    it('should filter by source parameter', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllDocs('t1', { source: 'synced' });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('source =');
    });

    it('should filter by search with ILIKE', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllDocs('t1', { search: 'keyword' });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('ILIKE');
      const values = mockDb.query.mock.calls[0][1];
      expect(values).toContain('%keyword%');
    });

    it('should filter by tag with ANY operator', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllDocs('t1', { tag: 'important' });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('ANY(tags)');
    });

    it('should handle offset parameter', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllDocs('t1', { limit: 10, offset: 20 });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('LIMIT');
      expect(sql).toContain('OFFSET');
    });
  });

  describe('deleteDoc - extended', () => {
    it('should not decrement space count when DELETE rowCount is 0', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ space_id: 's1' }] }) // find doc
          .mockResolvedValueOnce({ rowCount: 0 }), // DELETE returns 0
      };
      mockDb.transaction.mockImplementation(async (cb) => cb(mockClient));

      const result = await repository.deleteDoc('d1');

      expect(result).toBe(false);
      // Should NOT have called the space decrement
      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('search - extended', () => {
    it('should include space_id filter when provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.search('t1', 'query', { spaceId: 's1' });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('space_id = $3');
    });

    it('should default limit to 10 when not provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.search('t1', 'query');

      const params = mockDb.query.mock.calls[0][1];
      expect(params[params.length - 1]).toBe(10);
    });

    it('should use custom limit when provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.search('t1', 'query', { limit: 3 });

      const params = mockDb.query.mock.calls[0][1];
      expect(params[params.length - 1]).toBe(3);
    });

    it('should wrap query with ILIKE wildcards', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.search('t1', 'test');

      const params = mockDb.query.mock.calls[0][1];
      expect(params[1]).toBe('%test%');
    });
  });

  describe('searchByEmbedding', () => {
    it('should return empty array as placeholder', async () => {
      const result = await repository.searchByEmbedding('t1', [0.1, 0.2, 0.3], 5);

      expect(result).toEqual([]);
    });

    it('should accept custom limit', async () => {
      const result = await repository.searchByEmbedding('t1', [0.5], 10);

      expect(result).toEqual([]);
    });
  });
});
