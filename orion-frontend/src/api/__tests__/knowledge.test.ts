/**
 * Knowledge API Client Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchKnowledge,
  getKnowledge,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
} from '../knowledge';
import { api } from '../client';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('Knowledge API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should search knowledge', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    await searchKnowledge('test query');
    expect(api.get).toHaveBeenCalledWith('/v1/knowledge/search?q=test%20query');
  });

  it('should get a knowledge item', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { id: '1', title: 'Test' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    const result = await getKnowledge('1');
    expect(api.get).toHaveBeenCalledWith('/v1/knowledge/1');
    expect(result.data.title).toBe('Test');
  });

  it('should create a knowledge item', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { id: '1', title: 'New' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    await createKnowledge({ title: 'New', content: 'Content', category: 'General' });
    expect(api.post).toHaveBeenCalledWith('/v1/knowledge', {
      title: 'New',
      content: 'Content',
      category: 'General',
    });
  });

  it('should update a knowledge item', async () => {
    vi.mocked(api.put).mockResolvedValue({
      data: { id: '1' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    await updateKnowledge('1', { title: 'Updated' });
    expect(api.put).toHaveBeenCalledWith('/v1/knowledge/1', { title: 'Updated' });
  });

  it('should delete a knowledge item', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      data: undefined,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);
    await deleteKnowledge('1');
    expect(api.delete).toHaveBeenCalledWith('/v1/knowledge/1');
  });
});
