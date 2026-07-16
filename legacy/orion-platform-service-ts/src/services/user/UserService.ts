/**
 * UserService - Business logic layer for User operations
 *
 * Handles business rules, validation, and authentication
 * Note: Password hashing is delegated to PasswordService (bcrypt-based)
 */

import {
  UserRepository,
  User,
  CreateUserInput,
  UpdateUserInput
} from './UserRepository';
import { CacheService } from '../cache/CacheService';
import { PasswordService } from '../auth/PasswordService';

export interface ListUsersOptions {
  page?: number;
  limit?: number;
  tenantId?: string;
  status?: string;
  role?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class UserServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'UserServiceError';
  }
}

export interface BulkImportResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; username?: string; error: string }>;
}

export interface ExportOptions {
  tenantId?: string;
  role?: string;
  status?: string;
  format: 'csv' | 'json';
}

export class UserService {
  private repository: UserRepository;
  private cache: CacheService;
  private passwordService: PasswordService;

  constructor(repository: UserRepository, cache?: CacheService) {
    this.repository = repository;
    this.cache = cache || new CacheService(null);
    this.passwordService = new PasswordService();
  }

  /**
   * Get user by ID
   */
  async getUser(id: string): Promise<User> {
    const cached = await this.cache.get<User>(`user:${id}`);
    if (cached) return cached;

    const user = await this.repository.findById(id);

    if (!user) {
      throw new UserServiceError(`User not found: ${id}`, 'USER_NOT_FOUND');
    }

    await this.cache.set(`user:${id}`, user, 300);

    return user;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return this.repository.findByUsername(username);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.repository.findByEmail(email);
  }

  async listUsers(options: ListUsersOptions = {}): Promise<PaginatedResult<User>> {
    const { page = 1, limit = 20, tenantId, status, role } = options;
    const offset = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.repository.findAll({ tenantId, status, role, limit, offset }),
      this.repository.count({ tenantId, status }),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createUser(input: CreateUserInput): Promise<User> {
    if (!input.username || input.username.trim().length === 0) {
      throw new UserServiceError('Username is required', 'INVALID_INPUT');
    }

    if (!input.passwordHash || input.passwordHash.length < 8) {
      throw new UserServiceError('Password must be at least 8 characters', 'INVALID_PASSWORD');
    }

    const usernameExists = await this.repository.existsByUsername(input.username);
    if (usernameExists) {
      throw new UserServiceError('Username already exists', 'DUPLICATE_USERNAME');
    }

    if (input.email) {
      if (!this.isValidEmail(input.email)) {
        throw new UserServiceError('Invalid email format', 'INVALID_EMAIL');
      }

      const emailExists = await this.repository.existsByEmail(input.email);
      if (emailExists) {
        throw new UserServiceError('Email already exists', 'DUPLICATE_EMAIL');
      }
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(input.username)) {
      throw new UserServiceError(
        'Username can only contain letters, numbers, hyphens and underscores',
        'INVALID_USERNAME_FORMAT'
      );
    }

    // Hash password using PasswordService (bcrypt, with legacy backward compatibility)
    const passwordHash = await this.passwordService.hash(input.passwordHash);

    return this.repository.create({
      ...input,
      username: input.username.toLowerCase().trim(),
      email: input.email?.toLowerCase().trim(),
      passwordHash,
    });
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new UserServiceError(`User not found: ${id}`, 'USER_NOT_FOUND');
    }

    if (input.username) {
      const exists = await this.repository.existsByUsername(input.username);
      if (exists && existing.username !== input.username) {
        throw new UserServiceError('Username already exists', 'DUPLICATE_USERNAME');
      }
    }

    if (input.email) {
      if (!this.isValidEmail(input.email)) {
        throw new UserServiceError('Invalid email format', 'INVALID_EMAIL');
      }

      const exists = await this.repository.existsByEmail(input.email);
      if (exists && existing.email !== input.email) {
        throw new UserServiceError('Email already exists', 'DUPLICATE_EMAIL');
      }
    }

    const updated = await this.repository.update(id, input);

    if (!updated) {
      throw new UserServiceError(`Failed to update user: ${id}`, 'UPDATE_FAILED');
    }

    await this.cache.del(`user:${id}`);

    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new UserServiceError(`User not found: ${id}`, 'USER_NOT_FOUND');
    }

