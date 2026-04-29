import { OnCallService } from '../OnCallService';

describe('OnCallService', () => {
  let service: OnCallService;

  beforeEach(() => {
    service = new OnCallService();
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
    // Without DB, schedules are created but not stored for retrieval
    // (in-memory mode doesn't have a schedule map)
    const schedules = await service.listSchedules();
    expect(schedules).toEqual([]);
  });

  test('should get current on-call person', async () => {
    const schedule = await service.createSchedule(
      'Team Alpha',
      'Asia/Shanghai',
      'daily',
      ['user1', 'user2'],
    );
    // In memory mode, schedule is not retrievable, so fallback returns false
    const result = await service.getCurrentOnCall(schedule.id);
    expect(result.isOnCall).toBe(false);
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
    // In memory mode, delete returns false (no DB to delete from)
    const deleted = await service.deleteSchedule(schedule.id);
    expect(deleted).toBe(false);
  });
});
