import { VectorStore } from '../VectorStore';
import { VectorStoreConfig } from '../types';

const defaultConfig: VectorStoreConfig = {
  host: 'localhost',
  port: 19530,
  collectionName: 'test',
  dimension: 1536,
};

describe('VectorStore', () => {
  let store: VectorStore;

  beforeEach(() => {
    store = new VectorStore(defaultConfig);
  });

  test('should add document and generate embedding', async () => {
    const id = await store.addDocument('Hello world', { category: 'test' });
    expect(id).toBeTruthy();
    expect(store.documentCount).toBe(1);
  });

  test('should search by semantic similarity', async () => {
    await store.addDocument('The quick brown fox jumps over the lazy dog');
    await store.addDocument('Python is a programming language');
    await store.addDocument('Machine learning models require data preprocessing');

    const results = await store.search({ query: 'animals and dogs', topK: 2 });
    expect(results.length).toBe(2);
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
  });

  test('should filter by metadata', async () => {
    await store.addDocument('Doc A', { category: 'tech' });
    await store.addDocument('Doc B', { category: 'science' });
    await store.addDocument('Doc C', { category: 'tech' });

    const results = await store.search({
      query: 'technology',
      filter: { category: 'tech' },
    });
    expect(results.length).toBeLessThanOrEqual(2);
    expect(results.every(r => r.document.metadata.category === 'tech')).toBe(true);
  });

  test('should delete document', async () => {
    const id = await store.addDocument('Test doc');
    expect(store.documentCount).toBe(1);
    const deleted = await store.deleteDocument(id);
    expect(deleted).toBe(true);
    expect(store.documentCount).toBe(0);
  });

  test('should return empty results for no matches', async () => {
    const results = await store.search({ query: 'nothing here' });
    expect(results).toEqual([]);
  });
});
