import { QualityGateRepository } from '../QualityGateRepository';

describe('QualityGateRepository', () => {
  let repo: QualityGateRepository;
  const mockQuery = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new QualityGateRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => {
    expect(repo).toBeDefined();
  });
});

