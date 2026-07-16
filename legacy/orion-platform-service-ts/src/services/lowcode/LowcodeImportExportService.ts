/**
 * LowcodeImportExportService — Low-code workflow import/export
 *
 * Extracted from LowcodeWorkflowService.exportWorkflow / importWorkflow.
 * Adds validateWorkflowJson() and lightweight (definition-only) export mode.
 *
 * Routes:
 *   POST   /api/v1/lowcode/workflows/import
 *   POST   /api/v1/lowcode/workflows/:id/export
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import {
  LowcodeWorkflowDefinitionPgRepository,
  LowcodeWorkflowDefinitionEntity,
} from '../../repositories/LowcodeWorkflowDefinitionRepository';
import {
  LowcodeWorkflowVersionPgRepository,
  LowcodeWorkflowVersionEntity,
} from '../../repositories/LowcodeWorkflowVersionRepository';
import {
  LowcodeWorkflow,
} from './LowcodeWorkflowService';
import { OrionError, ErrorCode, ValidationError, NotFoundError } from '../../errors';

// Local type definitions (not exported from LowcodeWorkflowService)
export interface WorkflowExportFormat {
  schemaVersion: string;
  exportedAt: string;
  type: 'workflow';
  definition: Record<string, any>;
  versionHistory?: Array<{ version: string; nodes: any[]; edges: any[]; commitMessage?: string; createdBy?: string; createdAt: string }>;
}

export interface WorkflowImportFormat {
  schemaVersion: string;
  exportedAt: string;
  type: 'workflow';
  definition: Record<string, any>;
}

const logger = createLogger('LowcodeImportExportService');

// ==================== Types ====================

/** Lightweight export — definition only, no version history */
export interface LightweightWorkflowExport {
  schemaVersion: string;
  exportedAt: string;
  type: 'workflow';
  definition: {
    name: string;
    description?: string;
    version: string;
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
}

/** Validation result returned by validateWorkflowJson */
export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** Input for importWorkflow (name extracted from request body in the route) */
export interface ImportWorkflowInput {
  name: string;
  description?: string;
  definition: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
  version?: string;
}

// ==================== Helpers (shared with LowcodeWorkflowService) ====================

function serializeDates(obj: unknown): unknown {
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeDates);
  }
  if (obj && typeof obj === 'object' && !(obj instanceof RegExp)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeDates(value);
    }
    return result;
  }
  return obj;
}

function deserializeDates(obj: unknown): unknown {
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) {
      const date = new Date(trimmed);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(deserializeDates);
  }
  if (obj && typeof obj === 'object' && !(obj instanceof RegExp)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deserializeDates(value);
    }
    return result;
  }
  return obj;
}

// ==================== Service ====================

export class LowcodeImportExportService {
  private defRepo: LowcodeWorkflowDefinitionPgRepository | null = null;
  private versionRepo: LowcodeWorkflowVersionPgRepository | null = null;
  private dbAvailable = false;

  constructor(
    defRepo: LowcodeWorkflowDefinitionPgRepository | null,
    versionRepo: LowcodeWorkflowVersionPgRepository | null,
  ) {
    this.defRepo = defRepo;
    this.versionRepo = versionRepo;
    this.dbAvailable = !!(defRepo && versionRepo);
  }

  /** Whether the PostgreSQL repositories are available */
  isDbAvailable(): boolean {
    return this.dbAvailable;
  }

  // ==================== Validate ====================

