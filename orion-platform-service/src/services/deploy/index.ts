/**
 * Deploy Services - 部署服务模块
 *
 * 导出所有 Deploy 相关服务：
 * - DeployRepository - 数据库访问层 (with PostgreSQL)
 * - DeployService - 业务逻辑层
 * - DeployWindowRepository / DeployWindowService - 部署窗口管理
 * - ProgressiveDeployRepository / ProgressiveDeployService - 渐进式部署
 * - EmergencyDeployRepository / EmergencyDeployService - 紧急部署
 */

export {
  DeployRepository,
  Deployment,
  DeploymentEvent,
  CreateDeploymentInput,
  UpdateDeploymentInput,
  CreateDeploymentEventInput,
} from './DeployRepository';

export {
  DeployService,
  DeployServiceError,
  ListDeploymentsOptions,
  PaginatedResult,
} from './DeployService';

// Deploy Window
export {
  DeployWindowRepository,
  DeployWindow,
  CreateDeployWindowInput,
  UpdateDeployWindowInput,
} from './DeployWindowRepository';

export {
  DeployWindowService,
  DeployWindowServiceError,
  ListDeployWindowsOptions,
  PaginatedResult as DeployWindowPaginatedResult,
} from './DeployWindowService';

// Progressive Deploy (Stage-based)
export {
  ProgressiveDeployRepository,
  ProgressiveStage,
  CreateProgressiveStageInput,
} from './ProgressiveDeployRepository';

export {
  ProgressiveDeployService,
  ProgressiveDeployServiceError,
  ProgressiveStageInput,
  CreateProgressiveDeployInput,
  DeployProgress,
} from './ProgressiveDeployService';

// Progressive Deploy (Traffic-based - simplified version)
export {
  ProgressiveDeploymentService,
  ProgressiveDeploymentServiceError,
  ProgressiveDeployConfig,
  ProgressiveDeployStatus,
  ProgressiveDeployResult,
  DeploymentStrategy,
  DeploymentPhase,
} from './ProgressiveDeploymentService';

// Emergency Deploy
export {
  EmergencyDeployRepository,
  DeployEmergency,
  CreateEmergencyDeployInput,
} from './EmergencyDeployRepository';

export {
  EmergencyDeployService,
  EmergencyDeployServiceError,
  ListEmergencyOptions,
  PaginatedResult as EmergencyDeployPaginatedResult,
} from './EmergencyDeployService';
