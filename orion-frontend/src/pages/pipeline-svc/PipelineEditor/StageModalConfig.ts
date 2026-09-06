/**
 * StageModalConfig - StageModal 静态配置常量
 *
 * 包含阶段类型、质量门禁指标、构建平台、容器网络、APK 上传等所有静态选项，
 * 以及 PR 触发/超时/审批/质量门禁各配置的默认初始值。
 */
import type {
  ApprovalConfig,
  MatrixBuildConfig,
  QualityGateConfig,
  TimeoutConfig,
} from './types';
import type { PRTriggerConfig as PRTriggerConfigType } from '@/components/PRTriggerConfig';

export const STAGE_TYPES: { label: string; value: string }[] = [
  { label: '🔨 构建 (Build)', value: 'build' },
  { label: '🧪 测试 (Test)', value: 'test' },
  { label: '🔍 代码扫描 (Scan)', value: 'scan' },
  { label: '🚀 部署 (Deploy)', value: 'deploy' },
  { label: '📢 通知 (Notify)', value: 'notify' },
  { label: '🔀 子流水线 (Sub-Pipeline)', value: 'sub-pipeline' },
  { label: '🏷️ 多架构构建 (Buildx)', value: 'buildx' },
  { label: '📦 容器运行 (Container)', value: 'container' },
  { label: '📱 APK 上传 (APK Upload)', value: 'apk-upload' },
  { label: '⚙️ 自定义 (Custom)', value: 'custom' },
];

export const BUILD_PLATFORMS: { label: string; value: string }[] = [
  { label: 'linux/amd64', value: 'linux/amd64' },
  { label: 'linux/arm64', value: 'linux/arm64' },
  { label: 'linux/arm/v7', value: 'linux/arm/v7' },
  { label: 'linux/s390x', value: 'linux/s390x' },
  { label: 'linux/ppc64le', value: 'linux/ppc64le' },
];

export const CONTAINER_NETWORK_OPTIONS: { label: string; value: string }[] = [
  { label: 'host', value: 'host' },
  { label: 'bridge', value: 'bridge' },
  { label: 'none', value: 'none' },
];

export const APK_UPLOAD_TYPE_OPTIONS: { label: string; value: string }[] = [
  { label: '单市场 (Single)', value: 'single' },
  { label: '多市场并行 (Parallel)', value: 'parallel' },
];

export const APK_MARKET_OPTIONS: { label: string; value: string }[] = [
  { label: '华为 AppGallery', value: 'huawei' },
  { label: '小米应用商店', value: 'xiaomi' },
  { label: 'OPPO 软件商店', value: 'oppo' },
  { label: 'VIVO 应用商店', value: 'vivo' },
  { label: '荣耀应用市场', value: 'honor' },
  { label: '腾讯应用宝', value: 'tencent' },
  { label: 'Google Play', value: 'googleplay' },
  { label: '三星 Galaxy Store', value: 'samsung' },
  { label: '蒲公英', value: 'pgyer' },
  { label: 'fir.im', value: 'fir' },
];

export const APK_CHANNEL_OPTIONS: { label: string; value: string }[] = [
  { label: '正式 (Production)', value: 'production' },
  { label: '测试版 (Beta)', value: 'beta' },
  { label: '内测版 (Alpha)', value: 'alpha' },
  { label: '内部 (Internal)', value: 'internal' },
];

export const METRIC_OPTIONS: { label: string; value: string }[] = [
  { label: '测试通过率', value: 'test_pass_rate' },
  { label: '代码覆盖率', value: 'coverage' },
  { label: '漏洞数量', value: 'vulnerability_count' },
  { label: '自定义指标', value: 'custom' },
];

export const OPERATOR_OPTIONS: { label: string; value: string }[] = [
  { label: '>', value: '>' },
  { label: '<', value: '<' },
  { label: '>=', value: '>=' },
  { label: '<=', value: '<=' },
  { label: '==', value: '==' },
];

/** ============ 各配置区块的默认初始值 ============ */

/** 矩阵构建默认配置 */
export const DEFAULT_MATRIX_CONFIG: MatrixBuildConfig = {
  enabled: false,
  dimensions: [],
  exclusions: [],
};

/** PR/MR 触发默认配置 */
export const DEFAULT_PR_TRIGGER_CONFIG: Partial<PRTriggerConfigType> = {
  enabled: false,
  provider: 'github',
  prActions: ['opened', 'synchronize'],
};

/** 超时策略默认配置 */
export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  enabled: false,
  duration: 300,
  action: 'fail',
  retryCount: 1,
};

/** 审批默认配置 */
export const DEFAULT_APPROVAL_CONFIG: ApprovalConfig = {
  enabled: false,
  approvers: [],
  mode: 'any',
  timeout: 24,
  timeoutAction: 'reject',
};

/** 质量门禁默认配置 */
export const DEFAULT_QUALITY_GATE_CONFIG: QualityGateConfig = {
  enabled: false,
  rules: [],
  failureAction: 'block',
};
