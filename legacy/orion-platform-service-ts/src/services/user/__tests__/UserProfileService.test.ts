/**
 * UserProfileService 测试
 *
 * 测试用户档案服务：获取档案、更新档案、用户名/邮箱检查。
 * Mock UserRepository 模拟数据访问。
 */

import { UserProfileService, UserProfileServiceError } from '../UserProfileService';
import { User } from '../UserRepository';

// ==================== Mock UserRepository ====================

function createMockUserRepository() {
  const users = new Map<string, User>();

  return {
    users,
    findById: jest.fn().mockImplementation(async (id: string) => {
      return users.get(id) || null;
    }),
    update: jest.fn().mockImplementation(async (id: string, input: any) => {
      const user = users.get(id);
      if (!user) return null;
      const updated = { ...user, ...input };
      users.set(id, updated);
      return updated;
    }),
    existsByUsername: jest.fn().mockImplementation(async (username: string) => {
      for (const user of users.values()) {
        if (user.username === username) return true;
      }
      return false;
    }),
    existsByEmail: jest.fn().mockImplementation(async (email: string) => {
      for (const user of users.values()) {
        if (user.email === email) return true;
      }
      return false;
    }),
  };
}

function createTestUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    role: 'developer',
    status: 'active',
    avatar_url: 'https://example.com/avatar.png',
    name: 'Test User',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

// ==================== Tests ====================

describe('UserProfileService', () => {
  let service: UserProfileService;
  let mockRepo: ReturnType<typeof createMockUserRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = createMockUserRepository();
    service = new UserProfileService(mockRepo as any);
  });

  // ---- getProfile ----

  describe('getProfile', () => {
    it('should return user profile with all fields', async () => {
      mockRepo.users.set('user-1', createTestUser());

      const profile = await service.getProfile('user-1');

      expect(profile).toBeDefined();
      expect(profile!.id).toBe('user-1');
      expect(profile!.username).toBe('testuser');
      expect(profile!.email).toBe('test@example.com');
      expect(profile!.role).toBe('developer');
      expect(profile!.avatar).toBe('https://example.com/avatar.png');
      expect(profile!.status).toBe('active');
      expect(profile!.createdAt).toEqual(new Date('2026-01-01'));
      expect(profile!.teams).toEqual([]);
      expect(profile!.permissions).toEqual([]);
    });

    it('should return null for non-existent user', async () => {
      const profile = await service.getProfile('non-existent');
      expect(profile).toBeNull();
    });

    it('should handle user without avatar', async () => {
      mockRepo.users.set('user-1', createTestUser({ avatar_url: undefined }));

      const profile = await service.getProfile('user-1');

      expect(profile!.avatar).toBeUndefined();
    });

    it('should handle user with null email', async () => {
      mockRepo.users.set('user-1', createTestUser({ email: null as any }));

      const profile = await service.getProfile('user-1');

      expect(profile!.email).toBe('');
    });
  });

  // ---- getUserTeams ----

  describe('getUserTeams', () => {
    it('should return empty array (not yet implemented)', async () => {
      const teams = await service.getUserTeams('user-1');
      expect(teams).toEqual([]);
    });
  });

  // ---- getUserPermissions ----

  describe('getUserPermissions', () => {
    it('should return empty array (not yet implemented)', async () => {
      const permissions = await service.getUserPermissions('user-1');
      expect(permissions).toEqual([]);
    });
  });

  // ---- updateProfile ----

  describe('updateProfile', () => {
    it('should update username', async () => {
      mockRepo.users.set('user-1', createTestUser());

      const updated = await service.updateProfile('user-1', { username: 'newname' });

      expect(updated).toBeDefined();
      expect(updated!.username).toBe('newname');
    });

    it('should update email', async () => {
      mockRepo.users.set('user-1', createTestUser());

      const updated = await service.updateProfile('user-1', { email: 'new@example.com' });

      expect(updated).toBeDefined();
      expect(updated!.email).toBe('new@example.com');
    });

    it('should update avatar', async () => {
      mockRepo.users.set('user-1', createTestUser());

      const updated = await service.updateProfile('user-1', { avatar: 'https://new.avatar.png' });

      expect(updated).toBeDefined();
      expect(updated!.avatar).toBe('https://new.avatar.png');
    });

    it('should update name', async () => {
      mockRepo.users.set('user-1', createTestUser());

      const updated = await service.updateProfile('user-1', { name: 'New Name' });

      expect(updated).toBeDefined();
    });

    it('should return null for non-existent user', async () => {
      const result = await service.updateProfile('non-existent', { username: 'test' });
      expect(result).toBeNull();
    });

    it('should return current profile when no fields to update', async () => {
      mockRepo.users.set('user-1', createTestUser());

      const result = await service.updateProfile('user-1', {});

      expect(result).toBeDefined();
      expect(result!.username).toBe('testuser');
    });

    it('should return null when update fails', async () => {
      mockRepo.users.set('user-1', createTestUser());
      mockRepo.update.mockResolvedValueOnce(null);

      const result = await service.updateProfile('user-1', { username: 'newname' });

      expect(result).toBeNull();
    });

    it('should update multiple fields at once', async () => {
      mockRepo.users.set('user-1', createTestUser());

      const updated = await service.updateProfile('user-1', {
        username: 'newname',
        email: 'new@example.com',
        avatar: 'https://new.png',
        name: 'New Name',
      });

      expect(updated).toBeDefined();
      expect(updated!.username).toBe('newname');
      expect(updated!.email).toBe('new@example.com');
    });
  });

  // ---- isUsernameExists ----

  describe('isUsernameExists', () => {
    it('should return true when username exists', async () => {
      mockRepo.users.set('user-1', createTestUser());

      const exists = await service.isUsernameExists('testuser');

      expect(exists).toBe(true);
    });

    it('should return false when username does not exist', async () => {
      const exists = await service.isUsernameExists('nonexistent');
      expect(exists).toBe(false);
    });
  });

  // ---- isEmailExists ----

  describe('isEmailExists', () => {
    it('should return true when email exists', async () => {
      mockRepo.users.set('user-1', createTestUser());

      const exists = await service.isEmailExists('test@example.com');

      expect(exists).toBe(true);
    });

    it('should return false when email does not exist', async () => {
      const exists = await service.isEmailExists('nonexistent@example.com');
      expect(exists).toBe(false);
    });
  });

  // ---- UserProfileServiceError ----

  describe('UserProfileServiceError', () => {
    it('should create error with message and code', () => {
      const error = new UserProfileServiceError('User not found', 'USER_NOT_FOUND');

      expect(error.message).toBe('User not found');
      expect(error.code).toBe('USER_NOT_FOUND');
      expect(error.name).toBe('UserProfileServiceError');
      expect(error).toBeInstanceOf(Error);
    });
  });
});
