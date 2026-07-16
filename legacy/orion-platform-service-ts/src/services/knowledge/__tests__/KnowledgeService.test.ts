/**
 * KnowledgeService Tests
 */

import { KnowledgeService, KnowledgeServiceError } from '../KnowledgeService';
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

describe('KnowledgeService', () => {
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

  const mockSpace: KnowledgeSpace = {
    id: 'space-1',
    tenant_id: 't1',
    name: 'Test Space',
    type: 'public',
    owner_id: 'u1',
    team_id: null,
    description: 'A test space',
    doc_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockDoc: KnowledgeDoc = {
    id: 'doc-1',
    tenant_id: 't1',
    space_id: 'space-1',
    title: 'Test Doc',
    content: 'Hello world',
    type: 'doc',
    tags: ['test'],
    status: 'draft',
    version: 1,
    author_id: 'u1',
    embedding: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  // =========================================================================
  // Space operations
  // =========================================================================

  describe('createSpace', () => {
    it('should create a new knowledge space', async () => {
      const input: CreateSpaceInput = { name: 'Test Space', type: 'public', owner_id: 'u1' };
      mockRepository.createSpace.mockResolvedValue(mockSpace);

      const result = await service.createSpace('t1', input);

      expect(result).toEqual(mockSpace);
      expect(mockRepository.createSpace).toHaveBeenCalledWith('t1', input);
    });

    it('should throw when tenantId is missing', async () => {
      await expect(service.createSpace('', { name: 'Space', type: 'public', owner_id: 'u1' }))
        .rejects.toThrow(KnowledgeServiceError);
    });

    it('should throw when space name is missing', async () => {
      await expect(service.createSpace('t1', { name: '', type: 'public', owner_id: 'u1' }))
        .rejects.toThrow(KnowledgeServiceError);
    });
  });

  describe('getSpace', () => {
    it('should return space by id', async () => {
      mockRepository.findSpaceById.mockResolvedValue(mockSpace);

      const result = await service.getSpace('space-1');

      expect(result).toEqual(mockSpace);
    });

    it('should throw when space not found', async () => {
      mockRepository.findSpaceById.mockResolvedValue(null);

      await expect(service.getSpace('non-existent'))
        .rejects.toThrow(KnowledgeServiceError);
      await expect(service.getSpace('non-existent'))
        .rejects.toThrow('Space not found');
    });
  });

  describe('listSpaces', () => {
    it('should return all spaces for a tenant', async () => {
      const spaces = [mockSpace];
      mockRepository.findAllSpaces.mockResolvedValue(spaces);

      const result = await service.listSpaces('t1');

      expect(result).toEqual(spaces);
      expect(mockRepository.findAllSpaces).toHaveBeenCalledWith('t1', undefined);
    });

    it('should pass filter params', async () => {
      mockRepository.findAllSpaces.mockResolvedValue([]);

      await service.listSpaces('t1', { type: 'public', search: 'test', limit: 10, offset: 0 });

      expect(mockRepository.findAllSpaces).toHaveBeenCalledWith('t1', {
        type: 'public', search: 'test', limit: 10, offset: 0,
      });
    });
  });

  describe('updateSpace', () => {
    it('should update an existing space', async () => {
      const updated: KnowledgeSpace = { ...mockSpace, name: 'Updated Space' };
      mockRepository.findSpaceById.mockResolvedValue(mockSpace);
      mockRepository.updateSpace.mockResolvedValue(updated);

      const result = await service.updateSpace('space-1', { name: 'Updated Space' });

      expect(result.name).toBe('Updated Space');
    });

    it('should throw when space not found', async () => {
      mockRepository.findSpaceById.mockResolvedValue(null);

      await expect(service.updateSpace('non-existent', { name: 'New' }))
        .rejects.toThrow('Space not found');
    });

    it('should throw when update fails', async () => {
      mockRepository.findSpaceById.mockResolvedValue(mockSpace);
      mockRepository.updateSpace.mockResolvedValue(null);

      await expect(service.updateSpace('space-1', { name: 'New' }))
        .rejects.toThrow('Failed to update space');
    });
  });

  describe('deleteSpace', () => {
    it('should delete an existing space', async () => {
      mockRepository.findSpaceById.mockResolvedValue(mockSpace);
      mockRepository.deleteSpace.mockResolvedValue(true);

      const result = await service.deleteSpace('space-1');

      expect(result).toBe(true);
    });

    it('should throw when space not found', async () => {
      mockRepository.findSpaceById.mockResolvedValue(null);

      await expect(service.deleteSpace('non-existent'))
        .rejects.toThrow('Space not found');
    });
  });

  // =========================================================================
  // Document operations
  // =========================================================================

  describe('createDoc', () => {
    it('should create a new document', async () => {
      const input: CreateDocInput = { title: 'Test', content: 'Hello', space_id: 'space-1' };
      mockRepository.findSpaceById.mockResolvedValue(mockSpace);
      mockRepository.createDoc.mockResolvedValue(mockDoc);

      const result = await service.createDoc('t1', input);

      expect(result).toEqual(mockDoc);
    });

    it('should throw when title is missing', async () => {
      const input: CreateDocInput = { title: '', content: 'Hello', space_id: 'space-1' };
      await expect(service.createDoc('t1', input)).rejects.toThrow(KnowledgeServiceError);
    });

    it('should throw when content is missing', async () => {
      const input: CreateDocInput = { title: 'Test', content: '', space_id: 'space-1' };
      await expect(service.createDoc('t1', input)).rejects.toThrow(KnowledgeServiceError);
    });

    it('should throw when space_id is missing', async () => {
      const input: CreateDocInput = { title: 'Test', content: 'Hello', space_id: '' };
      await expect(service.createDoc('t1', input)).rejects.toThrow(KnowledgeServiceError);
    });

    it('should throw when space does not belong to tenant', async () => {
      const foreignSpace: KnowledgeSpace = { ...mockSpace, tenant_id: 'other-tenant' };
      mockRepository.findSpaceById.mockResolvedValue(foreignSpace);

      await expect(service.createDoc('t1', { title: 'T', content: 'C', space_id: 'space-1' }))
        .rejects.toThrow(KnowledgeServiceError);
    });

    it('should throw when space does not exist', async () => {
      mockRepository.findSpaceById.mockResolvedValue(null);

      await expect(service.createDoc('t1', { title: 'T', content: 'C', space_id: 'space-1' }))
        .rejects.toThrow(KnowledgeServiceError);
    });
  });

  describe('getDoc', () => {
    it('should return document by id', async () => {
      mockRepository.findDocById.mockResolvedValue(mockDoc);

      const result = await service.getDoc('doc-1');

      expect(result).toEqual(mockDoc);
    });

    it('should throw when document not found', async () => {
      mockRepository.findDocById.mockResolvedValue(null);

      await expect(service.getDoc('non-existent'))
        .rejects.toThrow(KnowledgeServiceError);
    });
  });

  describe('listDocs', () => {
    it('should return all docs for a tenant', async () => {
      mockRepository.findAllDocs.mockResolvedValue([mockDoc]);

      const result = await service.listDocs('t1');

      expect(result).toEqual([mockDoc]);
    });

    it('should pass filter params', async () => {
      mockRepository.findAllDocs.mockResolvedValue([]);

      await service.listDocs('t1', { spaceId: 's1', status: 'published', tag: 'test', limit: 10 });

      expect(mockRepository.findAllDocs).toHaveBeenCalledWith('t1', {
        spaceId: 's1', status: 'published', tag: 'test', limit: 10,
      });
    });
  });

  describe('updateDoc', () => {
    it('should update an existing document', async () => {
      const updated: KnowledgeDoc = { ...mockDoc, title: 'Updated', version: 2 };
      mockRepository.findDocById.mockResolvedValue(mockDoc);
      mockRepository.updateDoc.mockResolvedValue(updated);

      const result = await service.updateDoc('doc-1', { title: 'Updated' });

      expect(result.title).toBe('Updated');
      expect(result.version).toBe(2);
    });

    it('should throw when document not found', async () => {
      mockRepository.findDocById.mockResolvedValue(null);

      await expect(service.updateDoc('non-existent', { title: 'New' }))
        .rejects.toThrow('Document not found');
    });

    it('should throw when update fails', async () => {
      mockRepository.findDocById.mockResolvedValue(mockDoc);
      mockRepository.updateDoc.mockResolvedValue(null);

      await expect(service.updateDoc('doc-1', { title: 'New' }))
        .rejects.toThrow('Failed to update document');
    });
  });

  describe('deleteDoc', () => {
    it('should delete an existing document', async () => {
      mockRepository.findDocById.mockResolvedValue(mockDoc);
      mockRepository.deleteDoc.mockResolvedValue(true);

      const result = await service.deleteDoc('doc-1');

      expect(result).toBe(true);
    });

    it('should throw when document not found', async () => {
      mockRepository.findDocById.mockResolvedValue(null);

      await expect(service.deleteDoc('non-existent'))
        .rejects.toThrow('Document not found');
    });
  });

  // =========================================================================
  // Version operations
  // =========================================================================

  describe('getDocVersions', () => {
    it('should return versions for a document', async () => {
      const versions: DocVersion[] = [
        { id: 'v1', doc_id: 'doc-1', version: 1, title: 'Test', content: 'Hello', tags: [], created_at: new Date() },
        { id: 'v2', doc_id: 'doc-1', version: 2, title: 'Updated', content: 'World', tags: [], created_at: new Date() },
      ];
      mockRepository.findDocById.mockResolvedValue(mockDoc);
      mockRepository.getDocVersions.mockResolvedValue(versions);

      const result = await service.getDocVersions('doc-1');

      expect(result).toEqual(versions);
    });

    it('should throw when document not found', async () => {
      mockRepository.findDocById.mockResolvedValue(null);

      await expect(service.getDocVersions('non-existent'))
        .rejects.toThrow('Document not found');
    });
  });

  // =========================================================================
  // Search / RAG
  // =========================================================================

  describe('search', () => {
    it('should search knowledge base', async () => {
      const results: KnowledgeSearchResult[] = [
        { id: 'doc-1', title: 'Test Doc', content: 'Hello', similarity: 0.9, space_id: 'space-1', tags: ['test'], status: 'published' },
      ];
      mockRepository.search.mockResolvedValue(results);

      const result = await service.search('t1', 'Hello');

      expect(result).toEqual(results);
      expect(mockRepository.search).toHaveBeenCalledWith('t1', 'Hello', undefined);
    });

    it('should trim search query', async () => {
      mockRepository.search.mockResolvedValue([]);

      await service.search('t1', '  test query  ');

      expect(mockRepository.search).toHaveBeenCalledWith('t1', 'test query', undefined);
    });

    it('should throw when query is empty', async () => {
      await expect(service.search('t1', '')).rejects.toThrow(KnowledgeServiceError);
      await expect(service.search('t1', '   ')).rejects.toThrow(KnowledgeServiceError);
    });

    it('should pass spaceId and limit params', async () => {
      mockRepository.search.mockResolvedValue([]);

      await service.search('t1', 'test', { spaceId: 's1', limit: 5 });

      expect(mockRepository.search).toHaveBeenCalledWith('t1', 'test', { spaceId: 's1', limit: 5 });
    });
  });

  describe('retrieve', () => {
    it('should retrieve documents for RAG', async () => {
      const results: KnowledgeSearchResult[] = [
        { id: 'doc-1', title: 'Test', content: 'Content', similarity: 0.8, space_id: 's1', tags: [], status: 'published' },
      ];
      mockRepository.search.mockResolvedValue(results);

      const result = await service.retrieve('t1', 'test query', { spaceId: 's1', topK: 3 });

      expect(result).toEqual(results);
      expect(mockRepository.search).toHaveBeenCalledWith('t1', 'test query', { spaceId: 's1', limit: 3 });
    });

    it('should default topK to 5', async () => {
      mockRepository.search.mockResolvedValue([]);

      await service.retrieve('t1', 'query', {});

      expect(mockRepository.search).toHaveBeenCalledWith('t1', 'query', { spaceId: undefined, limit: 5 });
    });
  });
});

describe('KnowledgeRepository', () => {
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

  describe('createSpace', () => {
    it('should insert a new space', async () => {
      const mockRow = { id: 's1', tenant_id: 't1', name: 'Space', type: 'public', owner_id: 'u1' };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.createSpace('t1', { name: 'Space', type: 'public', owner_id: 'u1' });

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO kb_spaces');
    });
  });

  describe('findSpaceById', () => {
    it('should return space when found', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 's1' }] });

      const result = await repository.findSpaceById('s1');

      expect(result).toEqual({ id: 's1' });
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findSpaceById('missing');

      expect(result).toBeNull();
    });
  });

  describe('findAllSpaces', () => {
    it('should return spaces with filters', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllSpaces('t1', { type: 'public', search: 'test', limit: 10 });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('WHERE tenant_id = $1');
      expect(sql).toContain('type = $2');
      expect(sql).toContain('ILIKE');
    });
  });

  describe('updateSpace', () => {
    it('should update space fields', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 's1' }] });

      const result = await repository.updateSpace('s1', { name: 'New Name' });

      expect(result).toEqual({ id: 's1' });
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('UPDATE kb_spaces SET');
    });

    it('should return existing when no updates', async () => {
      const mockRow = { id: 's1' };
      const findSpy = jest.spyOn(repository, 'findSpaceById');
      findSpy.mockResolvedValue(mockRow);

      const result = await repository.updateSpace('s1', {});

      expect(result).toEqual(mockRow);
      findSpy.mockRestore();
    });
  });

  describe('deleteSpace', () => {
    it('should return true when space deleted', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repository.deleteSpace('s1');

      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repository.deleteSpace('missing');

      expect(result).toBe(false);
    });
  });

  describe('createDoc', () => {
    it('should create doc with initial version', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: 'd1', space_id: 's1', title: 'Doc', content: 'C' }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] }),
      };
      mockDb.transaction.mockImplementation(async (cb) => cb(mockClient));

      await repository.createDoc('t1', { title: 'Doc', content: 'C', space_id: 's1' });

      expect(mockClient.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('findDocById', () => {
    it('should return doc when found', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'd1' }] });

      const result = await repository.findDocById('d1');

      expect(result).toEqual({ id: 'd1' });
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const result = await repository.findDocById('missing');
      expect(result).toBeNull();
    });
  });

  describe('findAllDocs', () => {
    it('should return docs with filters', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllDocs('t1', { spaceId: 's1', status: 'published' });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('space_id = $2');
      expect(sql).toContain('status = $3');
    });
  });

  describe('updateDoc', () => {
    it('should update doc and create new version', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: 'd1', version: 1, title: 'Old', content: 'Old', tags: [] }] })
          .mockResolvedValueOnce({ rows: [{ id: 'd1', version: 2, title: 'New', content: 'New', tags: [] }] })
          .mockResolvedValueOnce({ rows: [] }),
      };
      mockDb.transaction.mockImplementation(async (cb) => cb(mockClient));

      const result = await repository.updateDoc('d1', { title: 'New', content: 'New' });

      expect(result).toEqual({ id: 'd1', version: 2, title: 'New', content: 'New', tags: [] });
    });

    it('should return null when doc not found', async () => {
      const mockClient = { query: jest.fn().mockResolvedValue({ rows: [] }) };
      mockDb.transaction.mockImplementation(async (cb) => cb(mockClient));

      const result = await repository.updateDoc('missing', { title: 'New' });

      expect(result).toBeNull();
    });
  });

  describe('deleteDoc', () => {
    it('should delete doc and decrement space doc_count', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ space_id: 's1' }] })
          .mockResolvedValueOnce({ rowCount: 1 })
          .mockResolvedValueOnce({ rows: [] }),
      };
      mockDb.transaction.mockImplementation(async (cb) => cb(mockClient));

      const result = await repository.deleteDoc('d1');

      expect(result).toBe(true);
    });

    it('should return false when doc not found', async () => {
      const mockClient = { query: jest.fn().mockResolvedValue({ rows: [] }) };
      mockDb.transaction.mockImplementation(async (cb) => cb(mockClient));

      const result = await repository.deleteDoc('missing');

      expect(result).toBe(false);
    });
  });

  describe('getDocVersions', () => {
    it('should return versions ordered by version DESC', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ version: 2 }, { version: 1 }] });

      const result = await repository.getDocVersions('d1');

      expect(result).toEqual([{ version: 2 }, { version: 1 }]);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('ORDER BY version DESC');
    });
  });

  describe('search', () => {
    it('should search with ILIKE and similarity scoring', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.search('t1', 'test', { spaceId: 's1', limit: 5 });

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('ILIKE');
      expect(sql).toContain('similarity');
    });

    it('should default limit to 10', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.search('t1', 'test');

      const params = mockDb.query.mock.calls[0][1];
      const lastParam = params[params.length - 1];
      expect(lastParam).toBe(10);
    });
  });

  describe('searchByEmbedding', () => {
    it('should return empty array (placeholder)', async () => {
      const result = await repository.searchByEmbedding('t1', [0.1, 0.2], 5);

      expect(result).toEqual([]);
    });
  });
});
