/**
 * Knowledge Services (M28)
 */
export {
  KnowledgeRepository,
  KnowledgeSpace,
  CreateSpaceInput,
  UpdateSpaceInput,
  KnowledgeDoc,
  CreateDocInput,
  UpdateDocInput,
  DocVersion,
  KnowledgeSearchResult,
} from './KnowledgeRepository';
export { KnowledgeService, KnowledgeServiceError } from './KnowledgeService';
export {
  KnowledgeIntegrationService,
  type KnowledgeRecommendation,
  type ApprovalKnowledgeContext,
  type DeploymentKnowledgeContext,
  type HealingKnowledgeContext,
} from './KnowledgeIntegrationService';
