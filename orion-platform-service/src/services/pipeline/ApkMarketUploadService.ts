/**
 * APK市场上传服务
 *
 * 参照 apkgo 项目的设计，提供统一的APK上传到各应用市场的接口
 * 支持：华为、小米、OPPO、VIVO、荣耀、腾讯应用宝、蒲公英、fir.im等
 */

export interface UploadRequest {
  /** APK文件路径（本地路径或HTTP URL） */
  apkPath: string;
  /** 应用包名 */
  packageName: string;
  /** 版本号 */
  versionCode?: number;
  /** 版本名称 */
  versionName?: string;
  /** 更新日志 */
  changelog?: string;
  /** 截图路径列表 */
  screenshots?: string[];
  /** 发布渠道 */
  channel?: 'production' | 'beta' | 'alpha' | 'internal';
  /** 超时时间（毫秒） */
  timeoutMs?: number;
}

export interface UploadResult {
  /** 市场名称 */
  market: string;
  /** 是否成功 */
  success: boolean;
  /** 上传URL */
  uploadUrl?: string;
  /** 上传ID */
  uploadId?: string;
  /** 状态：submitted | under_review | published | failed */
  status: string;
  /** 错误信息 */
  error?: string;
  /** 耗时（毫秒） */
  durationMs: number;
  /** 输出日志 */
  stdout: string;
  /** 错误日志 */
  stderr: string;
  /** 上传进度 0-100 */
  progress?: number;
}

/** 进度回调 */
export type ProgressCallback = (market: string, progress: number, message: string) => void;

export interface MarketCredentials {
  /** 华为 */
  huawei?: {
    clientId?: string;
    clientSecret?: string;
    serviceAccount?: Record<string, unknown>;
    serviceAccountFile?: string;
    appId?: string;
  };
  /** 小米 */
  xiaomi?: {
    email: string;
    privateKey: string;
    cert?: string;
    certFile?: string;
  };
  /** OPPO */
  oppo?: {
    clientId: string;
    clientSecret: string;
  };
  /** VIVO */
  vivo?: {
    accessKey: string;
    accessSecret: string;
  };
  /** 荣耀 */
  honor?: {
    clientId: string;
    clientSecret: string;
    appId?: string;
  };
  /** 腾讯应用宝 */
  tencent?: {
    userId: string;
    accessSecret: string;
    appId: string;
  };
  /** 蒲公英 */
  pgyer?: {
    apiKey: string;
  };
  /** fir.im */
  fir?: {
    apiToken: string;
  };
  /** Google Play */
  googleplay?: {
    jsonKeyFile: string;
    packageName: string;
    track?: string;
  };
  /** 三星 */
  samsung?: {
    serviceAccountId: string;
    privateKey: string;
    contentId: string;
  };
}

/**
 * 市场上传器接口
 */
export interface MarketUploader {
  /** 市场名称 */
  name(): string;
  /** 上传APK到市场 */
  upload(request: UploadRequest, credentials: MarketCredentials, onProgress?: ProgressCallback): Promise<UploadResult>;
}

/**
 * 错误分类（参照apkgo的category.go）
 */
export enum ErrorCategory {
  SUCCESS = 'success',
  ALREADY_DONE = 'already_done',
  AUTH_FAILED = 'auth_failed',
  NETWORK_RETRY = 'network_retry',
  STORE_BUSY = 'store_busy',
  POLICY_BLOCK = 'policy_block',
  CONFIG_INVALID = 'config_invalid',
  UNKNOWN = 'unknown',
}

/**
 * APK市场上传服务
 */
export class ApkMarketUploadService {
  private uploaders: Map<string, MarketUploader> = new Map();

  constructor() {
    this.registerDefaultUploaders();
  }

  /**
   * 注册默认上传器
   */
  private registerDefaultUploaders() {
    // 这些将在各个市场模块中实现
  }

  /**
   * 注册自定义上传器
   */
  registerUploader(uploader: MarketUploader) {
    this.uploaders.set(uploader.name().toLowerCase(), uploader);
  }

  /**
   * 上传APK到指定市场
   */
  async uploadToMarket(
    market: string,
    request: UploadRequest,
    credentials: MarketCredentials,
    onProgress?: ProgressCallback
  ): Promise<UploadResult> {
    const marketKey = market.toLowerCase();
    const uploader = this.uploaders.get(marketKey);

    if (!uploader) {
      return {
        market,
        success: false,
        status: 'failed',
        error: `Unsupported market: ${market}`,
        durationMs: 0,
        stdout: '',
        stderr: `Market "${market}" is not supported`,
      };
    }

    return uploader.upload(request, credentials, onProgress);
  }

  /**
   * 获取支持的市场列表
   */
  getSupportedMarkets(): string[] {
    return Array.from(this.uploaders.keys());
  }
}
