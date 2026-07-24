/**
 * PageRegistryRepository - PostgreSQL Repository for Page Registry Configuration
 *
 * Handles CRUD operations for page routing configurations
 * stored in the page_registry table.
 * Pattern: Follows SubAppRepository (services/subapp/SubAppRepository.ts)
 */

import { DatabasePool } from '../database';
import { BaseRepository } from '../../db/base-repository';

// ==================== Types ====================

export interface PageRegistryEntry {
  id: string;
  path: string;
  component: string;
  protected: boolean;
  permission: Record<string, any>;
  hideLayout: boolean;
  microApp: boolean;
  subAppKey: string | null;
  menuKey: string | null;
  menuLabel: string | null;
  menuIcon: string | null;
  hidden: boolean;
  redirectTo: string | null;
  title: string | null;
  breadcrumb: boolean;
  sortOrder: number;
  status: 'enabled' | 'disabled';
  tenantId: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePageEntryInput {
  path: string;
  component: string;
  protected?: boolean;
  permission?: Record<string, any>;
  hideLayout?: boolean;
  microApp?: boolean;
  subAppKey?: string;
  menuKey?: string;
  menuLabel?: string;
  menuIcon?: string;
  hidden?: boolean;
  redirectTo?: string;
  title?: string;
  breadcrumb?: boolean;
  sortOrder?: number;
  status?: 'enabled' | 'disabled';
  tenantId?: string;
  createdBy?: string;
}

export interface UpdatePageEntryInput {
  path?: string;
  component?: string;
  protected?: boolean;
  permission?: Record<string, any>;
  hideLayout?: boolean;
  microApp?: boolean;
  subAppKey?: string | null;
  menuKey?: string | null;
  menuLabel?: string | null;
  menuIcon?: string | null;
  hidden?: boolean;
  redirectTo?: string | null;
  title?: string | null;
  breadcrumb?: boolean;
  sortOrder?: number;
  status?: 'enabled' | 'disabled';
}

export interface PageRegistryHistory {
  id: string;
  pagePath: string;
  action: 'created' | 'updated' | 'deleted' | 'status_changed';
  oldValue: Record<string, any> | null;
  newValue: Record<string, any> | null;
  changedBy: string | null;
  changeSummary: string | null;
  tenantId: string;
  createdAt: Date;
}

// ==================== Repository ====================

export class PageRegistryRepository extends BaseRepository<PageRegistryEntry> {
  constructor(db: DatabasePool) {
    super(db, 'page_registry');
  }

