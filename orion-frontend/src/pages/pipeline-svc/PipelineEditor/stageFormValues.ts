/**
 * stageFormValues - StageModal 表单值类型与默认值
 *
 * 表单字段由 Form.Item 的 `name` 隐式决定，这里显式声明其联合类型，
 * 供 useStageModalState / buildStageConfig 复用，避免隐式 any。
 */

export interface StageFormValues {
  /** 阶段名称 */
  name: string;
  /** 阶段类型 */
  type: string;
  /** 阶段超时时间 (秒) */
  timeout: number;
  /** 阶段重试次数 */
  retryCount: number;
  /** 依赖阶段 id 列表 */
  dependsOn?: string[];
  /** Shell 脚本内容 */
  script?: string;
  /** 直接执行的命令 */
  command?: string;
  /** 执行镜像 */
  image?: string;
  /** 环境变量（KEY=VALUE 多行） */
  env?: string;

  /** 子流水线：目标流水线 id */
  subPipelineId?: string;
  /** 子流水线：分支 */
  subPipelineBranch?: string;

  /** Buildx：镜像名称 */
  buildxImageName?: string;
  /** Buildx：镜像标签 */
  buildxTag?: string;
  /** Buildx：目标平台 */
  buildxPlatforms?: string[];
  /** Buildx：Dockerfile 路径 */
  buildxDockerfile?: string;
  /** Buildx：构建上下文 */
  buildxContext?: string;
  /** Buildx：是否推送 */
  buildxPush?: boolean;

  /** 容器：镜像 */
  containerImage?: string;
  /** 容器：启动命令 */
  containerCommand?: string;
  /** 容器：启动参数（每行一个） */
  containerArgs?: string;
  /** 容器：环境变量（KEY=VALUE 多行） */
  containerEnv?: string;
  /** 容器：是否启用资源限制 */
  containerResources?: boolean;
  /** 容器：CPU 限制 */
  containerCpu?: number;
  /** 容器：内存限制 */
  containerMemory?: string;
  /** 容器：是否启用 GPU */
  containerGpu?: boolean;
  /** 容器：GPU 设备 */
  containerGpuDevices?: string;
  /** 容器：GPU 能力（逗号分隔） */
  containerGpuCapabilities?: string;
  /** 容器：网络模式 */
  containerNetwork?: string;

  /** APK 上传：上传类型 */
  apkUploadType?: 'single' | 'parallel';
  /** APK 上传：单市场 */
  apkMarket?: string;
  /** APK 上传：多市场列表 */
  apkMarkets?: string[];
  /** APK 上传：APK 文件路径 */
  apkPath?: string;
  /** APK 上传：应用包名 */
  packageName?: string;
  /** APK 上传：版本名称 */
  versionName?: string;
  /** APK 上传：更新日志 */
  changelog?: string;
  /** APK 上传：市场凭证 */
  apkCredentials?: string;
  /** APK 上传：发布渠道 */
  apkChannel?: 'production' | 'beta' | 'alpha' | 'internal';

  /** 缓存：是否启用 */
  cacheEnabled?: boolean;
  /** 缓存：Key */
  cacheKey?: string;
  /** 缓存：恢复 Key 前缀（每行一个） */
  cacheRestoreKeys?: string;

  /** 构建产物：过期时间 (天) */
  artifactExpiry?: number;
}

/** 表单 initialValues */
export const STAGE_FORM_INITIAL_VALUES: Pick<
  StageFormValues,
  'timeout' | 'retryCount' | 'cacheEnabled' | 'artifactExpiry'
> = {
  timeout: 300,
  retryCount: 0,
  cacheEnabled: false,
  artifactExpiry: 7,
};
