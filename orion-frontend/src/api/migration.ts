import api from './client';
import { API_PATHS } from '@/constants/api-paths';

export type MigrationType = 'schema' | 'data' | 'hybrid';
export type MigrationDirection = 'forward' | 'rollback';
export type MigrationPhase =
  | 'preflight'
  | 'executing'
  | 'validating'
  | 'completed'
  | 'failed'
  | 'rolled_back';

export interface MigrationEndpoint {
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
  schema?: string;
}

export interface MigrationPlan {
  id: string;
  tenant_id: string;
  name: string;
  type: MigrationType;
  source: MigrationEndpoint;
  target: MigrationEndpoint;
  direction: MigrationDirection;
  sql_statements?: string[];
  data_filter?: string;
  batch_size?: number;
  created_at: string;
  updated_at: string;
}

export interface MigrationStep {
  id: string;
  plan_id: string;
  phase: MigrationPhase;
  status: string;
  sql?: string;
  rows?: number;
  error_message?: string;
  started_at?: string;
  finished_at?: string;
}

export interface MigrationResult {
  plan_id: string;
  phase: MigrationPhase;
  status: string;
  steps: number;
  steps_ok: number;
  steps_err: number;
  rows_moved: number;
  duration: number;
  error?: string;
}

export interface MigrationStats {
  total_plans: number;
  active_plans: number;
  completed: number;
  failed: number;
  rows_migrated: number;
}

export interface SchemaObject {
  name: string;
  type: string;
  ddl?: string;
  change: string;
}

export interface SchemaDiff {
  source: string;
  target: string;
  additions?: SchemaObject[];
  removals?: SchemaObject[];
  modifications?: SchemaObject[];
  checked_at: string;
}

export interface CreatePlanInput {
  name: string;
  type: MigrationType;
  source: MigrationEndpoint;
  target: MigrationEndpoint;
  direction?: MigrationDirection;
  sql_statements?: string[];
  data_filter?: string;
  batch_size?: number;
}

export interface UpdatePlanInput {
  name?: string;
  type?: MigrationType;
  direction?: MigrationDirection;
  sql_statements?: string[];
  batch_size?: number;
}

export async function listPlans(params?: { offset?: number; limit?: number }) {
  return api.get<MigrationPlan[]>(API_PATHS.MIGRATION.PLANS, { params });
}

export async function getPlan(id: string) {
  return api.get<MigrationPlan>(API_PATHS.MIGRATION.PLAN_DETAIL(id));
}

export async function createPlan(input: CreatePlanInput) {
  return api.post<MigrationPlan>(API_PATHS.MIGRATION.PLANS, input);
}

export async function updatePlan(id: string, input: UpdatePlanInput) {
  return api.put<MigrationPlan>(API_PATHS.MIGRATION.PLAN_DETAIL(id), input);
}

export async function deletePlan(id: string) {
  return api.delete<void>(API_PATHS.MIGRATION.PLAN_DETAIL(id));
}

export async function executeMigration(planId: string) {
  return api.post<MigrationResult>(API_PATHS.MIGRATION.PLAN_EXECUTE(planId));
}

export async function validateMigration(planId: string) {
  return api.post<MigrationResult>(API_PATHS.MIGRATION.PLAN_VALIDATE(planId));
}

export async function rollbackMigration(planId: string) {
  return api.post<MigrationResult>(API_PATHS.MIGRATION.PLAN_ROLLBACK(planId));
}

export async function getSchemaDiff(planId: string) {
  return api.get<SchemaDiff>(API_PATHS.MIGRATION.PLAN_DIFF(planId));
}

export async function getSteps(planId: string) {
  return api.get<MigrationStep[]>(API_PATHS.MIGRATION.PLAN_STEPS(planId));
}

export async function getMigrationStats() {
  return api.get<MigrationStats>(API_PATHS.MIGRATION.STATS);
}
