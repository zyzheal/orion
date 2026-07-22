/**
 * ApiGovernanceController - DEPRECATED
 *
 * Routes in api-governance-routes.ts directly use ApiGovernanceRepository (PostgreSQL).
 * This controller has no active methods.
 */

import { BaseController } from './BaseController';

export class ApiGovernanceController extends BaseController {
  // DEPRECATED: Maps removed - routes use ApiGovernanceRepository directly
  // private contracts = new Map<string, ApiContract>();
  // private violations = new Map<string, ApiViolation[]>();
  // private versions = new Map<string, ApiVersion>();
  // private rules = new Map<string, GovernanceRule>();
  // private verificationHistory = new Map<...>();
}