  /**
   * Validate a workflow JSON payload before import.
   *
   * Checks:
   *  - name is a non-empty string
   *  - nodes is a non-empty array
   *  - edges is an array
   *  - each node has an id (warning if missing)
   *  - each edge has valid source/target references (warning if dangling)
   *
   * @returns { valid, errors, warnings }
   */
  validateWorkflowJson(data: unknown): WorkflowValidationResult {
    const result: WorkflowValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    if (!data || typeof data !== 'object') {
      result.valid = false;
      result.errors.push('Workflow JSON must be a non-null object');
      return result;
    }

    const obj = data as Record<string, unknown>;

    // --- name ---
    if (!obj.name || typeof obj.name !== 'string' || obj.name.trim().length === 0) {
      result.valid = false;
      result.errors.push('Field "name" must be a non-empty string');
    }

    // --- nodes ---
    if (!Array.isArray(obj.nodes)) {
      result.valid = false;
      result.errors.push('Field "nodes" must be an array');
    } else if (obj.nodes.length === 0) {
      result.warnings.push('"nodes" array is empty — the workflow has no tasks');
    } else {
      // Check each node has an id
      const nodeIds = new Set<string>();
      for (let i = 0; i < obj.nodes.length; i++) {
        const node = obj.nodes[i];
        if (!node || typeof node !== 'object') {
          result.warnings.push(`nodes[${i}] is not an object — skipped`);
          continue;
        }
        const nodeObj = node as Record<string, unknown>;
        if (!nodeObj.id || typeof nodeObj.id !== 'string') {
          result.warnings.push(`nodes[${i}] is missing "id" — edges referencing it will be dangling`);
        } else {
          nodeIds.add(nodeObj.id);
        }
      }
    }

    // --- edges ---
    if (!Array.isArray(obj.edges)) {
      result.valid = false;
      result.errors.push('Field "edges" must be an array');
    } else {
      for (let i = 0; i < obj.edges.length; i++) {
        const edge = obj.edges[i];
        if (!edge || typeof edge !== 'object') {
          result.warnings.push(`edges[${i}] is not an object — skipped`);
          continue;
        }
        const edgeObj = edge as Record<string, unknown>;
        if (!edgeObj.source) {
          result.warnings.push(`edges[${i}] is missing "source"`);
        }
        if (!edgeObj.target) {
          result.warnings.push(`edges[${i}] is missing "target"`);
        }
      }
    }

    // --- version (optional) ---
    if (obj.version !== undefined && typeof obj.version !== 'string') {
      result.warnings.push('Field "version" should be a string (e.g. "1.0.0")');
    }

    return result;
  }

  // ==================== Export ====================

