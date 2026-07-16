/**
 * TestGenerationHistoryRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { TestGenerationHistoryRepository } from '../TestGenerationHistoryRepository';

const mockQuery = jest.fn();

describe('TestGenerationHistoryRepository', () => {
  let repo: TestGenerationHistoryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TestGenerationHistoryRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => {
    expect(repo).toBeDefined();
  });
});
