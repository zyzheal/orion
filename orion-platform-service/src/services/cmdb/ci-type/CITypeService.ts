/**
 * CITypeService — CI Type Designer service layer
 *
 * Combines CITypeRepository, CIAttributeRepository, and CITypeVersionRepository
 * to provide full CRUD, schema validation, versioning, and rollback capabilities.
 */

import pino from 'pino';
import { getCurrentTenantId } from '../../../db/tenant-context-storage';
import { OrionError } from '../../../errors';
import { CITypeRepository, CITypeEntity, CITypeFilters } from './CITypeRepository';
import {
  CIAttributeRepository,
  CIAttributeEntity,
  CreateAttributeInput,
} from './CIAttributeRepository';
import {
  CITypeVersionRepository,
  CITypeVersionEntity,
} from './CITypeVersionRepository';

const logger = pino({ name: 'CITypeService' });

export interface CreateTypeInput {
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  parentTypeId?: string;
  k8sType?: string;
  isSystem?: boolean;
  status?: string;
  sortOrder?: number;
  metadata?: Record<string, any>;
  createdBy?: string;
}

export interface UpdateTypeInput {
  displayName?: string;
  description?: string;
  icon?: string;
  parentTypeId?: string;
  k8sType?: string;
  isSystem?: boolean;
  status?: string;
  sortOrder?: number;
  metadata?: Record<string, any>;
}

