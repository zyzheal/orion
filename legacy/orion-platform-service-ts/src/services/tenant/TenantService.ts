/**
 * TenantService - Business logic layer for Tenant operations
 * 
 * Handles business rules, validation, and orchestration
 */

import { 
  TenantRepository, 
  Tenant, 
  CreateTenantInput, 
  UpdateTenantInput 
} from './TenantRepository';

export interface ListTenantsOptions {
  page?: number;
  limit?: number;
  status?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class TenantServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TenantServiceError';
  }
}

export class TenantService {
  private repository: TenantRepository;

  constructor(repository: TenantRepository) {
    this.repository = repository;
  }

  /**
   * Get tenant by ID
   */
  async getTenant(id: string): Promise<Tenant> {
    const tenant = await this.repository.findById(id);
    
    if (!tenant) {
      throw new TenantServiceError(`Tenant not found: ${id}`, 'TENANT_NOT_FOUND');
    }
    
    return tenant;
  }

  /**
   * Get tenant by name
   */
  async getTenantByName(name: string): Promise<Tenant | null> {
    return this.repository.findByName(name);
  }

  /**
   * List all tenants with pagination
   */
  async listTenants(options: ListTenantsOptions = {}): Promise<PaginatedResult<Tenant>> {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    const [tenants, total] = await Promise.all([
      this.repository.findAll({ status, limit, offset }),
      this.repository.count(status),
    ]);

    return {
      data: tenants,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new tenant
   */
  async createTenant(input: CreateTenantInput): Promise<Tenant> {
    // Validate input
    if (!input.name || input.name.trim().length === 0) {
      throw new TenantServiceError('Tenant name is required', 'INVALID_INPUT');
    }

    // Check for duplicate name
    const exists = await this.repository.existsByName(input.name);
    if (exists) {
      throw new TenantServiceError('Tenant name already exists', 'DUPLICATE_NAME');
    }

    // Validate name format (alphanumeric, hyphens, underscores)
    if (!/^[a-zA-Z0-9_-]+$/.test(input.name)) {
      throw new TenantServiceError(
        'Tenant name can only contain letters, numbers, hyphens and underscores',
        'INVALID_NAME_FORMAT'
      );
    }

    return this.repository.create({
      ...input,
      name: input.name.toLowerCase().trim(),
      display_name: input.display_name?.trim(),
    });
  }

  /**
   * Update an existing tenant
   */
  async updateTenant(id: string, input: UpdateTenantInput): Promise<Tenant> {
    // Check if tenant exists
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new TenantServiceError(`Tenant not found: ${id}`, 'TENANT_NOT_FOUND');
    }

    // Check for duplicate name if name is being changed
    if (input.name) {
      const exists = await this.repository.existsByName(input.name);
      if (exists && existing.name !== input.name) {
        throw new TenantServiceError('Tenant name already exists', 'DUPLICATE_NAME');
      }
    }

    const updated = await this.repository.update(id, input);
    
    if (!updated) {
      throw new TenantServiceError(`Failed to update tenant: ${id}`, 'UPDATE_FAILED');
    }
    
    return updated;
  }

  /**
   * Delete a tenant (soft delete)
   */
  async deleteTenant(id: string): Promise<boolean> {
    // Check if tenant exists
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new TenantServiceError(`Tenant not found: ${id}`, 'TENANT_NOT_FOUND');
    }

    return this.repository.delete(id);
  }

  /**
   * Permanently delete a tenant (use with caution)
   */
  async hardDeleteTenant(id: string): Promise<boolean> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new TenantServiceError(`Tenant not found: ${id}`, 'TENANT_NOT_FOUND');
    }

    return this.repository.hardDelete(id);
  }
}