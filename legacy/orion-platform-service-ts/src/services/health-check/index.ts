/**
 * Health Check Service - Barrel export
 *
 * Provides:
 * - HealthCheckerService: Run checks, store results, trigger alerts
 * - ServiceHealthCheckRepository: DB access for check configurations
 * - ServiceHealthResultRepository: DB access for check results
 * - Health check result types and configuration interfaces
 */

export {
  HealthCheckerService,
} from './HealthCheckerService';

export type {
  CheckResult,
  CheckStatus,
  HealthCheckConfig,
  AlertPayload,
  AlertCallback,
} from './HealthCheckerService';

export {
  ServiceHealthCheckRepository,
  ServiceHealthResultRepository,
} from '../../repositories/ServiceHealthRepository';

export type {
  ServiceHealthCheckEntity,
  ServiceHealthResultEntity,
} from '../../repositories/ServiceHealthRepository';
