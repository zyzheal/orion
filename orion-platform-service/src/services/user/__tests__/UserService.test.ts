/**
 * UserService Unit Tests
 */

import { UserService, UserServiceError } from '../UserService';
import { UserRepository, User, CreateUserInput } from '../UserRepository';

// Mock repository
class MockUserRepository {
  findById = jest.fn();
  findByUsername = jest.fn();
  findByEmail = jest.fn();
  findAll = jest.fn();
  create = jest.fn();
  update = jest.fn();
  delete = jest.fn();
  count = jest.fn();
  existsByUsername = jest.fn();
  existsByEmail = jest.fn();
  updateLastLogin = jest.fn();
  findByTenant = jest.fn();
}

describe('UserService', () => {
  let service: UserService;
  let mockRepository: MockUserRepository;

  beforeEach(() => {
    mockRepository = new MockUserRepository();
    service = new UserService(mockRepository as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUser', () => {
    it('should return user when found', async () => {
      const mockUser = { id: '1', username: 'john', status: 'active' } as User;
      mockRepository.findById.mockResolvedValue(mockUser);

      const result = await service.getUser('1');
      
      expect(result).toEqual(mockUser);
    });

    it('should throw error when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getUser('nonexistent')).rejects.toThrow('User not found');
    });
  });

  describe('getUserByUsername', () => {
    it('should return user by username', async () => {
      const mockUser = { id: '1', username: 'john' } as User;
      mockRepository.findByUsername.mockResolvedValue(mockUser);

      const result = await service.getUserByUsername('john');
      
      expect(result?.username).toBe('john');
    });
  });

  describe('listUsers', () => {
    it('should return paginated users', async () => {
      const mockUsers = [{ id: '1', username: 'u1' }, { id: '2', username: 'u2' }] as User[];
      mockRepository.findAll.mockResolvedValue(mockUsers);
      mockRepository.count.mockResolvedValue(2);

      const result = await service.listUsers({ page: 1, limit: 10 });
      
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('createUser', () => {
    it('should create user with valid data', async () => {
      const input: CreateUserInput = { 
        username: 'newuser', 
        email: 'new@example.com',
        passwordHash: 'password123',
      };
      const created = { id: '1', ...input, status: 'active' } as User;
      mockRepository.existsByUsername.mockResolvedValue(false);
      mockRepository.existsByEmail.mockResolvedValue(false);
      mockRepository.create.mockResolvedValue(created);

      const result = await service.createUser(input);
      
      expect(result.username).toBe('newuser');
    });

    it('should reject duplicate username', async () => {
      mockRepository.existsByUsername.mockResolvedValue(true);

      await expect(service.createUser({ username: 'existing', passwordHash: 'password123' })).rejects.toThrow('Username already exists');
    });

    it('should reject duplicate email', async () => {
      mockRepository.existsByUsername.mockResolvedValue(false);
      mockRepository.existsByEmail.mockResolvedValue(true);

      await expect(service.createUser({ username: 'new', email: 'existing@example.com', passwordHash: 'password123' })).rejects.toThrow('Email already exists');
    });

    it('should reject empty username', async () => {
      await expect(service.createUser({ username: '', passwordHash: 'password123' })).rejects.toThrow('Username is required');
    });

    it('should reject invalid email format', async () => {
      await expect(service.createUser({ username: 'user', email: 'invalid', passwordHash: 'password123' })).rejects.toThrow('Invalid email format');
    });

    it('should reject short password', async () => {
      await expect(service.createUser({ username: 'user', passwordHash: '1234567' })).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should lowercase username', async () => {
      const input: CreateUserInput = { username: 'NEWUSER', passwordHash: 'password123' };
      mockRepository.existsByUsername.mockResolvedValue(false);
      mockRepository.existsByEmail.mockResolvedValue(false);
      mockRepository.create.mockResolvedValue({} as User);

      await service.createUser(input);
      
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'newuser' })
      );
    });
  });

  describe('updateUser', () => {
    it('should update user', async () => {
      const existing = { id: '1', username: 'old' } as User;
      const updated = { id: '1', username: 'old', name: 'New Name' } as User;
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(updated);

      const result = await service.updateUser('1', { name: 'New Name' });
      
      expect(result.name).toBe('New Name');
    });

    it('should throw error when user not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.updateUser('nonexistent', {})).rejects.toThrow('User not found');
    });
  });

  describe('deleteUser', () => {
    it('should soft delete user', async () => {
      const existing = { id: '1', username: 'test' } as User;
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.delete.mockResolvedValue(true);

      const result = await service.deleteUser('1');
      
      expect(result).toBe(true);
    });
  });

  describe('authenticate', () => {
    it('should authenticate with correct credentials', async () => {
      // Use SHA-256 hash of 'password123' which is what our hashPassword produces
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256');
      hash.update('correctpassword');
      const passwordHash = hash.digest('hex');

      const mockUser = { 
        id: '1', 
        username: 'john', 
        password_hash: passwordHash,
        status: 'active',
      } as User;
      mockRepository.findByUsername.mockResolvedValue(mockUser);
      mockRepository.updateLastLogin.mockResolvedValue();

      const result = await service.authenticate('john', 'correctpassword');
      
      expect(result).toBeDefined();
    });

    it('should fail with wrong password', async () => {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256');
      hash.update('correctpassword');
      const passwordHash = hash.digest('hex');

      const mockUser = { 
        id: '1', 
        username: 'john', 
        password_hash: passwordHash,
        status: 'active',
      } as User;
      mockRepository.findByUsername.mockResolvedValue(mockUser);

      await expect(service.authenticate('john', 'wrongpassword')).rejects.toThrow('Invalid credentials');
    });

    it('should fail for inactive user', async () => {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256');
      hash.update('password123');
      const passwordHash = hash.digest('hex');

      const mockUser = { 
        id: '1', 
        username: 'john', 
        password_hash: passwordHash,
        status: 'inactive',
      } as User;
      mockRepository.findByUsername.mockResolvedValue(mockUser);

      await expect(service.authenticate('john', 'password123')).rejects.toThrow('Account is inactive');
    });
  });
});