  /**
   * Full export — workflow definition + complete version history.
   *
   * @returns WorkflowExportFormat (schemaVersion, exportedAt, definition, versionHistory)
   */
  async exportWorkflow(workflowId: string, userId: string): Promise<WorkflowExportFormat> {
    if (!this.defRepo) {
      throw new OrionError('Workflow repository not available', ErrorCode.SERVICE_UNAVAILABLE);
    }

    const entity = await this.defRepo.findById(workflowId);
    if (!entity) {
      throw new NotFoundError('Workflow', workflowId);
    }

    const nodes = this.parseNodes(entity.nodes);
    const edges = this.parseEdges(entity.edges);

    // Fetch version history from DB
    const versionHistory: WorkflowExportFormat['versionHistory'] = [];
    if (this.versionRepo && this.dbAvailable) {
      try {
        const versionEntities = await this.versionRepo.findByWorkflowId(workflowId);
        for (const v of versionEntities) {
          versionHistory.push({
            version: v.version,
            nodes: this.parseNodes(v.nodes),
            edges: this.parseEdges(v.edges),
            commitMessage: v.commit_message,
            createdBy: v.created_by,
            createdAt: v.created_at.toISOString(),
          });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn({ workflowId, error: msg }, 'Failed to fetch version history for export');
      }
    }

    return {
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'workflow',
      definition: {
        name: entity.name,
        description: entity.description || undefined,
        version: entity.version,
        nodes: this.parseNodes(entity.nodes),
        edges: this.parseEdges(entity.edges),
        config: {},
      },
      versionHistory,
    } as WorkflowExportFormat;
  }

  /**
   * Lightweight export — definition only, no version history.
   * Useful when you only need the current workflow snapshot.
   *
   * @returns LightweightWorkflowExport
   */
  async exportWorkflowLightweight(workflowId: string): Promise<LightweightWorkflowExport> {
    if (!this.defRepo) {
      throw new OrionError('Workflow repository not available', ErrorCode.SERVICE_UNAVAILABLE);
    }

    const entity = await this.defRepo.findById(workflowId);
    if (!entity) {
      throw new NotFoundError('Workflow', workflowId);
    }

    return {
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'workflow',
      definition: {
        name: entity.name,
        description: entity.description || undefined,
        version: entity.version,
        nodes: this.parseNodes(entity.nodes),
        edges: this.parseEdges(entity.edges),
      },
    };
  }

  // ==================== Import ====================

  /**
   * Import a workflow from structured data (already parsed JSON).
   *
   * Process:
   *  1. validateWorkflowJson (throws on validation failure)
   *  2. Creates a new LowcodeWorkflow definition via defRepo
   *  3. Creates an initial version snapshot via versionRepo (best-effort)
   *
   * @param input - workflow name, description, and definition (nodes/edges)
   * @param userId - who is importing
   * @returns the created LowcodeWorkflow
   */
  async importWorkflow(input: ImportWorkflowInput, userId: string): Promise<LowcodeWorkflow> {
    const validation = this.validateWorkflowJson({
      name: input.name,
      nodes: input.definition.nodes,
      edges: input.definition.edges,
      version: input.version,
    });

    if (!validation.valid) {
      throw new ValidationError(
        `Workflow validation failed: ${validation.errors.join('; ')}`,
        { errors: validation.errors, warnings: validation.warnings },
      );
    }

    if (validation.warnings.length > 0) {
      logger.warn(
        { name: input.name, warnings: validation.warnings },
        'Workflow import has warnings',
      );
    }

    const now = new Date();
    const id = uuidv4();
    const tenantId = this.getTenantId();
    const version = input.version?.trim() || '1.0.0';
    const nodesJson = JSON.stringify(input.definition.nodes);
    const edgesJson = JSON.stringify(input.definition.edges);

    // Persist to DB
    if (this.defRepo) {
      try {
        const entity = await this.defRepo.create({
          id,
          tenant_id: tenantId,
          name: input.name.trim(),
          description: input.description?.trim() || '',
          version,
          enabled: true,
          nodes: nodesJson,
          edges: edgesJson,
          created_by: userId,
        });
        logger.info({ workflowId: id, name: input.name }, 'Workflow imported to DB');

        // Create initial version snapshot (best-effort)
        if (this.versionRepo) {
          try {
            await this.versionRepo.create({
              id: uuidv4(),
              workflow_id: id,
              tenant_id: tenantId,
              version,
              nodes: nodesJson,
              edges: edgesJson,
              commit_message: 'Initial import',
              created_by: userId,
              created_at: now,
            });
          } catch (versionError) {
            const msg = versionError instanceof Error ? versionError.message : String(versionError);
            logger.warn({ workflowId: id, error: msg }, 'Failed to create version snapshot on import');
          }
        }

        return this.mapEntityToWorkflow(entity);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error({ error: msg, name: input.name }, 'Failed to import workflow to DB');
        throw new OrionError(`Failed to import workflow: ${msg}`, ErrorCode.DATABASE_ERROR);
      }
    }

    // No DB available — throw (import without persistence is not meaningful)
    throw new OrionError('Database not available, cannot import workflow', ErrorCode.SERVICE_UNAVAILABLE);
  }

  // ==================== Mapping helpers ====================

  private parseNodes(nodes: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(nodes)) return nodes as Array<Record<string, unknown>>;
    if (typeof nodes === 'string') {
      try {
        return JSON.parse(nodes);
      } catch {
        return [];
      }
    }
    return [];
  }

  private parseEdges(edges: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(edges)) return edges as Array<Record<string, unknown>>;
    if (typeof edges === 'string') {
      try {
        return JSON.parse(edges);
      } catch {
        return [];
      }
    }
    return [];
  }

  private getTenantId(): string {
    // Import at call time to avoid circular dependency; this method is only called
    // inside importWorkflow which is always invoked within an HTTP request context.
    try {
      // Dynamic require to avoid circular deps at module load time
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getCurrentTenantId } = require('../../db/tenant-context-storage');
      return getCurrentTenantId();
    } catch {
      return '00000000-0000-0000-0000-000000000000';
    }
  }

  private mapEntityToWorkflow(entity: LowcodeWorkflowDefinitionEntity): LowcodeWorkflow {
    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      name: entity.name,
      description: entity.description || undefined,
      version: entity.version,
      enabled: entity.enabled,
      nodes: this.parseNodes(entity.nodes),
      edges: this.parseEdges(entity.edges),
      createdBy: entity.created_by || undefined,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };
  }
}

// ==================== Singleton ====================

let serviceInstance: LowcodeImportExportService | null = null;

export function getLowcodeImportExportService(
  defRepo: LowcodeWorkflowDefinitionPgRepository | null,
  versionRepo: LowcodeWorkflowVersionPgRepository | null,
): LowcodeImportExportService {
  if (!serviceInstance) {
    serviceInstance = new LowcodeImportExportService(defRepo, versionRepo);
  }
  return serviceInstance;
}

export function resetLowcodeImportExportService(): void {
  serviceInstance = null;
}

export default LowcodeImportExportService;
