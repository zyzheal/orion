/**
 * 路由索引
 */

export { registerRoutes, addRouteConfig } from './api';
export { AuthRoutes } from './auth.routes';
export { TenantRoutes } from './tenant.routes';
export { PipelineVersionsRoutes, pipelineVersionsService } from './pipeline-versions.routes';
export { PipelineBudgetRoutes, pipelineBudgetService } from './pipeline-budget.routes';
export { PipelineTemplatesRoutes, pipelineTemplatesService } from './pipeline-templates.routes';
export { AIModelsRoutes, aiModelsService } from './ai-models.routes';
export { AIDecisionsRoutes, aiDecisionsService } from './ai-decisions.routes';
export { AIDegradationRoutes, aiDegradationService } from './ai-degradation.routes';
export { ChaosRoutes, chaosEngineeringService } from './chaos.routes';
export { ResilienceScoreRoutes, resilienceScoreService } from './resilience-score.routes';
export { SBOMRoutes, sbomService } from './sbom.routes';
export { DigitalTwinRoutes, digitalTwinService } from './digital-twin.routes';
export { GovernanceRoutes, governanceService } from './governance.routes';
