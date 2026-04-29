/**
 * UserService - Business logic layer for User operations
 * 
 * Handles business rules, validation, and authentication
 * Note: Password hashing should be handled by auth layer or external service
 */

import { 
  UserRepository, 
  User, 
  CreateUserInput, 
  UpdateUserInput 
} from './UserRepository';

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

export class UserService {
  private repository: UserRepository;

  constructor(repository: UserRepository) {
    this.repository = repository;
  }

  /**
   * Get user by ID
   */
  async getUser(id: string): Promise<User> {
    const user = await this.repository.findById(id);
    
    if (!user) {
      throw new UserServiceError(`User not found: ${id}`, 'USER_NOT_FOUND');
    }
    
    return user;
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    return this.repository.findByUsername(username);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return this.repository.findByEmail(email);
  }

  /**
   * List all users with pagination
   */
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

  /**
   * Create a new user
   */
  async createUser(input: CreateUserInput): Promise<User> {
    // Validate required fields
    if (!input.username || input.username.trim().length === 0) {
      throw new UserServiceError('Username is required', 'INVALID_INPUT');
    }

    if (!input.passwordHash || input.passwordHash.length < 8) {
      throw new UserServiceError('Password must be at least 8 characters', 'INVALID_PASSWORD');
    }

    // Check for duplicate username
    const usernameExists = await this.repository.existsByUsername(input.username);
    if (usernameExists) {
      throw new UserServiceError('Username already exists', 'DUPLICATE_USERNAME');
    }

    // Check for duplicate email if provided
    if (input.email) {
      if (!this.isValidEmail(input.email)) {
        throw new UserServiceError('Invalid email format', 'INVALID_EMAIL');
      }
      
      const emailExists = await this.repository.existsByEmail(input.email);
      if (emailExists) {
        throw new UserServiceError('Email already exists', 'DUPLICATE_EMAIL');
      }
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_-]+$/.test(input.username)) {
      throw new UserServiceError(
        'Username can only contain letters, numbers, hyphens and underscores',
        'INVALID_USERNAME_FORMAT'
      );
    }

    // Hash password
    const passwordHash = await this.hashPassword(input.passwordHash);

    return this.repository.create({
      ...input,
      username: input.username.toLowerCase().trim(),
      email: input.email?.toLowerCase().trim(),
      passwordHash,
    });
  }

  /**
   * Update an existing user
   */
  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    // Check if user exists
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new UserServiceError(`User not found: ${id}`, 'USER_NOT_FOUND');
    }

    // Check for duplicate username if changing
    if (input.username) {
      const exists = await this.repository.existsByUsername(input.username);
      if (exists && existing.username !== input.username) {
        throw new UserServiceError('Username already exists', 'DUPLICATE_USERNAME');
      }
    }

    // Check for duplicate email if changing
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
    
    return updated;
  }

  /**
   * Delete a user (soft delete)
   */
  async deleteUser(id: string): Promise<boolean> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new UserServiceError(`User not found: ${id}`, 'USER_NOT_FOUND');
    }

    return this.repository.delete(id);
  }

  /**
   * Authenticate user with username and password
   */
  async authenticate(username: string, password: string): Promise<User> {
    const user = await this.repository.findByUsername(username);
    
    if (!user) {
      throw new UserServiceError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'active') {
      throw new UserServiceError('Account is inactive', 'ACCOUNT_INACTIVE');
    }

    const isValid = await this.comparePassword(password, user.password_hash);
    
    if (!isValid) {
      throw new UserServiceError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Update last login info
    // Note: In real implementation, we'd get the IP from the request context
    await this.repository.updateLastLogin(user.id, '0.0.0.0');

    return user;
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new UserServiceError('Password must be at least 8 characters', 'INVALID_PASSWORD');
    }

    const user = await this.repository.findById(userId);
    if (!user) {
      throw new UserServiceError('User not found', 'USER_NOT_FOUND');
    }

    // Verify old password
    const isValid = await this.comparePassword(oldPassword, user.password_hash);
    if (!isValid) {
      throw new UserServiceError('Current password is incorrect', 'INVALID_PASSWORD');
    }

    // Hash new password and update
    const newHash = await this.hashPassword(newPassword);
    await this.repository.update(userId, { password_hash: newHash } as UpdateUserInput);
  }

  /**
   * Get users by tenant
   */
  async getUsersByTenant(tenantId: string): Promise<User[]> {
    return this.repository.findByTenant(tenantId);
  }

  /**
   * Add user to tenant
   */
  async addUserToTenant(userId: string, tenantId: string, role: string = 'member'): Promise<void> {
    await this.repository.addToTenant(userId, tenantId, role);
  }

  /**
   * Remove user from tenant
   */
  async removeUserFromTenant(userId: string, tenantId: string): Promise<void> {
    await this.repository.removeFromTenant(userId, tenantId);
  }

  /**
   * Hash a password using PBKDF2 with random salt
   * Format: pbkdf2$salt$iterations$hash
   */
  private async hashPassword(password: string): Promise<string> {
    const crypto = await import('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, 100000, 64, 'sha256', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(`pbkdf2$${salt}$100000$${derivedKey.toString('hex')}`);
      });
    });
  }

  /**
   * Compare password with hash (supports PBKDF2 and legacy SHA-256)
   */
  private async comparePassword(password: string, hash: string): Promise<boolean> {
    // PBKDF2 format: pbkdf2$salt$iterations$hash
    if (hash.startsWith('pbkdf2$')) {
      const [_, salt, iterationsStr, expectedHash] = hash.split('$');
      const iterations = parseInt(iterationsStr, 10);
      const crypto = await import('crypto');
      return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, iterations, 64, 'sha256', (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey.toString('hex') === expectedHash);
        });
      });
    }

    // Legacy SHA-256 (migration compatibility)
    const crypto = await import('crypto');
    const sha256Hash = crypto.createHash('sha256');
    sha256Hash.update(password);
    if (sha256Hash.digest('hex') === hash) return true;

    // Plain text fallback
    return password === hash;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}