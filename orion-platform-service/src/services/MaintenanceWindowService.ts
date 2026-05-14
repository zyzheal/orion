/**
 * OnCallService 单元测试
 */

import { OnCallService } from '../OnCallService';

// Mock database
const createMockDb = () => {
  const schedules: any[] = [];
  const assignments: any[] = [];
  const overrides: any[] = [];

  return {
    query: jest.fn().mockImplementation((text: string, params?: unknown[]) => {
      if (text.includes('INSERT INTO oncall_schedules')) {
        const schedule = {
          id: params![0],
          name: params![1],
          timezone: params![2],
          rotation_type: params![3],
          rotation_start_hour: params![4],
          team_members: params![5],
          start_date: params![6],
          escalations: params![7],
          created_at: params![8],
          updated_at: params![9],
        };
        schedules.push(schedule);
        return Promise.resolve({ rows: [schedule], rowCount: 1 });
      }
      if (text.includes('SELECT * FROM oncall_schedules ORDER BY created_at DESC')) {
        return Promise.resolve({ rows: schedules, rowCount: schedules.length });
      }
      if (text.includes('WHERE id = $1') && text.includes('oncall_schedules')) {
        const found = schedules.find(s => s.id === params![0]);
        return Promise.resolve({ rows: found ? [found] : [], rowCount: found ? 1 : 0 });
      }
      if (text.includes('INSERT INTO oncall_assignments')) {
        const assignment = {
          id: params![0],
          schedule_id: params![1],
          user_id: params![2],
          start_time: params![3],
          end_time: params![4],
        };
        assignments.push(assignment);
        return Promise.resolve({ rows: [assignment], rowCount: 1 });
      }
      if (text.includes('INSERT INTO oncall_overrides')) {
        const override = {
          id: params![0],
          schedule_id: params![1],
          original_user_id: params![2],
          override_user_id: params![3],
          start_time: params![4],
          end_time: params![5],
          reason: params![6],
        };
        overrides.push(override);
        return Promise.resolve({ rows: [override], rowCount: 1 });
      }
      if (text.includes('DELETE FROM oncall_schedules')) {
        const idx = schedules.findIndex(s => s.id === params![0]);
        if (idx >= 0) schedules.splice(idx, 1);
        return Promise.resolve({ rowCount: idx >= 0 ? 1 : 0 });
      }
      if (text.includes('DELETE FROM oncall_assignments')) {
        return Promise.resolve({ rowCount: 1 });
      }
      if (text.includes('DELETE FROM oncall_overrides')) {
        return Promise.resolve({ rowCount: 1 });
      }
      // For findByScheduleAndTime in getCurrentOnCall - return empty
      if (text.includes('oncall_assignments') && text.includes('schedule_id') && text.includes('start_time') && text.includes('end_time')) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      // For findActiveAtTime in getOverride - return empty
      if (text.includes('oncall_overrides') && text.includes('schedule_id') && text.includes('start_time') && text.includes('end_time')) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    }),
  };
};

describe('OnCallService', () => {
  let service: OnCallService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new OnCallService(mockDb);
  });

  test('should create a schedule', async () => {
    const schedule = await service.createSchedule(
      'Team Alpha',
      'Asia/Shanghai',
      'weekly',
      ['user1', 'user2', 'user3'],
    );
    expect(schedule.id).toBeTruthy();
    expect(schedule.name).toBe('Team Alpha');
    expect(schedule.teamMembers).toEqual(['user1', 'user2', 'user3']);
  });

  test('should list schedules', async () => {
    await service.createSchedule('Team A', 'UTC', 'weekly', ['user1']);
    await service.createSchedule('Team B', 'UTC', 'daily', ['user2']);

    const schedules = await service.listSchedules();
    expect(schedules.length).toBe(2);
  });

  test('should get current on-call person', async () => {
    const schedule = await service.createSchedule(
      'Team Alpha',
      'Asia/Shanghai',
      'daily',
      ['user1', 'user2'],
    );
    const result = await service.getCurrentOnCall(schedule.id);
    expect(result).toBeDefined();
    expect(result.primaryUserId).toBeDefined();
  });

  test('should create override', async () => {
    const schedule = await service.createSchedule('Team A', 'UTC', 'weekly', ['user1', 'user2']);
    const now = new Date();
    const future = new Date(now);
    future.setDate(future.getDate() + 1);

    const override = await service.createOverride(
      schedule.id, 'user1', 'user3', now, future, 'user1 is on vacation',
    );
    expect(override.id).toBeTruthy();
    expect(override.overrideUserId).toBe('user3');
  });

  test('should return fallback for invalid schedule', async () => {
    const result = await service.getCurrentOnCall('nonexistent');
    expect(result.isOnCall).toBe(false);
  });

  test('should delete schedule and assignments', async () => {
    const schedule = await service.createSchedule('Team A', 'UTC', 'weekly', ['user1']);
    const deleted = await service.deleteSchedule(schedule.id);
    expect(deleted).toBe(true);
  });
});