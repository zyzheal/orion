import { IncidentTimelineRepository } from '../IncidentTimelineRepository';

describe('IncidentTimelineRepository', () => {
  let repo: IncidentTimelineRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new IncidentTimelineRepository(mockDb);
  });

  test('should create a timeline event', async () => {
    const now = new Date();
    const mockRow = {
      id: 'evt-1',
      incident_id: 'inc-1',
      tenant_id: 't1',
      event_type: 'status_change',
      actor_id: 'user-1',
      content: 'Status changed to investigating',
      metadata: '{"old":"open","new":"investigating"}',
      created_at: now,
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

    const result = await repo.createEvent({
      incident_id: 'inc-1',
      tenant_id: 't1',
      event_type: 'status_change',
      actor_id: 'user-1',
      content: 'Status changed to investigating',
      metadata: { old: 'open', new: 'investigating' },
    });

    expect(result.id).toBe('evt-1');
    expect(result.event_type).toBe('status_change');
    expect(result.metadata).toEqual({ old: 'open', new: 'investigating' });
  });

  test('should find timeline events by incident id', async () => {
    const mockRows = [
      { id: 'evt-1', incident_id: 'inc-1', tenant_id: 't1', event_type: 'created', actor_id: null, content: 'Incident created', metadata: '{}', created_at: new Date('2024-01-01T10:00:00Z') },
      { id: 'evt-2', incident_id: 'inc-1', tenant_id: 't1', event_type: 'status_change', actor_id: 'u1', content: 'Status changed', metadata: '{}', created_at: new Date('2024-01-01T10:05:00Z') },
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows, rowCount: 2 });

    const result = await repo.findByIncident('inc-1');
    expect(result.length).toBe(2);
    expect(result[0].incident_id).toBe('inc-1');
    expect(result[0].content).toBe('Incident created');
  });

  test('should find timeline events by event type', async () => {
    const mockRows = [
      { id: 'evt-3', incident_id: 'inc-1', tenant_id: 't1', event_type: 'comment', actor_id: 'u1', content: 'Added a comment', metadata: '{}', created_at: new Date() },
    ];
    mockDb.query.mockResolvedValue({ rows: mockRows, rowCount: 1 });

    const result = await repo.findByType('inc-1', 'comment');
    expect(result.length).toBe(1);
    expect(result[0].event_type).toBe('comment');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('event_type = $2'),
      ['inc-1', 'comment'],
    );
  });

  test('should count timeline events for an incident', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ count: '5' }], rowCount: 1 });

    const count = await repo.countByIncident('inc-1');
    expect(count).toBe(5);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('COUNT(*)'),
      ['inc-1'],
    );
  });

  test('should find timeline events by tenant with filters', async () => {
    const since = new Date('2024-01-01T00:00:00Z');
    mockDb.query.mockResolvedValue({
      rows: [
        { id: 'evt-1', incident_id: 'inc-1', tenant_id: 't1', event_type: 'comment', actor_id: null, content: 'test', metadata: '{}', created_at: new Date() },
      ],
      rowCount: 1,
    });

    const result = await repo.findByTenant('t1', { eventType: 'comment', since, limit: 10 });
    expect(result.length).toBe(1);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('tenant_id = $1'),
      expect.arrayContaining(['t1', 'comment', since, 10, 0]),
    );
  });
});
