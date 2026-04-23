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
    await service.createSchedule('Team A', 'UTC', 'weekly', ['user1']);
    await service.createSchedule('Team B', 'UTC', 'daily', ['user2']);
    const schedules = service.listSchedules();
    expect(schedules.length).toBe(2);
  });

  test('should get current on-call person', async () => {
    const schedule = await service.createSchedule(
      'Team Alpha',
      'Asia/Shanghai',
      'daily',
      ['user1', 'user2'],
    );
    const result = service.getCurrentOnCall(schedule.id);
    expect(result.isOnCall).toBe(true);
    expect(['user1', 'user2']).toContain(result.primaryUserId);
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

  test('should return fallback for invalid schedule', () => {
    const result = service.getCurrentOnCall('nonexistent');
    expect(result.isOnCall).toBe(false);
  });

  test('should delete schedule and assignments', async () => {
    const schedule = await service.createSchedule('Team A', 'UTC', 'weekly', ['user1']);
    const deleted = await service.deleteSchedule(schedule.id);
    expect(deleted).toBe(true);
    expect(service.getSchedule(schedule.id)).toBeUndefined();
  });
});
