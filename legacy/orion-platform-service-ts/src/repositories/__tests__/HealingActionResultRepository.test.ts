/**
 * HealingActionResultRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { HealingActionResultRepository } from '../HealingActionResultRepository';

const mockQuery = jest.fn();

describe('HealingActionResultRepository', () => {
  let repo: HealingActionResultRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new HealingActionResultRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => {
    expect(repo).toBeDefined();
  });
});
