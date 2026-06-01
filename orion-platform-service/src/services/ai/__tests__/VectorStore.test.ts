import { VectorStore } from '../VectorStore';
import { VectorStoreConfig } from '../types';

const mockDb = {
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
};

const defaultConfig: VectorStoreConfig = {
  host: 'localhost',
  port: 19530,
  collectionName: 'test',
  dimension: 1536,
};

describe('VectorStore', () => {
  let store: VectorStore;

  beforeEach(() => {
    mockDb.query.mockReset();
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });
    store = new VectorStore(defaultConfig, mockDb as any);
  });

  test('should add document and generate embedding', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [{ id: 'doc-1', collection: 'test', content: 'Hello world', metadata: '{"category":"test"}', embedding: '[]' }],
      rowCount: 1,
    });
    const id = await store.addDocument('Hello world', { category: 'test' });
    expect(id).toBeTruthy();
  });

  test('should search by semantic similarity', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        { id: 'doc-1', content: 'The quick brown fox', metadata: '{}', embedding: '[]', score: 0.9 },
        { id: 'doc-2', content: 'Python programming', metadata: '{}', embedding: '[]', score: 0.7 },
      ],
      rowCount: 2,
    });

    const results = await store.search({ query: 'animals and dogs', topK: 2 });
    expect(results.length).toBe(2);
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
  });

  test('should filter by metadata', async () => {
    mockDb.query.mockResolvedValueOnce({
      rows: [
        { id: 'doc-1', content: 'Doc A', metadata: '{"category":"tech"}', embedding: '[]', score: 0.8 },
        { id: 'doc-3', content: 'Doc C', metadata: '{"category":"tech"}', embedding: '[]', score: 0.6 },
      ],
      rowCount: 2,
    });

    const results = await store.search({
      query: 'technology',
      filter: { category: 'tech' },
    });
    expect(results.length).toBeLessThanOrEqual(2);
    expect(results.every(r => r.document.metadata.category === 'tech')).toBe(true);
  });

  test('should delete document', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const deleted = await store.deleteDocument('doc-1');
    expect(deleted).toBe(true);
  });

  test('should return empty results for no matches', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const results = await store.search({ query: 'nothing here' });
    expect(results).toEqual([]);
  });
});
