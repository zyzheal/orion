/**
 * KnowledgeRepository - Comprehensive Unit Tests
 *
 * Covers: Space CRUD, Document CRUD with transaction, version tracking,
 * search, embedding search placeholder, edge cases, and error handling.
 */

import { KnowledgeRepository, KnowledgeSpace, KnowledgeDoc, DocVersion, KnowledgeSearchResult } from '../KnowledgeRepository';

// ─── Mock DB ────────────────────────────────────────────────────────────────

function createMockPool() {
  const mockClient = {
    query: jest.fn(),
  };
  const pool = {
    query: jest.fn(),
    transaction: jest.fn(),
  };
  // By default, transaction executes callback with mockClient
  pool.transaction.mockImplementation(async (fn: any) => fn(mockClient));
  return { pool, mockClient };
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const mockSpace: KnowledgeSpace = {
  id: 'space-1',
  tenant_id: 't1',
  name: 'Test Space',
  type: 'public',
  source: 'manual',
  owner_id: 'u1',
  team_id: null,
  description: 'A test space',
  doc_count: 0,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

const mockDoc: KnowledgeDoc = {
  id: 'doc-1',
  tenant_id: 't1',
  space_id: 'space-1',
  title: 'Test Doc',
  content: 'Hello world',
  type: 'knowledge',
  source: 'manual',
  tags: ['test'],
  status: 'draft',
  version: 1,
  author_id: 'u1',
  embedding: null,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

const mockVersion: DocVersion = {
  id: 'v1',
  doc_id: 'doc-1',
  version: 1,
  title: 'Test Doc',
  content: 'Hello world',
  tags: ['test'],
  created_at: new Date('2026-01-01'),
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('KnowledgeRepository', () => {
  let repo: KnowledgeRepository;
  let mockPool: ReturnType<typeof createMockPool>['pool'];
  let mockClient: ReturnType<typeof createMockPool>['mockClient'];

  beforeEach(() => {
    const mocks = createMockPool();
    mockPool = mocks.pool;
    mockClient = mocks.mockClient;
    repo = new KnowledgeRepository(mockPool as any);
  });

  // =========================================================================
  // Space Operations
  // =========================================================================

  describe('createSpace', () => {
    it('should create a space with all fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockSpace] });

      const result = await repo.createSpace('t1', {
        name: 'Test Space',
        type: 'public',
        owner_id: 'u1',
      });

      expect(result).toEqual(mockSpace);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO kb_spaces'),
        ['t1', 'Test Space', 'public', 'manual', 'u1', null, null],
      );
    });

    it('should create a space with optional fields', async () => {
      const spaceWithOptionals = { ...mockSpace, source: 'synced', team_id: 'team-1', description: 'Desc' };
      mockPool.query.mockResolvedValue({ rows: [spaceWithOptionals] });

      const result = await repo.createSpace('t1', {
        name: 'Test Space',
        type: 'internal',
        source: 'synced',
        owner_id: 'u1',
        team_id: 'team-1',
        description: 'Desc',
      });

      expect(result.team_id).toBe('team-1');
      expect(result.description).toBe('Desc');
      expect(result.source).toBe('synced');
    });
  });

  describe('findSpaceById', () => {
    it('should return space when found', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockSpace] });

      const result = await repo.findSpaceById('space-1');
      expect(result).toEqual(mockSpace);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM kb_spaces WHERE id = $1', ['space-1']);
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findSpaceById('missing');
      expect(result).toBeNull();
    });
  });

  describe('findAllSpaces', () => {
    it('should return all spaces for tenant', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockSpace] });

      const result = await repo.findAllSpaces('t1');
      expect(result).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        ['t1'],
      );
    });

    it('should filter by type', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockSpace] });

      await repo.findAllSpaces('t1', { type: 'public' });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND type = $2'),
        expect.arrayContaining(['t1', 'public']),
      );
    });

    it('should filter by source', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockSpace] });

      await repo.findAllSpaces('t1', { source: 'synced' });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND source = $'),
        expect.arrayContaining(['t1', 'synced']),
      );
    });

    it('should filter by search term with ILIKE', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockSpace] });

      await repo.findAllSpaces('t1', { search: 'test' });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['t1', '%test%']),
      );
    });

    it('should apply limit and offset', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAllSpaces('t1', { limit: 5, offset: 10 });
      const callArgs = mockPool.query.mock.calls[0];
      expect(callArgs[0]).toContain('LIMIT');
      expect(callArgs[0]).toContain('OFFSET');
    });

    it('should combine multiple filters', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAllSpaces('t1', { type: 'docs', source: 'synced', search: 'api', limit: 3 });
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('AND type =');
      expect(sql).toContain('AND source =');
      expect(sql).toContain('ILIKE');
      expect(sql).toContain('LIMIT');
    });
  });

  describe('updateSpace', () => {
    it('should update name field', async () => {
      const updated = { ...mockSpace, name: 'New Name' };
      mockPool.query.mockResolvedValue({ rows: [updated] });

      const result = await repo.updateSpace('space-1', { name: 'New Name' });
      expect(result!.name).toBe('New Name');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE kb_spaces SET'),
        expect.arrayContaining(['New Name', 'space-1']),
      );
    });

    it('should update multiple fields', async () => {
      const updated = { ...mockSpace, name: 'New', type: 'private' as const, description: 'Updated' };
      mockPool.query.mockResolvedValue({ rows: [updated] });

      const result = await repo.updateSpace('space-1', { name: 'New', type: 'private', description: 'Updated' });
      expect(result).not.toBeNull();
    });

    it('should return existing space when no fields to update', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockSpace] });

      const result = await repo.updateSpace('space-1', {});
      expect(result).toEqual(mockSpace);
    });

    it('should return null when space not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.updateSpace('missing', { name: 'New' });
      expect(result).toBeNull();
    });

    it('should update source field', async () => {
      const updated = { ...mockSpace, source: 'synced' as const };
      mockPool.query.mockResolvedValue({ rows: [updated] });

      const result = await repo.updateSpace('space-1', { source: 'synced' });
      expect(result!.source).toBe('synced');
    });
  });

  describe('deleteSpace', () => {
    it('should return true when space is deleted', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await repo.deleteSpace('space-1');
      expect(result).toBe(true);
    });

    it('should return false when space not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await repo.deleteSpace('missing');
      expect(result).toBe(false);
    });
  });

  describe('incrementSpaceDocCount', () => {
    it('should increment doc count by default delta of 1', async () => {
      mockPool.query.mockResolvedValue({});

      await repo.incrementSpaceDocCount('space-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('doc_count = doc_count + $1'),
        [1, 'space-1'],
      );
    });

    it('should increment doc count by custom delta', async () => {
      mockPool.query.mockResolvedValue({});

      await repo.incrementSpaceDocCount('space-1', 5);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('doc_count = doc_count + $1'),
        [5, 'space-1'],
      );
    });

    it('should decrement with negative delta', async () => {
      mockPool.query.mockResolvedValue({});

      await repo.incrementSpaceDocCount('space-1', -1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('doc_count = doc_count + $1'),
        [-1, 'space-1'],
      );
    });
  });

  // =========================================================================
  // Document Operations
  // =========================================================================

  describe('createDoc', () => {
    it('should create document within a transaction', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [mockDoc] }) // INSERT doc
        .mockResolvedValueOnce({ rows: [] })         // INSERT version
        .mockResolvedValueOnce({ rows: [] });         // UPDATE space count

      const result = await repo.createDoc('t1', {
        title: 'Test Doc',
        content: 'Hello world',
        space_id: 'space-1',
      });

      expect(result).toEqual(mockDoc);
      expect(mockPool.transaction).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledTimes(3);
    });

    it('should use default values for optional fields', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [mockDoc] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await repo.createDoc('t1', { title: 'Test', content: 'Content', space_id: 'space-1' });

      const insertCall = mockClient.query.mock.calls[0];
      const params = insertCall[1];
      expect(params).toContain('knowledge'); // default type
      expect(params).toContain('manual');    // default source
      expect(params).toContain('draft');     // default status
    });

    it('should pass custom optional fields', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ ...mockDoc, type: 'docs', source: 'synced', status: 'published' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repo.createDoc('t1', {
        title: 'Test',
        content: 'Content',
        space_id: 'space-1',
        type: 'docs',
        source: 'synced',
        status: 'published',
        tags: ['api', 'guide'],
        author_id: 'author-1',
      });

      expect(result.type).toBe('docs');
      expect(result.source).toBe('synced');
      expect(result.status).toBe('published');
    });
  });

  describe('findDocById', () => {
    it('should return document when found', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDoc] });

      const result = await repo.findDocById('doc-1');
      expect(result).toEqual(mockDoc);
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findDocById('missing');
      expect(result).toBeNull();
    });
  });

  describe('findAllDocs', () => {
    it('should return all docs for tenant', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockDoc] });

      const result = await repo.findAllDocs('t1');
      expect(result).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        ['t1'],
      );
    });

    it('should filter by spaceId', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAllDocs('t1', { spaceId: 'space-1' });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND space_id = $'),
        expect.arrayContaining(['t1', 'space-1']),
      );
    });

    it('should filter by status', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAllDocs('t1', { status: 'published' });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND status = $'),
        expect.arrayContaining(['t1', 'published']),
      );
    });

    it('should filter by tag using ANY', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAllDocs('t1', { tag: 'api' });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ANY(tags)'),
        expect.arrayContaining(['t1', 'api']),
      );
    });

    it('should filter by type and source', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAllDocs('t1', { type: 'docs', source: 'synced' });
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('AND type =');
      expect(sql).toContain('AND source =');
    });

    it('should filter by search with ILIKE', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAllDocs('t1', { search: 'deploy' });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['t1', '%deploy%']),
      );
    });

    it('should apply limit and offset', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAllDocs('t1', { limit: 10, offset: 20 });
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('LIMIT');
      expect(sql).toContain('OFFSET');
    });
  });

  describe('updateDoc', () => {
    it('should update document and save version', async () => {
      const existingDoc = { ...mockDoc, version: 1 };
      const updatedDoc = { ...mockDoc, version: 2, title: 'Updated' };

      mockClient.query
        .mockResolvedValueOnce({ rows: [existingDoc] })   // SELECT existing
        .mockResolvedValueOnce({ rows: [updatedDoc] })    // UPDATE doc
        .mockResolvedValueOnce({ rows: [] });              // INSERT version

      const result = await repo.updateDoc('doc-1', { title: 'Updated' });

      expect(result!.title).toBe('Updated');
      expect(result!.version).toBe(2);
      expect(mockClient.query).toHaveBeenCalledTimes(3);
    });

    it('should return null when document not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.updateDoc('missing', { title: 'New' });
      expect(result).toBeNull();
    });

    it('should update content and tags', async () => {
      const existingDoc = { ...mockDoc, version: 1 };
      const updatedDoc = { ...mockDoc, version: 2, content: 'New content', tags: ['updated'] };

      mockClient.query
        .mockResolvedValueOnce({ rows: [existingDoc] })
        .mockResolvedValueOnce({ rows: [updatedDoc] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repo.updateDoc('doc-1', { content: 'New content', tags: ['updated'] });
      expect(result!.version).toBe(2);
    });

    it('should update status and source', async () => {
      const existingDoc = { ...mockDoc, version: 1 };
      const updatedDoc = { ...mockDoc, version: 2, status: 'published', source: 'synced' };

      mockClient.query
        .mockResolvedValueOnce({ rows: [existingDoc] })
        .mockResolvedValueOnce({ rows: [updatedDoc] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await repo.updateDoc('doc-1', { status: 'published', source: 'synced' });
      expect(result!.status).toBe('published');
    });
  });

  describe('deleteDoc', () => {
    it('should delete doc and decrement space doc count', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ space_id: 'space-1' }] })  // SELECT space_id
        .mockResolvedValueOnce({ rowCount: 1 })                       // DELETE
        .mockResolvedValueOnce({ rows: [] });                         // UPDATE space count

      const result = await repo.deleteDoc('doc-1');
      expect(result).toBe(true);
    });

    it('should return false when doc not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.deleteDoc('missing');
      expect(result).toBe(false);
    });

    it('should return false when delete rowCount is 0', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ space_id: 'space-1' }] })
        .mockResolvedValueOnce({ rowCount: 0 });

      const result = await repo.deleteDoc('doc-1');
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // Version Operations
  // =========================================================================

  describe('getDocVersions', () => {
    it('should return versions sorted by version DESC', async () => {
      const versions = [
        { ...mockVersion, version: 2 },
        { ...mockVersion, version: 1 },
      ];
      mockPool.query.mockResolvedValue({ rows: versions });

      const result = await repo.getDocVersions('doc-1');
      expect(result).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY version DESC'),
        ['doc-1'],
      );
    });

    it('should return empty array when no versions', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.getDocVersions('doc-1');
      expect(result).toHaveLength(0);
    });
  });

  // =========================================================================
  // Search Operations
  // =========================================================================

  describe('search', () => {
    it('should search with title and content ILIKE', async () => {
      const searchResult: KnowledgeSearchResult = {
        id: 'doc-1',
        title: 'Test Doc',
        content: 'Hello world',
        similarity: 0.9,
        space_id: 'space-1',
        tags: ['test'],
        status: 'published',
      };
      mockPool.query.mockResolvedValue({ rows: [searchResult] });

      const result = await repo.search('t1', 'deploy');
      expect(result).toHaveLength(1);
      expect(result[0].similarity).toBe(0.9);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'published'"),
        expect.arrayContaining(['t1', '%deploy%']),
      );
    });

    it('should filter search by spaceId', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.search('t1', 'api', { spaceId: 'space-1' });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND space_id = $3'),
        expect.arrayContaining(['t1', '%api%', 'space-1']),
      );
    });

    it('should apply custom limit', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.search('t1', 'test', { limit: 5 });
      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs).toContain(5);
    });

    it('should use default limit of 10', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.search('t1', 'test');
      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs).toContain(10);
    });
  });

  describe('searchByEmbedding', () => {
    it('should return empty array (placeholder)', async () => {
      const result = await repo.searchByEmbedding('t1', [0.1, 0.2, 0.3]);
      expect(result).toEqual([]);
    });

    it('should accept custom limit', async () => {
      const result = await repo.searchByEmbedding('t1', [0.1], 10);
      expect(result).toEqual([]);
    });
  });
});
