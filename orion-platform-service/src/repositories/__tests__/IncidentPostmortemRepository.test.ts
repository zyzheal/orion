import { IncidentPostmortemRepository } from '../IncidentPostmortemRepository';

describe('IncidentPostmortemRepository', () => {
  let repo: IncidentPostmortemRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new IncidentPostmortemRepository(mockDb);
  });

  test('should create postmortem in draft status', async () => {
    const now = new Date();
    const mockRow = {
      id: 'pm-1',
      incident_id: 'inc-1',
      tenant_id: 't1',
      title: 'Outage Postmortem',
      summary: 'Database went down',
      root_cause: 'Disk full',
      contributing_factors: '["monitoring_gap"]',
      impact_description: 'Service unavailable for 2h',
      timeline: '[]',
      timeline_summary: null,
      action_items: '[]',
      lessons_learned: null,
      status: 'draft',
      created_by: 'user-1',
      reviewed_by: null,
      published_at: null,
      created_at: now,
      updated_at: now,
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

    const result = await repo.createPostmortem({
      incident_id: 'inc-1',
      tenant_id: 't1',
      title: 'Outage Postmortem',
      summary: 'Database went down',
      root_cause: 'Disk full',
      created_by: 'user-1',
    });

    expect(result.id).toBe('pm-1');
    expect(result.status).toBe('draft');
    expect(result.incident_id).toBe('inc-1');
    expect(result.contributing_factors).toEqual(['monitoring_gap']);
  });

  test('should find postmortem by incident id', async () => {
    const mockRow = {
      id: 'pm-1',
      incident_id: 'inc-1',
      tenant_id: 't1',
      title: 'Postmortem',
      summary: 'summary',
      root_cause: 'root cause',
      contributing_factors: '[]',
      impact_description: null,
      timeline: '[]',
      timeline_summary: null,
      action_items: '[]',
      lessons_learned: null,
      status: 'draft',
      created_by: null,
      reviewed_by: null,
      published_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

    const result = await repo.findByIncident('inc-1');
    expect(result).toBeDefined();
    expect(result!.incident_id).toBe('inc-1');
  });

  test('should return undefined when incident has no postmortem', async () => {
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await repo.findByIncident('inc-missing');
    expect(result).toBeUndefined();
  });

  test('should publish postmortem (draft -> published)', async () => {
    const mockRow = {
      id: 'pm-1',
      incident_id: 'inc-1',
      tenant_id: 't1',
      title: 'Postmortem',
      summary: 'summary',
      root_cause: 'root cause',
      contributing_factors: '[]',
      impact_description: null,
      timeline: '[]',
      timeline_summary: null,
      action_items: '[]',
      lessons_learned: null,
      status: 'published',
      created_by: 'user-1',
      reviewed_by: 'reviewer-1',
      published_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

    const result = await repo.publish('pm-1', 'reviewer-1');
    expect(result).toBeDefined();
    expect(result!.status).toBe('published');
    expect(result!.reviewed_by).toBe('reviewer-1');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'draft'"),
      ['pm-1', 'reviewer-1'],
    );
  });

  test('should archive postmortem (published -> archived)', async () => {
    const mockRow = {
      id: 'pm-1',
      incident_id: 'inc-1',
      tenant_id: 't1',
      title: 'Postmortem',
      summary: 'summary',
      root_cause: 'root cause',
      contributing_factors: '[]',
      impact_description: null,
      timeline: '[]',
      timeline_summary: null,
      action_items: '[]',
      lessons_learned: null,
      status: 'archived',
      created_by: null,
      reviewed_by: null,
      published_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

    const result = await repo.archive('pm-1');
    expect(result).toBeDefined();
    expect(result!.status).toBe('archived');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'published'"),
      ['pm-1'],
    );
  });

  test('should find postmortems by tenant with status filter', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          { id: 'pm-1', incident_id: 'inc-1', tenant_id: 't1', title: 'P1', summary: 's', root_cause: 'r', contributing_factors: '[]', impact_description: null, timeline: '[]', timeline_summary: null, action_items: '[]', lessons_learned: null, status: 'published', created_by: null, reviewed_by: null, published_at: null, created_at: new Date(), updated_at: new Date() },
          { id: 'pm-2', incident_id: 'inc-2', tenant_id: 't1', title: 'P2', summary: 's', root_cause: 'r', contributing_factors: '[]', impact_description: null, timeline: '[]', timeline_summary: null, action_items: '[]', lessons_learned: null, status: 'published', created_by: null, reviewed_by: null, published_at: null, created_at: new Date(), updated_at: new Date() },
        ],
        rowCount: 2,
      });

    const result = await repo.findByTenant('t1', { status: 'published' });
    expect(result.total).toBe(2);
    expect(result.entities.length).toBe(2);
    expect(result.entities[0].status).toBe('published');
  });

  test('should update postmortem content', async () => {
    const mockRow = {
      id: 'pm-1',
      incident_id: 'inc-1',
      tenant_id: 't1',
      title: 'Updated Title',
      summary: 'Updated summary',
      root_cause: 'root cause',
      contributing_factors: '["new_factor"]',
      impact_description: null,
      timeline: '[]',
      timeline_summary: null,
      action_items: '[]',
      lessons_learned: null,
      status: 'draft',
      created_by: null,
      reviewed_by: null,
      published_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow], rowCount: 1 });

    const result = await repo.updatePostmortem('pm-1', {
      title: 'Updated Title',
      summary: 'Updated summary',
      contributing_factors: ['new_factor'],
    });

    expect(result).toBeDefined();
    expect(result!.title).toBe('Updated Title');
    expect(result!.summary).toBe('Updated summary');
    expect(result!.contributing_factors).toEqual(['new_factor']);
  });
});
