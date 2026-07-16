/**
 * PageRegistryService - Service layer for Page Registry management
 *
 * Provides business logic for page routing configuration management
 */

import { DatabasePool } from '../database';
import { PageRegistryRepository, PageRegistryEntry, CreatePageEntryInput, UpdatePageEntryInput, PageRegistryHistory } from './PageRegistryRepository';
import { OrionError, ErrorCode, ConflictError } from '../../errors';

export class PageRegistryService {
  private repository: PageRegistryRepository;

  constructor(db: DatabasePool) {
    this.repository = new PageRegistryRepository(db);
  }

  /**
   * Get all page registry entries
   */
  async getAll(tenantId?: string): Promise<PageRegistryEntry[]> {
    return this.repository.findAll(tenantId);
  }

  /**
   * Get enabled page registry entries
   */
  async getEnabled(tenantId?: string): Promise<PageRegistryEntry[]> {
    return this.repository.findEnabled(tenantId);
  }

  /**
   * Get page entry by path
   */
  async getByPath(path: string, tenantId?: string): Promise<PageRegistryEntry | null> {
    return this.repository.findByPath(path, tenantId);
  }

  /**
   * Get page entries by menu key
   */
  async getByMenuKey(menuKey: string, tenantId?: string): Promise<PageRegistryEntry[]> {
    return this.repository.findByMenuKey(menuKey, tenantId);
  }

  /**
   * Create new page entry
   */
  async create(input: CreatePageEntryInput, userId?: string): Promise<PageRegistryEntry> {
    // Check if path already exists for this tenant
    const existing = await this.repository.findByPath(input.path, input.tenantId);
    if (existing) {
      throw new ConflictError(`Page with path '${input.path}' already exists`, { path: input.path });
    }

    const entry = await this.repository.create({
      ...input,
      createdBy: userId || undefined,
    });

    // Add history record
    await this.repository.addHistory(
      input.path,
      'created',
      null,
      this.toRecord(entry),
      userId || null,
      `Created page '${input.path}' → ${input.component}`,
      input.tenantId,
    );

    return entry;
  }

  /**
   * Update page entry
   */
  async update(path: string, input: UpdatePageEntryInput, userId?: string, tenantId?: string): Promise<PageRegistryEntry> {
    // Get current entry
    const current = await this.repository.findByPath(path, tenantId);
    if (!current) {
      throw new OrionError(`Page with path '${path}' not found`, ErrorCode.NOT_FOUND);
    }

    // If path is being changed, check new path doesn't exist
    if (input.path && input.path !== path) {
      const existing = await this.repository.findByPath(input.path, tenantId);
      if (existing) {
        throw new ConflictError(`Page with path '${input.path}' already exists`, { path: input.path });
      }
    }

    const updated = await this.repository.update(path, input, tenantId);
    if (!updated) {
      throw new OrionError('Failed to update page entry', ErrorCode.OPERATION_FAILED);
    }

    // Add history record
    const action = input.status && input.status !== current.status ? 'status_changed' : 'updated';
    await this.repository.addHistory(
      path,
      action,
      this.toRecord(current),
      this.toRecord(updated),
      userId || null,
      `Updated page '${path}'`,
      tenantId,
    );

    return updated;
  }

  /**
   * Delete page entry
   */
  async delete(path: string, userId?: string, tenantId?: string): Promise<void> {
    const current = await this.repository.findByPath(path, tenantId);
    if (!current) {
      throw new OrionError(`Page with path '${path}' not found`, ErrorCode.NOT_FOUND);
    }

    const deleted = await this.repository.delete(path, tenantId);
    if (!deleted) {
      throw new OrionError('Failed to delete page entry', ErrorCode.OPERATION_FAILED);
    }

    // Add history record
    await this.repository.addHistory(
      path,
      'deleted',
      this.toRecord(current),
      null,
      userId || null,
      `Deleted page '${path}'`,
      tenantId,
    );
  }

  /**
   * Toggle page status
   */
  async toggleStatus(path: string, userId?: string, tenantId?: string): Promise<PageRegistryEntry> {
    const current = await this.repository.findByPath(path, tenantId);
    if (!current) {
      throw new OrionError(`Page with path '${path}' not found`, ErrorCode.NOT_FOUND);
    }

    const updated = await this.repository.toggleStatus(path, tenantId);
    if (!updated) {
      throw new OrionError('Failed to toggle page status', ErrorCode.OPERATION_FAILED);
    }

    // Add history record
    await this.repository.addHistory(
      path,
      'status_changed',
      this.toRecord(current),
      this.toRecord(updated),
      userId || null,
      `Changed status from '${current.status}' to '${updated.status}'`,
      tenantId,
    );

    return updated;
  }

  /**
   * Get configuration history
   */
  async getHistory(path: string, tenantId?: string): Promise<PageRegistryHistory[]> {
    return this.repository.getHistory(path, tenantId);
  }

  /**
   * Convert entry to record for history
   */
  private toRecord(entry: PageRegistryEntry): Record<string, any> {
    return {
      id: entry.id,
      path: entry.path,
      component: entry.component,
      protected: entry.protected,
      permission: entry.permission,
      hideLayout: entry.hideLayout,
      microApp: entry.microApp,
      subAppKey: entry.subAppKey,
      menuKey: entry.menuKey,
      menuLabel: entry.menuLabel,
      menuIcon: entry.menuIcon,
      hidden: entry.hidden,
      redirectTo: entry.redirectTo,
      title: entry.title,
      breadcrumb: entry.breadcrumb,
      sortOrder: entry.sortOrder,
      status: entry.status,
    };
  }
}

export default PageRegistryService;
