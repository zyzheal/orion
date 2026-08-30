/**
 * Schema Registry API Service
 * Schema registration, evolution, versioning, and compatibility checks.
 */
import { api } from './client';
import { API_PATHS } from '@/constants/api-paths';

// ---- Types ----

export type SchemaType =
  | 'protobuf'
  | 'avro'
  | 'json'
  | 'postgresql'
  | 'mongodb'
  | 'kafka-avro'
  | 'event-bridge';

export type CompatibilityMode = 'none' | 'backward' | 'forward' | 'full';

export type SchemaStatus = 'draft' | 'active' | 'deprecated' | 'archived';

export interface SchemaField {
  name: string;
  type: string;
  nullable: boolean;
  default?: unknown;
  length?: number;
  scale?: number;
  precision?: number;
  primaryKey: boolean;
  unique: boolean;
  index: boolean;
  description?: string;
  constraints?: Record<string, unknown>;
  enumValues?: string[];
}

export interface SchemaRelationship {
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  sourceField: string;
  targetField: string;
  target: string;
  onDelete: 'cascade' | 'set-null' | 'restrict';
  onUpdate: string;
}

export interface IndexDefinition {
  name: string;
  fields: string[];
  unique: boolean;
  partial?: string;
}

export interface Schema {
  id: string;
  tenantId?: string;
  name: string;
  namespace: string;
  type: SchemaType;
  version: number;
  status: SchemaStatus;
  owner: string;
  description?: string;
  fields: SchemaField[];
  relationships?: SchemaRelationship[];
  indexes?: IndexDefinition[];
  compatibility: CompatibilityMode;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type EvolutionChangeType =
  | 'add_field'
  | 'remove_field'
  | 'alter_field'
  | 'rename_field'
  | 'add_index'
  | 'remove_index';

export type EvolutionBreakingLevel = 'none' | 'minor' | 'major' | 'critical';

export interface EvolutionChange {
  type: EvolutionChangeType;
  field: string;
  severity: EvolutionBreakingLevel;
  detail: string;
  fixable: boolean;
}

export interface EvolutionResult {
  compatible: boolean;
  breaking: boolean;
  worstLevel: EvolutionBreakingLevel;
  changes: EvolutionChange[];
  targetMode: CompatibilityMode;
  recommendedAction?: string;
}

// ---- Request / Response types ----

export interface RegisterRequest {
  name: string;
  namespace: string;
  type: SchemaType;
  owner: string;
  description?: string;
  fields: SchemaField[];
  relationships?: SchemaRelationship[];
  indexes?: IndexDefinition[];
  compatibility: CompatibilityMode;
  metadata?: Record<string, unknown>;
}

export interface RegisterResponse {
  schema: Schema;
  version: number;
}

export interface QueryRequest {
  namespace?: string;
  type?: SchemaType;
  status?: SchemaStatus;
  owner?: string;
}

export interface QueryResponse {
  schemas: Schema[];
  total: number;
}

export interface CompatibilityResponse {
  result: EvolutionResult;
  breaking: boolean;
  compatible: boolean;
}

export interface SchemaVersion {
  schemaJSON: unknown;
  version: number;
  changes?: EvolutionChange[];
  releasedAt: string;
  releasedBy: string;
}

export interface VersionHistoryResponse {
  schema: string;
  versions: SchemaVersion[];
}

export interface EvolveRequest {
  fields: SchemaField[];
}

export interface CompatibilityInfo {
  compatibility: CompatibilityMode;
}

// ---- API Functions ----

export function registerSchema(data: RegisterRequest) {
  return api.post<RegisterResponse>(API_PATHS.SCHEMA_REGISTRY.SCHEMAS, data);
}

export function listSchemas(params?: QueryRequest) {
  return api.get<QueryResponse>(API_PATHS.SCHEMA_REGISTRY.SCHEMAS, { params });
}

export function lookupSchema(namespace: string, name: string) {
  return api.get<Schema>(API_PATHS.SCHEMA_REGISTRY.SCHEMA_DETAIL(namespace, name));
}

export function updateSchema(namespace: string, name: string, data: RegisterRequest) {
  return api.put<RegisterResponse>(
    API_PATHS.SCHEMA_REGISTRY.SCHEMA_DETAIL(namespace, name),
    data
  );
}

export function deleteSchema(namespace: string, name: string) {
  return api.delete(API_PATHS.SCHEMA_REGISTRY.SCHEMA_DETAIL(namespace, name));
}

export function evolveSchema(namespace: string, name: string, data: EvolveRequest) {
  return api.post<CompatibilityResponse>(
    API_PATHS.SCHEMA_REGISTRY.EVOLVE(namespace, name),
    data
  );
}

export function getVersionHistory(namespace: string, name: string, limit?: number) {
  return api.get<VersionHistoryResponse>(
    API_PATHS.SCHEMA_REGISTRY.VERSIONS(namespace, name),
    { params: limit ? { limit } : undefined }
  );
}

export function getVersion(namespace: string, name: string, version: number) {
  return api.get<SchemaVersion>(
    API_PATHS.SCHEMA_REGISTRY.VERSION_DETAIL(namespace, name, version)
  );
}

export function getCompatibility(namespace: string, name: string) {
  return api.get<CompatibilityInfo>(
    API_PATHS.SCHEMA_REGISTRY.COMPATIBILITY(namespace, name)
  );
}
