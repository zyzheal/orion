import { BillingRepository } from '../BillingRepository';

describe('BillingRepository', () => {
  let repo: BillingRepository;
  let mockPool: any;

  const mockUsageRow = (overrides: any = {}) => ({
    id: 'u1',
    tenant_id: 't1',
    service: 'compute',
    metric: 'cpu_hours',
    quantity: '100',
    unit_price: '0.05',
    total_cost: '5.00',
    period_start: '2024-06-01',
    period_end: '2024-06-30',
    metadata: '{"region":"us-east-1"}',
    created_at: new Date(),
    ...overrides,
  });

  const mockBillingRow = (overrides: any = {}) => ({
    id: 'b1',
    tenant_id: 't1',
    billing_period: '2024-06',
    status: 'pending',
    total_amount: '1500.00',
    paid_amount: '0',
    due_date: '2024-07-15',
    paid_at: null,
    items: '[{"service":"compute","amount":1500}]',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockPool = { query: jest.fn() };
    repo = new BillingRepository(mockPool);
  });

  test('should create usage record', async () => {
    mockPool.query.mockResolvedValue({ rows: [mockUsageRow()] });
    const result = await repo.createUsageRecord(
      { service: 'compute', metric: 'cpu_hours', quantity: 100, unitPrice: 0.05, totalCost: 5, periodStart: '2024-06-01', periodEnd: '2024-06-30', metadata: { region: 'us-east-1' } },
      't1',
    );
    expect(result.id).toBe('u1');
    expect(result.tenantId).toBe('t1');
    expect(result.service).toBe('compute');
    expect(result.quantity).toBe(100);
    expect(result.unitPrice).toBe(0.05);
    expect(result.totalCost).toBe(5);
    expect(result.metadata).toEqual({ region: 'us-east-1' });
  });

  test('should find usage records by tenant with filters', async () => {
    mockPool.query.mockResolvedValue({
      rows: [mockUsageRow(), mockUsageRow({ id: 'u2', metric: 'memory_gb' })],
    });
    const result = await repo.findUsageByTenant('t1', { service: 'compute', periodStart: '2024-06-01' });
    expect(result.length).toBe(2);
    expect(result[0].tenantId).toBe('t1');
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('tenant_id = $1'),
      expect.arrayContaining(['t1', 'compute', '2024-06-01']),
    );
  });

  test('should get usage summary by period', async () => {
    mockPool.query.mockResolvedValue({
      rows: [
        { service: 'compute', cost: '500.00' },
        { service: 'storage', cost: '200.00' },
      ],
    });
    const result = await repo.getUsageSummary('t1', '2024-06');
    expect(result.totalCost).toBe(700);
    expect(result.byService['compute']).toBe(500);
    expect(result.byService['storage']).toBe(200);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('GROUP BY service'),
      ['t1', '2024-06%'],
    );
  });

  test('should create billing record', async () => {
    mockPool.query.mockResolvedValue({ rows: [mockBillingRow()] });
    const result = await repo.createBillingRecord({
      tenantId: 't1',
      billingPeriod: '2024-06',
      status: 'pending',
      totalAmount: 1500,
      paidAmount: 0,
      dueDate: '2024-07-15',
      items: [{ service: 'compute', amount: 1500 }],
    });
    expect(result.id).toBe('b1');
    expect(result.billingPeriod).toBe('2024-06');
    expect(result.status).toBe('pending');
    expect(result.totalAmount).toBe(1500);
    expect(result.items).toEqual([{ service: 'compute', amount: 1500 }]);
  });

  test('should find billing records by tenant with status filter', async () => {
    mockPool.query.mockResolvedValue({
      rows: [mockBillingRow({ status: 'overdue' })],
    });
    const result = await repo.findBillingRecords('t1', { status: 'overdue' });
    expect(result.length).toBe(1);
    expect(result[0].status).toBe('overdue');
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('status = $2'),
      ['t1', 'overdue'],
    );
  });

  test('should find billing record by id', async () => {
    mockPool.query.mockResolvedValue({ rows: [mockBillingRow()] });
    const result = await repo.findBillingRecordById('b1');
    expect(result).toBeDefined();
    expect(result!.id).toBe('b1');
    expect(result!.totalAmount).toBe(1500);
  });

  test('should return undefined for non-existent billing record', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    const result = await repo.findBillingRecordById('nonexistent');
    expect(result).toBeUndefined();
  });

  test('should update billing record', async () => {
    mockPool.query.mockResolvedValue({
      rows: [mockBillingRow({ status: 'paid', paid_amount: '1500.00', paid_at: '2024-07-01' })],
    });
    const result = await repo.updateBillingRecord('b1', { status: 'paid', paidAmount: 1500, paidAt: '2024-07-01' });
    expect(result).toBeDefined();
    expect(result!.status).toBe('paid');
    expect(result!.paidAmount).toBe(1500);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE billing_records'),
      expect.arrayContaining(['paid', 1500, '2024-07-01', 'b1']),
    );
  });

  test('should get billing summary', async () => {
    mockPool.query
      .mockResolvedValueOnce({
        rows: [{
          total_billing: '5000.00',
          paid_amount: '3000.00',
          pending_amount: '1500.00',
          overdue_amount: '500.00',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ current_month_cost: '1500.00' }],
      });
    const result = await repo.getBillingSummary('t1');
    expect(result.totalBilling).toBe(5000);
    expect(result.paidAmount).toBe(3000);
    expect(result.pendingAmount).toBe(1500);
    expect(result.overdueAmount).toBe(500);
    expect(result.currentMonthCost).toBe(1500);
  });
});
