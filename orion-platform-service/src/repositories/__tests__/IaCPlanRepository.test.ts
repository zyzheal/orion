import { IaCPlanRepository, IaCPlanEntity } from '../IaCPlanRepository';

describe('IaCPlanRepository', () => {
  let repo: IaCPlanRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new IaCPlanRepository(mockDb);
  });

  test('should create iac plan', async () => {
    const mockRow = {
      id: 'plan-1',
      name: 'terraform-aws-vpc',
      terraform_version: '1.5.0',
      plan_content: { resources: ['aws_vpc', 'aws_subnet'] },
      resources_to_add: 5,
      resources_to_change: 0,
      resources_to_destroy: 0,
      applied: false,
      applied_at: null,
      applied_by: null,
      created_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });
    const result = await repo.create({ name: 'terraform-aws-vpc', planContent: {} } as any);
    expect(result.name).toBe('terraform-aws-vpc');
    expect(result.applied).toBe(false);
  });

  test('should find unapplied plans', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'p1', name: 'Plan 1', terraform_version: '1.5', plan_content: {}, resources_to_add: 2, resources_to_change: 1, resources_to_destroy: 0, applied: false, applied_at: null, applied_by: null, created_at: new Date() },
        { id: 'p2', name: 'Plan 2', terraform_version: '1.4', plan_content: {}, resources_to_add: 0, resources_to_change: 0, resources_to_destroy: 3, applied: false, applied_at: null, applied_by: null, created_at: new Date() },
      ],
    });
    const result = await repo.findUnapplied();
    expect(result.length).toBe(2);
    expect(result[0].applied).toBe(false);
  });

  test('should find applied plans', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: 'p1', name: 'Applied Plan', terraform_version: '1.5', plan_content: {}, resources_to_add: 0, resources_to_change: 0, resources_to_destroy: 0, applied: true, applied_at: new Date(), applied_by: 'user-1', created_at: new Date() }],
    });
    const result = await repo.findApplied();
    expect(result.length).toBe(1);
    expect(result[0].applied).toBe(true);
  });

  test('should mark applied', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    await repo.markApplied('plan-1', 'user-1');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE iac_plans'),
      expect.arrayContaining(['user-1', 'plan-1']),
    );
  });
});