export interface CISchemaDefinition {
  type: CITypeEntity;
  attributes: CIAttributeEntity[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class CITypeService {
  constructor(
    private readonly typeRepo: CITypeRepository,
    private readonly attributeRepo: CIAttributeRepository,
    private readonly versionRepo: CITypeVersionRepository,
  ) {}

  // ==================== Type CRUD ====================

  /**
   * List CI types with optional filters.
   */
  async listTypes(filters: CITypeFilters = {}): Promise<{ data: CITypeEntity[]; total: number }> {
    const result = await this.typeRepo.listTypes(filters);
    return { data: result.entities, total: result.total };
  }

  /**
   * Get a single CI type by ID.
   */
  async getType(id: string): Promise<CITypeEntity> {
    const type = await this.typeRepo.getTypeById(id);
    if (!type) {
      throw new OrionError(`CI type not found: ${id}`, 'NOT_FOUND');
    }
    return type;
  }

  /**
   * Get a single CI type by name. Returns undefined if not found.
   */
  async getTypeByName(name: string): Promise<CITypeEntity | undefined> {
    return this.typeRepo.getByName(name);
  }

  /**
   * Create a new CI type.
   */
  async createType(input: CreateTypeInput): Promise<CITypeEntity> {
    const tenantId = getCurrentTenantId();

    // Check name uniqueness within tenant
    const existing = await this.typeRepo.getByName(input.name);
    if (existing) {
      throw new OrionError(`CI type with name '${input.name}' already exists`, 'BIZ.RESOURCE.CONFLICT');
    }

    const type = await this.typeRepo.create({
      tenantId,
      name: input.name,
      displayName: input.displayName,
      description: input.description ?? null,
      icon: input.icon ?? null,
      parentTypeId: input.parentTypeId ?? null,
      k8sType: input.k8sType ?? null,
      isSystem: input.isSystem ?? false,
      status: input.status ?? 'active',
      sortOrder: input.sortOrder ?? 0,
      metadata: JSON.stringify(input.metadata ?? {}),
      createdBy: input.createdBy ?? null,
      deletedAt: null,
    });

    logger.info({ typeId: type.id, name: input.name }, 'CI type created');
    return type;
  }

  /**
   * Update an existing CI type.
   */
  async updateType(id: string, input: UpdateTypeInput): Promise<CITypeEntity> {
    const existing = await this.typeRepo.getTypeById(id);
    if (!existing) {
      throw new OrionError(`CI type not found: ${id}`, 'NOT_FOUND');
    }

    const updateData: Record<string, any> = {};
    if (input.displayName !== undefined) updateData.displayName = input.displayName;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.icon !== undefined) updateData.icon = input.icon;
    if (input.parentTypeId !== undefined) updateData.parentTypeId = input.parentTypeId;
    if (input.k8sType !== undefined) updateData.k8sType = input.k8sType;
    if (input.isSystem !== undefined) updateData.isSystem = input.isSystem;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
    if (input.metadata !== undefined) updateData.metadata = JSON.stringify(input.metadata);

    const updated = await this.typeRepo.update(id, updateData);
    logger.info({ typeId: id }, 'CI type updated');
    return updated;
  }

  /**
   * Soft-delete a CI type and cascade soft-delete its attributes.
   * Uses transaction to ensure atomicity.
   */
  async deleteType(id: string): Promise<void> {
    const existing = await this.typeRepo.getTypeById(id);
    if (!existing) {
      throw new OrionError(`CI type not found: ${id}`, 'NOT_FOUND');
    }

    if (existing.isSystem) {
      throw new OrionError('Cannot delete a system CI type', 'BIZ.OPERATION.FAILED');
    }

    const db = this.typeRepo.getDb() as any;
    if (db.transaction) {
      await db.transaction(async (client: any) => {
        await client.query(
          `UPDATE ci_type_attributes SET deleted_at = NOW(), updated_at = NOW() WHERE ci_type_id = $1 AND deleted_at IS NULL`,
          [id],
        );
        await client.query(
          `UPDATE ci_types SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
          [id],
        );
      });
    } else {
      await this.attributeRepo.softDeleteByType(id);
      await this.typeRepo.softDelete(id);
    }
    logger.info({ typeId: id }, 'CI type deleted');
  }

  // ==================== Attribute Management ====================

  /**
   * Get all attributes for a CI type.
   */
  async getAttributes(typeId: string): Promise<CIAttributeEntity[]> {
    // Verify type exists
    await this.getType(typeId);
    return this.attributeRepo.listByType(typeId);
  }

  /**
   * Bulk set attributes for a CI type (replaces non-system attributes).
   */
  async setAttributes(typeId: string, attributes: CreateAttributeInput[]): Promise<CIAttributeEntity[]> {
    // Verify type exists
    await this.getType(typeId);

    const result = await this.attributeRepo.upsertBulk(
      typeId,
      attributes.map((attr) => ({ ...attr, ciTypeId: typeId })),
    );

    logger.info({ typeId, count: result.length }, 'CI type attributes set');
    return result;
  }

  // ==================== Schema Validation ====================

  /**
   * Validate instance data against a CI type's attribute schema.
   */
  async validateInstance(typeId: string, instanceData: Record<string, any>): Promise<ValidationResult> {
    const attributes = await this.attributeRepo.listByType(typeId);
    const errors: string[] = [];

    for (const attr of attributes) {
      const value = instanceData[attr.name];

      // Check required fields
      if (attr.required && (value === undefined || value === null || value === '')) {
        errors.push(`Required attribute '${attr.displayName}' (${attr.name}) is missing`);
        continue;
      }

      // Skip validation if value is not provided and field is optional
      if (value === undefined || value === null) continue;

      // Type validation
      switch (attr.dataType) {
        case 'integer':
          if (!Number.isInteger(Number(value))) {
            errors.push(`Attribute '${attr.displayName}' must be an integer`);
          }
          break;
        case 'float':
        case 'number':
          if (isNaN(Number(value))) {
            errors.push(`Attribute '${attr.displayName}' must be a number`);
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
            errors.push(`Attribute '${attr.displayName}' must be a boolean`);
          }
          break;
        case 'json':
          if (typeof value === 'string') {
            try {
              JSON.parse(value);
            } catch {
              errors.push(`Attribute '${attr.displayName}' must be valid JSON`);
            }
          }
          break;
        case 'date':
        case 'datetime':
          if (isNaN(Date.parse(value))) {
            errors.push(`Attribute '${attr.displayName}' must be a valid date`);
          }
          break;
        // string type needs no special validation
      }

      // Enum/options validation
      if (attr.options && Array.isArray(attr.options) && attr.options.length > 0) {
        const validValues = attr.options.map((opt: any) => (typeof opt === 'object' ? opt.value : opt));
        if (!validValues.includes(value)) {
          errors.push(`Attribute '${attr.displayName}' must be one of: ${validValues.join(', ')}`);
        }
      }

      // Custom validation rules
      if (attr.validation) {
        const rules = attr.validation;
        if (rules.minLength !== undefined && typeof value === 'string' && value.length < rules.minLength) {
          errors.push(`Attribute '${attr.displayName}' must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength !== undefined && typeof value === 'string' && value.length > rules.maxLength) {
          errors.push(`Attribute '${attr.displayName}' must be at most ${rules.maxLength} characters`);
        }
        if (rules.pattern !== undefined && typeof value === 'string') {
          try {
            const regex = new RegExp(rules.pattern);
            if (!regex.test(value)) {
              errors.push(`Attribute '${attr.displayName}' does not match the required pattern`);
            }
          } catch {
            // Invalid regex pattern in schema - skip
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ==================== Versioning ====================

  /**
   * Create a version snapshot of the current CI type + attributes.
   */
  async createVersion(typeId: string, changeSummary?: string): Promise<CITypeVersionEntity> {
    const tenantId = getCurrentTenantId();
    const type = await this.getType(typeId);
    const attributes = await this.attributeRepo.listByType(typeId);

    // Determine next version number
    const latest = await this.versionRepo.getLatest(typeId);
    const nextVersion = (latest?.version ?? 0) + 1;

    const version = await this.versionRepo.createVersion({
      ciTypeId: typeId,
      version: nextVersion,
      designerData: {
        name: type.name,
        displayName: type.displayName,
        description: type.description,
        icon: type.icon,
        parentTypeId: type.parentTypeId,
        k8sType: type.k8sType,
        status: type.status,
        metadata: type.metadata,
      },
      attributes: attributes.map((attr) => ({
        name: attr.name,
        displayName: attr.displayName,
        dataType: attr.dataType,
        required: attr.required,
        defaultValue: attr.defaultValue,
        options: attr.options,
        referenceType: attr.referenceType,
        validation: attr.validation,
        description: attr.description,
        sortOrder: attr.sortOrder,
        isSystem: attr.isSystem,
        isSearchable: attr.isSearchable,
        isHidden: attr.isHidden,
      })),
      relations: [],
      changeSummary: changeSummary ?? `Version ${nextVersion}`,
      createdBy: undefined,
    });

    logger.info({ typeId, version: nextVersion }, 'CI type version created');
    return version;
  }

  /**
   * List all versions for a CI type.
   */
  async getVersions(typeId: string): Promise<CITypeVersionEntity[]> {
    // Verify type exists
    await this.getType(typeId);
    return this.versionRepo.listByType(typeId);
  }

  /**
   * Rollback a CI type to a specific version.
   * Restores the designer_data and attributes from the version snapshot.
   */
  async rollback(typeId: string, versionId: string): Promise<CITypeEntity> {
    const version = await this.versionRepo.getVersionById(versionId);
    if (!version) {
      throw new OrionError(`Version not found: ${versionId}`, 'NOT_FOUND');
    }
    if (version.ciTypeId !== typeId) {
      throw new OrionError(`Version ${versionId} does not belong to CI type ${typeId}`, 'BIZ.OPERATION.FAILED');
    }

    const type = await this.getType(typeId);

    // Restore type metadata from version snapshot
    if (version.designerData) {
      await this.typeRepo.update(typeId, {
        displayName: version.designerData.displayName ?? type.displayName,
        description: version.designerData.description ?? type.description,
        icon: version.designerData.icon ?? type.icon,
        parentTypeId: version.designerData.parentTypeId ?? type.parentTypeId,
        k8sType: version.designerData.k8sType ?? type.k8sType,
        status: version.designerData.status ?? type.status,
        metadata: version.designerData.metadata ? JSON.stringify(version.designerData.metadata) : undefined,
      });
    }

    // Restore attributes from version snapshot
    if (version.attributes && Array.isArray(version.attributes)) {
      await this.attributeRepo.softDeleteByType(typeId);
      for (const attr of version.attributes) {
        await this.attributeRepo.createAttribute({
          ciTypeId: typeId,
          name: attr.name,
          displayName: attr.displayName,
          dataType: attr.dataType,
          required: attr.required,
          defaultValue: attr.defaultValue,
          options: attr.options,
          referenceType: attr.referenceType,
          validation: attr.validation,
          description: attr.description,
          sortOrder: attr.sortOrder,
          isSystem: attr.isSystem,
          isSearchable: attr.isSearchable,
          isHidden: attr.isHidden,
        });
      }
    }

    // Create a new version to record the rollback
    const latest = await this.versionRepo.getLatest(typeId);
    const nextVersion = (latest?.version ?? 0) + 1;
    await this.versionRepo.createVersion({
      ciTypeId: typeId,
      version: nextVersion,
      designerData: version.designerData ?? undefined,
      attributes: version.attributes ?? undefined,
      relations: version.relations ?? undefined,
      changeSummary: `Rolled back to version ${version.version}`,
    });

    logger.info({ typeId, rolledBackTo: version.version }, 'CI type rolled back');
    return this.getType(typeId);
  }

  // ==================== Schema Definition ====================

  /**
   * Get a CI type with all attributes as a complete schema definition.
   */
  async getTypeWithSchema(id: string): Promise<CISchemaDefinition> {
    const result = await this.typeRepo.getWithAttributes(id);
    if (!result) {
      throw new OrionError(`CI type not found: ${id}`, 'NOT_FOUND');
    }
    return {
      type: result.type,
      attributes: result.attributes.map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        ciTypeId: row.ci_type_id,
        name: row.name,
        displayName: row.display_name,
        dataType: row.data_type,
        required: row.required,
        defaultValue: row.default_value ?? null,
        options: typeof row.options === 'string' ? JSON.parse(row.options) : (row.options ?? null),
        referenceType: row.reference_type ?? null,
        validation: typeof row.validation === 'string' ? JSON.parse(row.validation) : (row.validation ?? null),
        description: row.description ?? null,
        sortOrder: row.sort_order,
        isSystem: row.is_system,
        isSearchable: row.is_searchable,
        isHidden: row.is_hidden,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
        createdBy: row.created_by ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at ?? null,
      })),
    };
  }
}
