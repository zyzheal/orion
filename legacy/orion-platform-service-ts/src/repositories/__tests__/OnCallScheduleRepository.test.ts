import { OnCallScheduleRepository, OnCallScheduleEntity } from '../OnCallScheduleRepository';

describe('OnCallScheduleRepository', () => {
  let repo: OnCallScheduleRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new OnCallScheduleRepository(mockDb);
  });

  test('should create on-call schedule', async () => {
    const mockRow = {
      id: 'os1',
      name: 'Primary Rotation',
      timezone: 'America/New_York',
      rotation_type: 'weekly',
      rotation_start_hour: 9,
      team_members: ['u1', 'u2', 'u3'],
      start_date: new Date('2024-01-01T00:00:00Z'),
      escalations: [{ userId: 'u1', delay: 0 }],
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [mockRow] });

    const result = await repo.create({
      name: 'Primary Rotation',
      timezone: 'America/New_York',
      rotationType: 'weekly',
      rotationStartHour: 9,
      teamMembers: ['u1', 'u2', 'u3'],
      startDate: new Date('2024-01-01T00:00:00Z'),
      escalations: [{ userId: 'u1', delay: 0 }],
    } as any);

    expect(result.name).toBe('Primary Rotation');
    expect(result.rotationType).toBe('weekly');
    expect(result.teamMembers).toEqual(['u1', 'u2', 'u3']);
  });

  test('should find by timezone', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        {
          id: 'os1',
          name: 'US East Schedule',
          timezone: 'America/New_York',
          rotation_type: 'weekly',
          rotation_start_hour: 9,
          team_members: ['u1'],
          start_date: new Date(),
          escalations: [],
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'os2',
          name: 'US East Backup',
          timezone: 'America/New_York',
          rotation_type: 'daily',
          rotation_start_hour: 10,
          team_members: ['u2'],
          start_date: new Date(),
          escalations: [],
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    });

    const result = await repo.findByTimezone('America/New_York');

    expect(result.length).toBe(2);
    expect(result[0].timezone).toBe('America/New_York');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE timezone = $1'),
      ['America/New_York'],
    );
  });

  test('should find schedules by team member', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        {
          id: 'os1',
          name: 'Team Alpha Schedule',
          timezone: 'UTC',
          rotation_type: 'weekly',
          rotation_start_hour: 0,
          team_members: ['u1', 'u2', 'u3'],
          start_date: new Date(),
          escalations: [],
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    });

    const result = await repo.findByTeamMember('u2');

    expect(result.length).toBe(1);
    expect(result[0].teamMembers).toContain('u2');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('$1 = ANY(team_members)'),
      ['u2'],
    );
  });

  test('should find schedules by rotation type', async () => {
    mockDb.query.mockResolvedValue({
      rows: [
        {
          id: 'os1',
          name: 'Weekly Rotation',
          timezone: 'UTC',
          rotation_type: 'weekly',
          rotation_start_hour: 0,
          team_members: ['u1'],
          start_date: new Date(),
          escalations: [],
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'os2',
          name: 'Another Weekly',
          timezone: 'America/Los_Angeles',
          rotation_type: 'weekly',
          rotation_start_hour: 8,
          team_members: ['u2'],
          start_date: new Date(),
          escalations: [],
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    });

    const result = await repo.findByRotationType('weekly');

    expect(result.length).toBe(2);
    expect(result[0].rotationType).toBe('weekly');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE rotation_type = $1'),
      ['weekly'],
    );
  });

  test('should update escalations', async () => {
    const updatedRow = {
      id: 'os1',
      name: 'Primary',
      timezone: 'UTC',
      rotation_type: 'weekly',
      rotation_start_hour: 9,
      team_members: ['u1'],
      start_date: new Date(),
      escalations: [{ userId: 'u2', delay: 5 }],
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.query.mockResolvedValue({ rows: [updatedRow] });

    const result = await repo.updateEscalations('os1', [{ userId: 'u2', delay: 5 }]);

    expect(result.escalations).toEqual([{ userId: 'u2', delay: 5 }]);
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE oncall_schedules'),
      [JSON.stringify([{ userId: 'u2', delay: 5 }]), 'os1'],
    );
  });
});