  /**
   * Find all page registry entries
   */
  // @ts-ignore
  async findAll(tenantId?: string): Promise<PageRegistryEntry[]> {
    const query = tenantId
      ? `SELECT * FROM page_registry WHERE tenant_id = $1 ORDER BY sort_order ASC, path ASC`
      : `SELECT * FROM page_registry ORDER BY sort_order ASC, path ASC`;
    const params = tenantId ? [tenantId] : [];
    const result = await this.db.query(query, params);
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * Find enabled entries only
   */
  async findEnabled(tenantId?: string): Promise<PageRegistryEntry[]> {
    const query = tenantId
      ? `SELECT * FROM page_registry WHERE tenant_id = $1 AND status = 'enabled' ORDER BY sort_order ASC`
      : `SELECT * FROM page_registry WHERE status = 'enabled' ORDER BY sort_order ASC`;
    const params = tenantId ? [tenantId] : [];
    const result = await this.db.query(query, params);
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * Find by path
   */
  async findByPath(path: string, tenantId?: string): Promise<PageRegistryEntry | null> {
    const query = tenantId
      ? `SELECT * FROM page_registry WHERE path = $1 AND tenant_id = $2`
      : `SELECT * FROM page_registry WHERE path = $1`;
    const params = tenantId ? [path, tenantId] : [path];
    const result = await this.db.query(query, params);
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find by menu key
   */
  async findByMenuKey(menuKey: string, tenantId?: string): Promise<PageRegistryEntry[]> {
    const query = tenantId
      ? `SELECT * FROM page_registry WHERE menu_key = $1 AND tenant_id = $2 AND status = 'enabled' ORDER BY sort_order ASC`
      : `SELECT * FROM page_registry WHERE menu_key = $1 AND status = 'enabled' ORDER BY sort_order ASC`;
    const params = tenantId ? [menuKey, tenantId] : [menuKey];
    const result = await this.db.query(query, params);
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * Create new page entry
   */
  async create(input: CreatePageEntryInput): Promise<PageRegistryEntry> {
    const result = await this.db.query(
      `INSERT INTO page_registry (
        path, component, protected, permission, hide_layout, micro_app, sub_app_key,
        menu_key, menu_label, menu_icon, hidden, redirect_to, title, breadcrumb,
        sort_order, status, tenant_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        input.path,
        input.component,
        input.protected ?? true,
        JSON.stringify(input.permission || {}),
        input.hideLayout ?? false,
        input.microApp ?? false,
        input.subAppKey || null,
        input.menuKey || null,
        input.menuLabel || null,
        input.menuIcon || null,
        input.hidden ?? false,
        input.redirectTo || null,
        input.title || null,
        input.breadcrumb ?? true,
        input.sortOrder ?? 0,
        input.status || 'enabled',
        input.tenantId || '00000000-0000-0000-0000-000000000000',
        input.createdBy || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update page entry by path
   */
  // @ts-ignore
  async update(path: string, input: UpdatePageEntryInput, tenantId?: string): Promise<PageRegistryEntry | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.path !== undefined) { updates.push(`path = $${paramIndex++}`); values.push(input.path); }
    if (input.component !== undefined) { updates.push(`component = $${paramIndex++}`); values.push(input.component); }
    if (input.protected !== undefined) { updates.push(`protected = $${paramIndex++}`); values.push(input.protected); }
    if (input.permission !== undefined) { updates.push(`permission = $${paramIndex++}`); values.push(JSON.stringify(input.permission)); }
    if (input.hideLayout !== undefined) { updates.push(`hide_layout = $${paramIndex++}`); values.push(input.hideLayout); }
    if (input.microApp !== undefined) { updates.push(`micro_app = $${paramIndex++}`); values.push(input.microApp); }
    if (input.subAppKey !== undefined) { updates.push(`sub_app_key = $${paramIndex++}`); values.push(input.subAppKey); }
    if (input.menuKey !== undefined) { updates.push(`menu_key = $${paramIndex++}`); values.push(input.menuKey); }
    if (input.menuLabel !== undefined) { updates.push(`menu_label = $${paramIndex++}`); values.push(input.menuLabel); }
    if (input.menuIcon !== undefined) { updates.push(`menu_icon = $${paramIndex++}`); values.push(input.menuIcon); }
    if (input.hidden !== undefined) { updates.push(`hidden = $${paramIndex++}`); values.push(input.hidden); }
    if (input.redirectTo !== undefined) { updates.push(`redirect_to = $${paramIndex++}`); values.push(input.redirectTo); }
    if (input.title !== undefined) { updates.push(`title = $${paramIndex++}`); values.push(input.title); }
    if (input.breadcrumb !== undefined) { updates.push(`breadcrumb = $${paramIndex++}`); values.push(input.breadcrumb); }
    if (input.sortOrder !== undefined) { updates.push(`sort_order = $${paramIndex++}`); values.push(input.sortOrder); }
    if (input.status !== undefined) { updates.push(`status = $${paramIndex++}`); values.push(input.status); }

    if (updates.length === 0) {
      return this.findByPath(path, tenantId);
    }

    updates.push(`updated_at = NOW()`);

    const whereClause = tenantId
      ? `WHERE path = $${paramIndex} AND tenant_id = $${paramIndex + 1}`
      : `WHERE path = $${paramIndex}`;
    values.push(path);
    if (tenantId) values.push(tenantId);

    const result = await this.db.query(
      `UPDATE page_registry SET ${updates.join(', ')} ${whereClause} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Delete page entry by path
   */
  async delete(path: string, tenantId?: string): Promise<boolean> {
    const whereClause = tenantId
      ? `WHERE path = $1 AND tenant_id = $2`
      : `WHERE path = $1`;
    const params = tenantId ? [path, tenantId] : [path];
    const result = await this.db.query(
      `DELETE FROM page_registry ${whereClause}`,
      params,
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Toggle status
   */
  async toggleStatus(path: string, tenantId?: string): Promise<PageRegistryEntry | null> {
    const current = await this.findByPath(path, tenantId);
    if (!current) return null;

    const newStatus = current.status === 'enabled' ? 'disabled' : 'enabled';
    const whereClause = tenantId
      ? `WHERE path = $1 AND tenant_id = $2`
      : `WHERE path = $1`;
    const params = tenantId ? [path, tenantId] : [path];

    const result = await this.db.query(
      `UPDATE page_registry SET status = $${tenantId ? '3' : '2'}, updated_at = NOW() ${whereClause} RETURNING *`,
      tenantId ? [newStatus, path, tenantId] : [newStatus, path],
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Add history record
   */
  async addHistory(
    pagePath: string,
    action: string,
    oldValue: Record<string, any> | null,
    newValue: Record<string, any> | null,
    changedBy: string | null,
    changeSummary: string | null,
    tenantId?: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO page_registry_history (page_path, action, old_value, new_value, changed_by, change_summary, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        pagePath,
        action,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        changedBy,
        changeSummary,
        tenantId || '00000000-0000-0000-0000-000000000000',
      ],
    );
  }

  /**
   * Get history for a page path
   */
  async getHistory(path: string, tenantId?: string): Promise<PageRegistryHistory[]> {
    const query = tenantId
      ? `SELECT * FROM page_registry_history WHERE page_path = $1 AND tenant_id = $2 ORDER BY created_at DESC`
      : `SELECT * FROM page_registry_history WHERE page_path = $1 ORDER BY created_at DESC`;
    const params = tenantId ? [path, tenantId] : [path];
    const result = await this.db.query(query, params);
    return result.rows.map((row: any) => this.mapHistoryRow(row));
  }

  /**
   * Map database row to entity
   */
  protected mapRowToEntity(row: any): PageRegistryEntry {
    return {
      id: row.id,
      path: row.path,
      component: row.component,
      protected: row.protected ?? true,
      permission: typeof row.permission === 'string' ? JSON.parse(row.permission || '{}') : (row.permission || {}),
      hideLayout: row.hide_layout ?? false,
      microApp: row.micro_app ?? false,
      subAppKey: row.sub_app_key || null,
      menuKey: row.menu_key || null,
      menuLabel: row.menu_label || null,
      menuIcon: row.menu_icon || null,
      hidden: row.hidden ?? false,
      redirectTo: row.redirect_to || null,
      title: row.title || null,
      breadcrumb: row.breadcrumb ?? true,
      sortOrder: row.sort_order || 0,
      status: row.status || 'enabled',
      tenantId: row.tenant_id || '00000000-0000-0000-0000-000000000000',
      createdBy: row.created_by || null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  protected mapHistoryRow(row: any): PageRegistryHistory {
    return {
      id: row.id,
      pagePath: row.page_path,
      action: row.action,
      oldValue: row.old_value ? (typeof row.old_value === 'string' ? JSON.parse(row.old_value) : row.old_value) : null,
      newValue: row.new_value ? (typeof row.new_value === 'string' ? JSON.parse(row.new_value) : row.new_value) : null,
      changedBy: row.changed_by || null,
      changeSummary: row.change_summary || null,
      tenantId: row.tenant_id || '00000000-0000-0000-0000-000000000000',
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}

export default PageRegistryRepository;
