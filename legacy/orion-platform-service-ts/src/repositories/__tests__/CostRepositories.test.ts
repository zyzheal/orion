import { CostRecordRepository, AlertRuleRepository, ModelPricingRepository } from '../CostRepositories';

describe('CostRecordRepository', () => {
  const mockQuery = jest.fn();
  let repo: CostRecordRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CostRecordRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });
});

describe('AlertRuleRepository', () => {
  const mockQuery = jest.fn();
  let repo: AlertRuleRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AlertRuleRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });
});

describe('ModelPricingRepository', () => {
  const mockQuery = jest.fn();
  let repo: ModelPricingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ModelPricingRepository({ query: mockQuery } as any);
  });

  it('should instantiate', () => { expect(repo).toBeDefined(); });
});

