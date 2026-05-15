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
} from './MultiCloudAdvancedService';

export {
  MultiCloudManagerService,
  AddCloudAccountInput,
  CloudAccountConfig,
  CloudStats,
} from './MultiCloudManagerService';

export {
  CloudProviderService,
  CloudAccountInput,
  CloudAccount,
  CloudResource,
  CloudProviderInfo,
} from './CloudProviderService';

export {
  ResourceAbstractionLayer,
  ProviderResource,
  UnifiedResource,
  DeploymentConfig,
  DeploymentResult,
} from './ResourceAbstractionLayer';
