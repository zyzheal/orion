/**
 * CMDB 事件发布器
 *
 * 发布 CMDB 相关事件到 NATS 事件总线
 * 遵循 CloudEvents 1.0 规范
 */

import { EventBusService } from '../event-bus-service';
import { DatabasePool } from '../database';
import { CI, CIRelation } from './CmdbTypes';

export class CmdbEventPublisher {
  private eventBus: EventBusService;
  private readonly source = 'orion-cmdb-service';

  constructor(eventBus: EventBusService) {
    this.eventBus = eventBus;
  }

  /**
   * 发布配置项创建事件
   */
  async publishCICreated(ci: CI): Promise<void> {
    await this.eventBus.publish('cmdb.ci.created', {
      ciId: ci.ciId,
      id: ci.id,
      ciType: ci.ciType,
      name: ci.name,
      status: ci.status,
      environment: ci.environment,
      tenantId: ci.tenantId.toString(),
    });
  }

  /**
   * 发布配置项更新事件
   */
  async publishCIUpdated(ci: CI, changes: string[]): Promise<void> {
    await this.eventBus.publish('cmdb.ci.updated', {
      ciId: ci.ciId,
      id: ci.id,
      ciType: ci.ciType,
      name: ci.name,
      status: ci.status,
      changes,
      tenantId: ci.tenantId.toString(),
    });
  }

  /**
   * 发布配置项删除事件
   */
  async publishCIDeleted(ci: CI): Promise<void> {
    await this.eventBus.publish('cmdb.ci.deleted', {
      ciId: ci.ciId,
      id: ci.id,
      ciType: ci.ciType,
      name: ci.name,
      tenantId: ci.tenantId.toString(),
    });
  }

  /**
   * 发布关联关系创建事件
   */
  async publishRelationCreated(relation: CIRelation): Promise<void> {
    await this.eventBus.publish('cmdb.relation.created', {
      id: relation.id,
      fromCiId: relation.fromCiId,
      toCiId: relation.toCiId,
      relationType: relation.relationType,
    });
  }

  /**
   * 发布关联关系删除事件
   */
  async publishRelationDeleted(relation: CIRelation): Promise<void> {
    await this.eventBus.publish('cmdb.relation.deleted', {
      id: relation.id,
      fromCiId: relation.fromCiId,
      toCiId: relation.toCiId,
      relationType: relation.relationType,
    });
  }

  /**
   * 发布配置项版本创建事件
   */
  async publishCIVersionCreated(ciId: string, version: number, changes: string): Promise<void> {
    await this.eventBus.publish('cmdb.ci.versioned', {
      ciId,
      version,
      changes,
    });
  }
}
