export interface ApiContract {
  id: string;
  name: string;
  description: string;
  apiName: string;
  version: string;
  status: ContractStatus;
  schema: Record<string, unknown>;
  endpoint: string;
  method: HttpMethod;
  authentication: AuthType;
  rateLimit?: number;
  tags: string[];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  deprecatedAt?: string;
}

export type ContractStatus = 'draft' | 'active' | 'deprecated' | 'retired';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
export type AuthType = 'none' | 'api_key' | 'oauth2' | 'jwt' | 'mtls';

export interface ApiVersion {
  id: string;
  contractId: string;
  version: string;
  changelog: string;
  status: VersionStatus;
  breakingChanges: boolean;
  migrationGuide?: string;
  createdAt: string;
  updatedAt: string;
}

export type VersionStatus = 'planned' | 'released' | 'current' | 'deprecated' | 'retired';

export interface Deprecation {
  id: string;
  contractId: string;
  version: string;
  reason: string;
  replacementVersion?: string;
  sunsetDate: string;
  notificationSent: boolean;
  status: DeprecationStatus;
  createdAt: string;
  updatedAt: string;
}

export type DeprecationStatus = 'pending' | 'notified' | 'sunset' | 'completed';

export interface CompatibilityResult {
  compatible: boolean;
  breakingChanges: BreakingChange[];
  warnings: string[];
  recommendation: string;
}

export interface BreakingChange {
  field: string;
  type: BreakingChangeType;
  description: string;
  severity: 'critical' | 'major' | 'minor';
}

export type BreakingChangeType =
  | 'removed_field'
  | 'removed_endpoint'
  | 'changed_type'
  | 'added_required_field'
  | 'changed_authentication'
  | 'changed_rate_limit'
  | 'removed_parameter'
  | 'changed_parameter_type';

export interface ContractValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export interface CreateContractInput {
  name: string;
  description: string;
  apiName: string;
  version: string;
  schema: Record<string, unknown>;
  endpoint: string;
  method: HttpMethod;
  authentication: AuthType;
  rateLimit?: number;
  tags: string[];
  ownerId: string;
}

export interface UpdateContractInput {
  name?: string;
  description?: string;
  schema?: Record<string, unknown>;
  endpoint?: string;
  method?: HttpMethod;
  authentication?: AuthType;
  rateLimit?: number;
  tags?: string[];
  ownerId?: string;
}

export interface CreateVersionInput {
  contractId: string;
  version: string;
  changelog: string;
  breakingChanges: boolean;
  migrationGuide?: string;
}

export interface CreateDeprecationInput {
  contractId: string;
  version: string;
  reason: string;
  replacementVersion?: string;
  sunsetDate: string;
}

export interface CompatibilityCheckInput {
  sourceContractId: string;
  targetContractId: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
