/**
 * Maintenance Window Service - 维护窗口服务
 *
 * 负责管理系统的维护窗口期，用于在特定时间段内执行维护任务
 */

import { MaintenanceWindowRepository, MaintenanceWindowEntity } from '../repositories/MaintenanceWindowRepository';
import { v4 as uuidv4 } from 'uuid';
import { OrionError, ErrorCode } from '../../errors';

export interface MaintenanceWindow {
  id: string;
  name: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  description?: string;
  affectedServices: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class MaintenanceWindowService {
  constructor(private repository: MaintenanceWindowRepository) {}

  /**
   * 创建维护窗口
   */
  async createWindow(input: {
    name: string;
    startTime: Date;
    endTime: Date;
    timezone?: string;
    description?: string;
    affectedServices?: string[];
    tenantId?: string;
    createdBy?: string;
  }): Promise<MaintenanceWindow> {
    // Validate inputs
    if (!input.name || input.name.trim().length === 0) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Window name is required');
    }
    if (!input.startTime) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Start time is required');
    }
    if (!input.endTime) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'End time is required');
    }
    if (input.endTime <= input.startTime) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'End time must be after start time');
    }

    const entity = {
      id: uuidv4(),
      tenantId: input.tenantId ?? 'system',
      name: input.name.trim(),
      startTime: input.startTime,
      endTime: input.endTime,
      timezone: input.timezone ?? 'UTC',
      description: input.description ?? null,
      affectedServices: input.affectedServices ?? [],
      createdBy: input.createdBy ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await this.repository.create(entity as any);
    return this.toDto(created);
  }

  /**
   * 获取租户的所有维护窗口
   */
  async getWindowsByTenant(tenantId: string): Promise<MaintenanceWindow[]> {
    if (!tenantId) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Tenant ID is required');
    }
    const windows = await this.repository.findByTenantId(tenantId);
    return windows.map(w => this.toDto(w));
  }

  /**
   * 获取当前活跃的维护窗口
   */
  async getActiveWindows(): Promise<MaintenanceWindow[]> {
    const windows = await this.repository.findActive(new Date());
    return windows.map(w => this.toDto(w));
  }

  /**
   * 获取即将到来的维护窗口
   */
  async getUpcomingWindows(limit?: number): Promise<MaintenanceWindow[]> {
    const windows = await this.repository.findUpcoming(new Date(), limit);
    return windows.map(w => this.toDto(w));
  }

  /**
   * 删除维护窗口
   */
  async deleteWindow(id: string): Promise<boolean> {
    if (!id) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Window ID is required');
    }
    return this.repository.delete(id);
  }

  /**
   * 检查服务是否在维护窗口内
   */
  async isServiceInMaintenanceWindow(serviceName: string): Promise<boolean> {
    if (!serviceName || serviceName.trim().length === 0) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Service name is required');
    }
    const activeWindows = await this.repository.findActive(new Date());
    return activeWindows.some(w => w.affectedServices.includes(serviceName));
  }

  /**
   * Convert entity to DTO (strips tenantId, createdBy, etc.)
   */
  private toDto(entity: MaintenanceWindowEntity): MaintenanceWindow {
    return {
      id: entity.id,
      name: entity.name,
      startTime: entity.startTime,
      endTime: entity.endTime,
      timezone: entity.timezone,
      description: entity.description ?? undefined,
      affectedServices: entity.affectedServices,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

export default MaintenanceWindowService;
