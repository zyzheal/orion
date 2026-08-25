import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userApi } from '../user';
import { api } from '../client';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockUser: any = {
  id: 'u1',
  username: 'admin',
  email: 'admin@example.com',
  role: 'admin',
  status: 'active',
  createdAt: '2026-08-26T12:00:00Z',
};

describe('User API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get user profile', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: mockUser,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await userApi.getProfile('u1');
    expect(api.get).toHaveBeenCalledWith('/users/u1/profile');
    expect(result.data).toEqual(mockUser);
  });

  it('should update user profile', async () => {
    vi.mocked(api.put).mockResolvedValue({
      data: { ...mockUser, email: 'new@example.com' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await userApi.updateProfile('u1', { email: 'new@example.com' });
    expect(api.put).toHaveBeenCalledWith('/users/u1/profile', {
      email: 'new@example.com',
    });
  });

  it('should get user teams', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { id: 't1', name: 'platform', role: 'lead' },
        { id: 't2', name: 'infra', role: 'member' },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await userApi.getTeams('u1');
    expect(api.get).toHaveBeenCalledWith('/users/u1/teams');
    expect(result.data).toHaveLength(2);
  });

  it('should get user permissions', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { resource: 'pipelines', actions: ['read', 'write'] },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await userApi.getPermissions('u1');
    expect(api.get).toHaveBeenCalledWith('/users/u1/permissions');
    expect(result.data[0].resource).toBe('pipelines');
  });

  it('should get user activities with defaults', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        {
          id: 'a1',
          action: 'login',
          createdAt: '2026-08-26T11:00:00Z',
        },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await userApi.getActivities('u1');
    expect(api.get).toHaveBeenCalledWith('/users/u1/activities', {
      params: { page: 1, pageSize: 20 },
    });
  });

  it('should get user activities with custom pagination', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await userApi.getActivities('u1', 3, 50);
    expect(api.get).toHaveBeenCalledWith('/users/u1/activities', {
      params: { page: 3, pageSize: 50 },
    });
  });

  it('should get user tokens', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { id: 'tk1', name: 'CI Token', createdAt: '2026-08-01T00:00:00Z' },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const result = await userApi.getTokens('u1');
    expect(api.get).toHaveBeenCalledWith('/users/u1/tokens');
    expect(result.data).toHaveLength(1);
  });

  it('should create a user token', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        id: 'tk2',
        name: 'New Token',
        expiresAt: '2026-09-26T00:00:00Z',
        createdAt: '2026-08-26T12:00:00Z',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await userApi.createToken('u1', 'New Token', 30);
    expect(api.post).toHaveBeenCalledWith('/users/u1/tokens', {
      name: 'New Token',
      expiresInDays: 30,
    });
  });

  it('should delete a user token', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      data: undefined,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await userApi.deleteToken('u1', 'tk1');
    expect(api.delete).toHaveBeenCalledWith('/users/u1/tokens/tk1');
  });

  it('should get notification preferences', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        emailEnabled: true,
        inAppEnabled: true,
        webhookEnabled: false,
        notifyFrequency: 'instant',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await userApi.getNotificationPreferences('u1');
    expect(api.get).toHaveBeenCalledWith('/users/u1/notifications');
  });

  it('should update notification preferences', async () => {
    vi.mocked(api.put).mockResolvedValue({
      data: {
        emailEnabled: true,
        inAppEnabled: false,
        webhookEnabled: true,
        webhookUrl: 'https://hooks.example.com/orion',
        notifyFrequency: 'daily',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    const prefs = {
      emailEnabled: true,
      inAppEnabled: false,
      webhookEnabled: true,
      webhookUrl: 'https://hooks.example.com/orion',
      notifyFrequency: 'daily',
    };
    await userApi.updateNotificationPreferences('u1', prefs as any);
    expect(api.put).toHaveBeenCalledWith('/users/u1/notifications', prefs);
  });

  it('should change password', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: undefined,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any);

    await userApi.changePassword('u1', 'oldPass', 'newPass');
    expect(api.post).toHaveBeenCalledWith('/users/u1/change-password', {
      oldPassword: 'oldPass',
      newPassword: 'newPass',
    });
  });
});