    await this.cache.del(`user:${id}`);

    return this.repository.delete(id);
  }

  async authenticate(username: string, password: string): Promise<User> {
    const user = await this.repository.findByUsername(username);

    if (!user) {
      throw new UserServiceError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'active') {
      throw new UserServiceError('Account is inactive', 'ACCOUNT_INACTIVE');
    }

    // Verify using PasswordService (supports bcrypt, PBKDF2, scrypt, SHA-256)
    const isValid = await this.passwordService.verifyPassword(password, user.password_hash);

    if (!isValid) {
      throw new UserServiceError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    await this.repository.updateLastLogin(user.id, '0.0.0.0');

    return user;
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new UserServiceError('Password must be at least 8 characters', 'INVALID_PASSWORD');
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      throw new UserServiceError('User not found', 'USER_NOT_FOUND');
    }

    // Verify old password using PasswordService
    const isValid = await this.passwordService.verifyPassword(oldPassword, user.password_hash);
    if (!isValid) {
      throw new UserServiceError('Current password is incorrect', 'INVALID_PASSWORD');
    }

    // Hash new password and update
    const newHash = await this.passwordService.hash(newPassword);
    await this.repository.update(userId, { password_hash: newHash } as UpdateUserInput);
  }

  async getUsersByTenant(tenantId: string): Promise<User[]> {
    return this.repository.findByTenant(tenantId);
  }

  async addUserToTenant(userId: string, tenantId: string, role: string = 'member'): Promise<void> {
    await this.repository.addToTenant(userId, tenantId, role);
  }

  async removeUserFromTenant(userId: string, tenantId: string): Promise<void> {
    await this.repository.removeFromTenant(userId, tenantId);
  }

  // =========================================================================
  // Bulk Import / Export
  // =========================================================================

  /**
   * Bulk import users from CSV text.
   * CSV format: username,email,password,name,role (header row optional)
   * Returns import summary with per-row errors.
   */
  async bulkImportUsers(csvText: string, tenantId: string, createdBy: string): Promise<BulkImportResult> {
    const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) {
      return { total: 0, success: 0, failed: 0, errors: [] };
    }

    // Detect if header row exists
    const firstLine = lines[0].split(',');
    const hasHeader = firstLine.some(col => col.trim().toLowerCase() === 'username');
    const startIndex = hasHeader ? 1 : 0;

    const result: BulkImportResult = { total: 0, success: 0, failed: 0, errors: [] };

    for (let i = startIndex; i < lines.length; i++) {
      const rowNum = i + 1;
      const cols = lines[i].split(',').map(c => c.trim());
      result.total++;

      try {
        const [username, email, password, name, role] = cols;

        if (!username || !password) {
          result.failed++;
          result.errors.push({ row: rowNum, username: username || '(empty)', error: 'username and password are required' });
          continue;
        }

        const input: CreateUserInput = {
          username,
          email: email || undefined,
          passwordHash: password,
          name: name || undefined,
          role: role || 'member',
          tenantId,
          created_by: createdBy,
        };

        await this.createUser(input);
        result.success++;
      } catch (err: any) {
        result.failed++;
        result.errors.push({ row: rowNum, username: cols[0] || '(empty)', error: err.message || 'Unknown error' });
      }
    }

    return result;
  }

  /**
   * Export users as CSV or JSON text.
   */
  async exportUsers(options: ExportOptions): Promise<string> {
    const { tenantId, role, status } = options;
    const result = await this.listUsers({ tenantId, role, status, limit: 10000 });

    if (options.format === 'json') {
      return JSON.stringify(result.data.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        created_at: u.created_at,
      })), null, 2);
    }

    // CSV format
    const header = 'id,username,email,name,role,status,created_at\n';
    const rows = result.data.map(u =>
      [u.id, u.username, u.email || '', u.name || '', u.role, u.status, new Date(u.created_at).toISOString()].join(',')
    ).join('\n');
    return header + rows;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
