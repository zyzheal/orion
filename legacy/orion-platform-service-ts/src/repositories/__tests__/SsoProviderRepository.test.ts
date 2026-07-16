import { SsoProviderRepository } from '../SsoProviderRepository';

describe('SsoProviderRepository', () => {
  const mockQuery = jest.fn();
  let repo: SsoProviderRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SsoProviderRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });

  it('should findAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'sso-1' }], rowCount: 1 });
    const result = await repo.findAll();
    expect(mockQuery).toHaveBeenCalled();
  });
});
