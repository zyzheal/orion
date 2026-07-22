/**
 * Extended Artifact Types - 扩展产物类型定义
 *
 * 基于 M29/M30 产物与二方库管理设计
 */

// ==================== 扩展产物类型 ====================

export type ExtendedArtifactType =
  // 容器镜像
  | 'container_image'
  | 'base_image'
  | 'builder_image'
  // 依赖包
  | 'jar_artifact'
  | 'war_artifact'
  | 'npm_package'
  | 'python_wheel'
  | 'go_module'
  | 'rust_crate'
  // 基础设施产物
  | 'helm_chart'
  | 'terraform_module'
  | 'k8s_manifest'
  | 'docker_compose'
  // 测试产物
  | 'test_report'
  | 'coverage_report'
  | 'performance_report'
  | 'test_artifact'
  // 安全产物
  | 'sbom'
  | 'signature'
  | 'security_scan_report'
  | 'compliance_report'
  // 文档产物
  | 'api_doc'
  | 'changelog'
  | 'release_notes';

// ==================== 产物生命周期阶段 ====================

export type ArtifactStage =
  | 'snapshot'        // 开发中版本
  | 'release_candidate' // 候选发布版
  | 'stable'          // 稳定版
  | 'production'      // 生产版本
  | 'archived';       // 归档版本

// ==================== 产物完整元数据 ====================

export interface BuildMetadata {
  pipelineRunId: string;
  gitCommit: string;
  gitBranch: string;
  gitTag?: string;
  builderImage?: string;
  buildTime: Date;
  buildDuration?: number; // seconds
  buildArgs?: Record<string, string>;
}

export interface SecurityMetadata {
  sbomPath?: string;
  scanResults?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  signed: boolean;
  signer?: string;
  signatureAlgorithm?: string;
}

export interface TestMetadata {
  unitTests?: {
    passed: number;
    failed: number;
    coverage?: number;
  };
  integrationTests?: {
    passed: number;
    failed: number;
  };
  performanceTests?: {
    p99?: number;
    passed: boolean;
  };
}

export interface DeploymentMetadata {
  environment: string;
  deployedAt: Date;
  deployedBy: string;
  status: 'success' | 'failed' | 'pending';
}

export interface ArtifactDependencies {
  baseImage?: string;
  libraries?: Array<{
    name: string;
    version: string;
    type: 'internal' | 'external';
  }>;
}

// ==================== 扩展产物实体 ====================

export interface ExtendedArtifact {
  id: string;
  name: string;
  namespace: string;
  version: string;
  type: ExtendedArtifactType;
  stage: ArtifactStage;

  // 基础信息
  displayName?: string;
  description?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;

  // 存储信息
  sizeBytes: number;
  digest?: string; // sha256:xxx
  storagePath: string;
  storageBackend?: string; // s3, harbor, nexus

  // 构建元数据
  build?: BuildMetadata;

  // 安全元数据
  security?: SecurityMetadata;

  // 测试元数据
  tests?: TestMetadata;

  // 部署历史
  deployments?: DeploymentMetadata[];

  // 依赖关系
  dependencies?: ArtifactDependencies;

  // 状态
  status: 'uploading' | 'available' | 'deprecated' | 'quarantined' | 'deleted';

  // 清理策略
  retentionDays?: number;
  cleanupPolicy?: string;

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;

  // 租户
  tenantId?: string;
  productLineId?: string;
}

// ==================== 产物提升请求 ====================

export interface ArtifactPromotionRequest {
  artifactId: string;
  fromStage: ArtifactStage;
  toStage: ArtifactStage;
  requestedBy: string;
  reason?: string;

  // 提升条件检查结果
  checks?: {
    ciPassed?: boolean;
    securityScanPassed?: boolean;
    sbomGenerated?: boolean;
    codeReviewApproved?: boolean;
    integrationTestsPassed?: boolean;
  };
}

// ==================== 产物提升规则 ====================

export interface PromotionRule {
  fromStage: ArtifactStage;
  toStage: ArtifactStage;

  requiredChecks: Array<{
    name: string;
    condition: string;
    required: boolean;
  }>;

  approvalsRequired: number;
  approverRoles?: string[];

  autoPromote?: boolean;
}

// ==================== 清理策略 ====================

export interface CleanupPolicy {
  name: string;
  description?: string;

  conditions: {
    ageDays?: number;
    stage?: ArtifactStage[];
    notReferenced?: boolean;
    superseded?: boolean;
    notDeployed?: boolean;
  };

  action: 'delete' | 'archive';

  enabled: boolean;
}

// ==================== 创建产物输入 ====================

export interface CreateExtendedArtifactInput {
  name: string;
  namespace: string;
  version: string;
  type: ExtendedArtifactType;
  stage?: ArtifactStage;

  displayName?: string;
  description?: string;
  labels?: Record<string, string>;

  sizeBytes: number;
  digest?: string;
  storagePath: string;
  storageBackend?: string;

  build?: BuildMetadata;
  security?: SecurityMetadata;
  tests?: TestMetadata;
  dependencies?: ArtifactDependencies;

  retentionDays?: number;
  cleanupPolicy?: string;

  createdBy?: string;
  tenantId?: string;
  productLineId?: string;
}