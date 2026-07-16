import { SLIMeasurementRepository } from '../SLIMeasurementRepository';

describe('SLIMeasurementRepository', () => {
  let repo: SLIMeasurementRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new SLIMeasurementRepository(mockDb);
  });

  test('should create sli measurement', async () => {
    const mockRow = {
      id: 'm1',
      tenant_id: 't1',
      slo_id: 'slo1',
      sli_value: '99.5',
      measured_at: new Date('2024-06-01T10:00:00Z'),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });
    const result = await repo.create({
      tenantId: 't1',
      sloId: 'slo1',
      sliValue: 99.5,
      measuredAt: new Date('2024-06-01T10:00:00Z'),
    } as any);
    expect(result.id).toBe('m1');
    expect(result.tenantId).toBe('t1');
    expect(result.sloId).toBe('slo1');
    expect(result.sliValue).toBe(99.5);
  });

  test('should find measurements by slo id', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'm1', tenant_id: 't1', slo_id: 'slo1', sli_value: '99.5', measured_at: new Date('2024-06-01T10:00:00Z') },
        { id: 'm2', tenant_id: 't1', slo_id: 'slo1', sli_value: '98.0', measured_at: new Date('2024-06-01T09:00:00Z') },
      ],
    });
    const result = await repo.findBySloId('slo1', 10);
    expect(result.length).toBe(2);
    expect(result[0].sloId).toBe('slo1');
    expect(result[1].sliValue).toBe(98.0);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE slo_id = $1'),
      ['slo1', 10],
    );
  });

  test('should find measurements by slo id and date range', async () => {
    const start = new Date('2024-06-01T00:00:00Z');
    const end = new Date('2024-06-02T00:00:00Z');
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'm3', tenant_id: 't1', slo_id: 'slo1', sli_value: '97.2', measured_at: new Date('2024-06-01T12:00:00Z') },
      ],
    });
    const result = await repo.findBySloIdAndRange('slo1', start, end);
    expect(result.length).toBe(1);
    expect(result[0].sliValue).toBe(97.2);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('BETWEEN'),
      ['slo1', start, end],
    );
  });

  test('should find latest measurement by slo id', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'm1', tenant_id: 't1', slo_id: 'slo1', sli_value: '99.9', measured_at: new Date('2024-06-01T15:00:00Z') },
      ],
    });
    const result = await repo.findLatestBySloId('slo1');
    expect(result).toBeDefined();
    expect(result!.sliValue).toBe(99.9);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY measured_at DESC LIMIT 1'),
      ['slo1'],
    );
  });

  test('should return undefined when no latest measurement found', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    const result = await repo.findLatestBySloId('nonexistent');
    expect(result).toBeUndefined();
  });

  test('should delete measurements by slo id', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 5 });
    const count = await repo.deleteBySloId('slo1');
    expect(count).toBe(5);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM sli_measurement WHERE slo_id = $1'),
      ['slo1'],
    );
  });
});
