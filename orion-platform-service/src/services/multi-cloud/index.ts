/**
 * Multi Cloud Manager Services
 *
 * Phase 3 - Multi-Provider Deployment
 */

export {
  MultiCloudAdvancedService,
  CrossZoneDR,
  DRConfig,
  DRTestResult,
  CloudCostBreakdown,
  MultiCloudCostResult,
  CostOptimizationSuggestion,
  CloudNetwork,
  CloudNetworkConfig,
  ComplianceRule,
  ComplianceCheckResult,
  ComplianceReport,
  SchedulingPolicy,
  SchedulingDecision,
  ResourceScheduleRequest,
} from './MultiCloudAdvancedService';

export {
  MultiCloudManagerService,
  AddCloudAccountInput,
  CloudAccountConfig,
  CloudStats,
  ResourceSyncJob,
  MigrationPlan,
  MigrationResult,
} from './MultiCloudManagerService';

export {
  CloudProviderService,
  CloudAccountInput,
  CloudAccount,
  CloudResource,
  CloudProviderInfo,
  CredentialValidationResult,
  ProviderHealthStatus,
  CloudCostSummary,
} from './CloudProviderService';

export {
  ResourceAbstractionLayer,
  ProviderResource,
  UnifiedResource,
  DeploymentConfig,
  DeploymentResult,
} from './ResourceAbstractionLayer';
