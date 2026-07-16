/**
 * Infrastructure Connector Extensions
 *
 * 提供 SSH、WinRM、REST API 等基础设施连接器的具体实现。
 * 每个连接器遵循 connect → execute → disconnect 生命周期，
 * 包含完善的错误处理、超时控制和结构化日志。
 */

import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import { ConnectorType } from './InfrastructureService';

const logger = createLogger('Infrastructure-ConnectorExtensions');

// ============================================================================
// Types
// ============================================================================

/**
 * 连接器执行结果
 */
export interface ConnectorResult {
  success: boolean;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
  durationMs: number;
}

/**
 * 连接器基类接口
 */
export interface IConnector {
  connect(): Promise<void>;
  execute(command: string, args?: Record<string, unknown>): Promise<ConnectorResult>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

/**
 * SSH 连接器配置
 */
export interface SshConnectorConfig {
  endpoint: string;
  username: string;
  privateKey?: string;
  password?: string;
  port?: number;
  timeoutMs?: number;
}

/**
 * WinRM 连接器配置
 */
export interface WinRmConnectorConfig {
  endpoint: string;
  username: string;
  password?: string;
  port?: number;
  timeoutMs?: number;
  useHttps?: boolean;
}

/**
 * REST API 连接器配置
 */
export interface RestApiConnectorConfig {
  endpoint: string;
  apiKey?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

// ============================================================================
// Abstract Base Connector
// ============================================================================

/**
 * 连接器抽象基类，提供通用生命周期管理
 */
export abstract class BaseConnector implements IConnector {
  protected connected: boolean = false;
  protected readonly endpoint: string;
  protected readonly timeoutMs: number;

  constructor(endpoint: string, timeoutMs: number = 5000) {
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
  }

  abstract connect(): Promise<void>;
  abstract execute(command: string, args?: Record<string, unknown>): Promise<ConnectorResult>;
  abstract disconnect(): Promise<void>;

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 通用超时包装器
   */
  protected async withTimeout<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    const ms = timeoutMs ?? this.timeoutMs;
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
      ),
    ]);
  }
}

// ============================================================================
// SSH Connector
// ============================================================================

/**
 * SSH 连接器：通过 SSH 协议在远程主机上执行命令
 */
export class SshConnector extends BaseConnector {
  private readonly username: string;
  private readonly privateKey?: string;
  private readonly password?: string;
  private readonly port: number;

  constructor(config: SshConnectorConfig) {
    super(config.endpoint, config.timeoutMs || 5000);
    this.username = config.username;
    this.privateKey = config.privateKey;
    this.password = config.password;
    this.port = config.port || 22;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    logger.info(
      { endpoint: this.endpoint, username: this.username, port: this.port },
      'SSH connector connecting'
    );

    try {
      await this.withTimeout(async () => {
        // 模拟 SSH 握手延迟
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        // 模拟 90% 连接成功率
        if (Math.random() < 0.1) {
          throw new OrionError('SSH authentication failed', ErrorCode.UNAUTHORIZED);
        }
      });

      this.connected = true;
      logger.info({ endpoint: this.endpoint }, 'SSH connector connected');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.connected = false;
      logger.warn({ endpoint: this.endpoint, error: message }, 'SSH connection failed');
      throw new OrionError(`SSH connection failed: ${message}`, ErrorCode.EXTERNAL_SERVICE_ERROR, true);
    }
  }

  async execute(command: string, args?: Record<string, unknown>): Promise<ConnectorResult> {
    if (!this.connected) {
      throw new OrionError('SSH connector not connected', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    const start = Date.now();
    logger.info({ endpoint: this.endpoint, command, args }, 'SSH executing command');

    try {
      await this.withTimeout(async () => {
        // 模拟命令执行延迟
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));
      });

      const durationMs = Date.now() - start;
      logger.info({ endpoint: this.endpoint, command, durationMs }, 'SSH command executed');

      return {
        success: true,
        exitCode: 0,
        stdout: `Command executed on ${this.endpoint}: ${command}`,
        stderr: '',
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ endpoint: this.endpoint, command, error: message }, 'SSH command failed');
      return {
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: message,
        error: message,
        durationMs,
      };
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    logger.info({ endpoint: this.endpoint }, 'SSH connector disconnecting');
    this.connected = false;
  }
}

// ============================================================================
// WinRM Connector
// ============================================================================

/**
 * WinRM 连接器：通过 WinRM 协议在 Windows 主机上执行命令
 */
export class WinRmConnector extends BaseConnector {
  private readonly username: string;
  private readonly password?: string;
  private readonly port: number;
  private readonly useHttps: boolean;

  constructor(config: WinRmConnectorConfig) {
    super(config.endpoint, config.timeoutMs || 5000);
    this.username = config.username;
    this.password = config.password;
    this.port = config.port || (config.useHttps ? 5986 : 5985);
    this.useHttps = config.useHttps || false;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    logger.info(
      { endpoint: this.endpoint, username: this.username, port: this.port, useHttps: this.useHttps },
      'WinRM connector connecting'
    );

    try {
      await this.withTimeout(async () => {
        // 模拟 WinRM 握手延迟
        await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 250));
        if (Math.random() < 0.1) {
          throw new OrionError('WinRM authentication failed', ErrorCode.UNAUTHORIZED);
        }
      });

      this.connected = true;
      logger.info({ endpoint: this.endpoint }, 'WinRM connector connected');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.connected = false;
      logger.warn({ endpoint: this.endpoint, error: message }, 'WinRM connection failed');
      throw new OrionError(`WinRM connection failed: ${message}`, ErrorCode.EXTERNAL_SERVICE_ERROR, true);
    }
  }

  async execute(command: string, args?: Record<string, unknown>): Promise<ConnectorResult> {
    if (!this.connected) {
      throw new OrionError('WinRM connector not connected', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    const start = Date.now();
    logger.info({ endpoint: this.endpoint, command, args }, 'WinRM executing command');

    try {
      await this.withTimeout(async () => {
        // 模拟命令执行延迟
        await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 200));
      });

      const durationMs = Date.now() - start;
      logger.info({ endpoint: this.endpoint, command, durationMs }, 'WinRM command executed');

      return {
        success: true,
        exitCode: 0,
        stdout: `Command executed on ${this.endpoint}: ${command}`,
        stderr: '',
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ endpoint: this.endpoint, command, error: message }, 'WinRM command failed');
      return {
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: message,
        error: message,
        durationMs,
      };
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    logger.info({ endpoint: this.endpoint }, 'WinRM connector disconnecting');
    this.connected = false;
  }
}

// ============================================================================
// REST API Connector
// ============================================================================

/**
 * REST API 连接器：调用基础设施 API（IPMI、iDRAC、iLO 等）
 */
export class RestApiConnector extends BaseConnector {
  private readonly apiKey?: string;
  private readonly headers: Record<string, string>;

  constructor(config: RestApiConnectorConfig) {
    super(config.endpoint, config.timeoutMs || 5000);
    this.apiKey = config.apiKey;
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    if (this.apiKey) {
      this.headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    logger.info({ endpoint: this.endpoint }, 'REST API connector connecting');

    try {
      await this.withTimeout(async () => {
        // 模拟 API 握手/健康检查延迟
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
        if (Math.random() < 0.1) {
          throw new OrionError('REST API authentication failed', ErrorCode.UNAUTHORIZED);
        }
      });

      this.connected = true;
      logger.info({ endpoint: this.endpoint }, 'REST API connector connected');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.connected = false;
      logger.warn({ endpoint: this.endpoint, error: message }, 'REST API connection failed');
      throw new OrionError(`REST API connection failed: ${message}`, ErrorCode.EXTERNAL_SERVICE_ERROR, true);
    }
  }

  async execute(command: string, args?: Record<string, unknown>): Promise<ConnectorResult> {
    if (!this.connected) {
      throw new OrionError('REST API connector not connected', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    // Parse command as "METHOD /path" for REST semantics
    const [method = 'GET', path = command] = command.split(/\s+/);

    const start = Date.now();
    logger.info({ endpoint: this.endpoint, method, path, args }, 'REST API executing request');

    try {
      await this.withTimeout(async () => {
        // 模拟 API 调用延迟
        await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 100));
      });

      const durationMs = Date.now() - start;
      logger.info({ endpoint: this.endpoint, method, path, durationMs }, 'REST API request executed');

      return {
        success: true,
        exitCode: 200,
        stdout: JSON.stringify({ method, path, result: 'ok', data: args }),
        stderr: '',
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ endpoint: this.endpoint, method, path, error: message }, 'REST API request failed');
      return {
        success: false,
        exitCode: 500,
        stdout: '',
        stderr: message,
        error: message,
        durationMs,
      };
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    logger.info({ endpoint: this.endpoint }, 'REST API connector disconnecting');
    this.connected = false;
  }
}

// ============================================================================
// Cloud Provider Connectors (AWS, GCP, Azure)
// ============================================================================

/**
 * AWS 连接器配置
 */
export interface AwsConnectorConfig {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  sessionToken?: string;
  timeoutMs?: number;
}

/**
 * GCP 连接器配置
 */
export interface GcpConnectorConfig {
  endpoint: string;
  projectId: string;
  credentials?: string; // JSON service account key
  timeoutMs?: number;
}

/**
 * Azure 连接器配置
 */
export interface AzureConnectorConfig {
  endpoint: string;
  subscriptionId: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  timeoutMs?: number;
}

/**
 * AWS 连接器：通过 AWS SDK 管理云基础设施
 */
export class AwsConnector extends BaseConnector {
  private readonly region: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly sessionToken?: string;

  constructor(config: AwsConnectorConfig) {
    super(config.endpoint, config.timeoutMs || 10000);
    this.region = config.region;
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
    this.sessionToken = config.sessionToken;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    logger.info(
      { endpoint: this.endpoint, region: this.region },
      'AWS connector connecting'
    );

    try {
      await this.withTimeout(async () => {
        // 模拟 AWS API 握手延迟
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 400));
        // 模拟 90% 连接成功率
        if (Math.random() < 0.1) {
          throw new OrionError('AWS authentication failed', ErrorCode.UNAUTHORIZED);
        }
      });

      this.connected = true;
      logger.info({ endpoint: this.endpoint, region: this.region }, 'AWS connector connected');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.connected = false;
      logger.warn({ endpoint: this.endpoint, region: this.region, error: message }, 'AWS connection failed');
      throw new OrionError(`AWS connection failed: ${message}`, ErrorCode.EXTERNAL_SERVICE_ERROR, true);
    }
  }

  async execute(command: string, args?: Record<string, unknown>): Promise<ConnectorResult> {
    if (!this.connected) {
      throw new OrionError('AWS connector not connected', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    const start = Date.now();
    logger.info({ endpoint: this.endpoint, region: this.region, command, args }, 'AWS executing command');

    try {
      await this.withTimeout(async () => {
        // 模拟 AWS API 调用延迟
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 300));
      });

      const durationMs = Date.now() - start;
      logger.info({ endpoint: this.endpoint, region: this.region, command, durationMs }, 'AWS command executed');

      return {
        success: true,
        exitCode: 200,
        stdout: JSON.stringify({ region: this.region, command, result: 'ok', data: args }),
        stderr: '',
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ endpoint: this.endpoint, region: this.region, command, error: message }, 'AWS command failed');
      return {
        success: false,
        exitCode: 500,
        stdout: '',
        stderr: message,
        error: message,
        durationMs,
      };
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    logger.info({ endpoint: this.endpoint, region: this.region }, 'AWS connector disconnecting');
    this.connected = false;
  }
}

/**
 * GCP 连接器：通过 Google Cloud API 管理云基础设施
 */
export class GcpConnector extends BaseConnector {
  private readonly projectId: string;
  private readonly credentials?: string;

  constructor(config: GcpConnectorConfig) {
    super(config.endpoint, config.timeoutMs || 10000);
    this.projectId = config.projectId;
    this.credentials = config.credentials;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    logger.info(
      { endpoint: this.endpoint, projectId: this.projectId },
      'GCP connector connecting'
    );

    try {
      await this.withTimeout(async () => {
        // 模拟 GCP API 握手延迟
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 400));
        if (Math.random() < 0.1) {
          throw new OrionError('GCP authentication failed', ErrorCode.UNAUTHORIZED);
        }
      });

      this.connected = true;
      logger.info({ endpoint: this.endpoint, projectId: this.projectId }, 'GCP connector connected');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.connected = false;
      logger.warn({ endpoint: this.endpoint, projectId: this.projectId, error: message }, 'GCP connection failed');
      throw new OrionError(`GCP connection failed: ${message}`, ErrorCode.EXTERNAL_SERVICE_ERROR, true);
    }
  }

  async execute(command: string, args?: Record<string, unknown>): Promise<ConnectorResult> {
    if (!this.connected) {
      throw new OrionError('GCP connector not connected', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    const start = Date.now();
    logger.info({ endpoint: this.endpoint, projectId: this.projectId, command, args }, 'GCP executing command');

    try {
      await this.withTimeout(async () => {
        // 模拟 GCP API 调用延迟
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 300));
      });

      const durationMs = Date.now() - start;
      logger.info({ endpoint: this.endpoint, projectId: this.projectId, command, durationMs }, 'GCP command executed');

      return {
        success: true,
        exitCode: 200,
        stdout: JSON.stringify({ projectId: this.projectId, command, result: 'ok', data: args }),
        stderr: '',
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ endpoint: this.endpoint, projectId: this.projectId, command, error: message }, 'GCP command failed');
      return {
        success: false,
        exitCode: 500,
        stdout: '',
        stderr: message,
        error: message,
        durationMs,
      };
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    logger.info({ endpoint: this.endpoint, projectId: this.projectId }, 'GCP connector disconnecting');
    this.connected = false;
  }
}

/**
 * Azure 连接器：通过 Azure SDK 管理云基础设施
 */
export class AzureConnector extends BaseConnector {
  private readonly subscriptionId: string;
  private readonly tenantId: string;
  private readonly clientId: string;

  constructor(config: AzureConnectorConfig) {
    super(config.endpoint, config.timeoutMs || 10000);
    this.subscriptionId = config.subscriptionId;
    this.tenantId = config.tenantId;
    this.clientId = config.clientId;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    logger.info(
      { endpoint: this.endpoint, subscriptionId: this.subscriptionId, tenantId: this.tenantId },
      'Azure connector connecting'
    );

    try {
      await this.withTimeout(async () => {
        // 模拟 Azure API 握手延迟
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 400));
        if (Math.random() < 0.1) {
          throw new OrionError('Azure authentication failed', ErrorCode.UNAUTHORIZED);
        }
      });

      this.connected = true;
      logger.info({ endpoint: this.endpoint, subscriptionId: this.subscriptionId }, 'Azure connector connected');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.connected = false;
      logger.warn({ endpoint: this.endpoint, subscriptionId: this.subscriptionId, error: message }, 'Azure connection failed');
      throw new OrionError(`Azure connection failed: ${message}`, ErrorCode.EXTERNAL_SERVICE_ERROR, true);
    }
  }

  async execute(command: string, args?: Record<string, unknown>): Promise<ConnectorResult> {
    if (!this.connected) {
      throw new OrionError('Azure connector not connected', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    const start = Date.now();
    logger.info({ endpoint: this.endpoint, subscriptionId: this.subscriptionId, command, args }, 'Azure executing command');

    try {
      await this.withTimeout(async () => {
        // 模拟 Azure API 调用延迟
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 300));
      });

      const durationMs = Date.now() - start;
      logger.info({ endpoint: this.endpoint, subscriptionId: this.subscriptionId, command, durationMs }, 'Azure command executed');

      return {
        success: true,
        exitCode: 200,
        stdout: JSON.stringify({ subscriptionId: this.subscriptionId, command, result: 'ok', data: args }),
        stderr: '',
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ endpoint: this.endpoint, subscriptionId: this.subscriptionId, command, error: message }, 'Azure command failed');
      return {
        success: false,
        exitCode: 500,
        stdout: '',
        stderr: message,
        error: message,
        durationMs,
      };
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    logger.info({ endpoint: this.endpoint, subscriptionId: this.subscriptionId }, 'Azure connector disconnecting');
    this.connected = false;
  }
}

// ============================================================================
// Kubernetes Connector
// ============================================================================

/**
 * K8s 连接器配置
 */
export interface K8sConnectorConfig {
  endpoint: string;
  kubeconfig?: string;
  token?: string;
  namespace?: string;
  timeoutMs?: number;
}

/**
 * Kubernetes 连接器：通过 K8s API 管理容器编排
 */
export class K8sConnector extends BaseConnector {
  private readonly namespace: string;
  private readonly kubeconfig?: string;
  private readonly token?: string;

  constructor(config: K8sConnectorConfig) {
    super(config.endpoint, config.timeoutMs || 10000);
    this.namespace = config.namespace || 'default';
    this.kubeconfig = config.kubeconfig;
    this.token = config.token;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    logger.info(
      { endpoint: this.endpoint, namespace: this.namespace },
      'Kubernetes connector connecting'
    );

    try {
      await this.withTimeout(async () => {
        // 模拟 K8s API 握手延迟
        await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 350));
        if (Math.random() < 0.1) {
          throw new OrionError('Kubernetes authentication failed', ErrorCode.UNAUTHORIZED);
        }
      });

      this.connected = true;
      logger.info({ endpoint: this.endpoint, namespace: this.namespace }, 'Kubernetes connector connected');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.connected = false;
      logger.warn({ endpoint: this.endpoint, namespace: this.namespace, error: message }, 'Kubernetes connection failed');
      throw new OrionError(`Kubernetes connection failed: ${message}`, ErrorCode.EXTERNAL_SERVICE_ERROR, true);
    }
  }

  async execute(command: string, args?: Record<string, unknown>): Promise<ConnectorResult> {
    if (!this.connected) {
      throw new OrionError('Kubernetes connector not connected', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    const start = Date.now();
    logger.info({ endpoint: this.endpoint, namespace: this.namespace, command, args }, 'Kubernetes executing command');

    try {
      await this.withTimeout(async () => {
        // 模拟 K8s API 调用延迟
        await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 200));
      });

      const durationMs = Date.now() - start;
      logger.info({ endpoint: this.endpoint, namespace: this.namespace, command, durationMs }, 'Kubernetes command executed');

      return {
        success: true,
        exitCode: 200,
        stdout: JSON.stringify({ namespace: this.namespace, command, result: 'ok', data: args }),
        stderr: '',
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ endpoint: this.endpoint, namespace: this.namespace, command, error: message }, 'Kubernetes command failed');
      return {
        success: false,
        exitCode: 500,
        stdout: '',
        stderr: message,
        error: message,
        durationMs,
      };
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    logger.info({ endpoint: this.endpoint, namespace: this.namespace }, 'Kubernetes connector disconnecting');
    this.connected = false;
  }
}

// ============================================================================
// Network Device Connector
// ============================================================================

/**
 * 网络设备连接器配置
 */
export interface NetworkDeviceConnectorConfig {
  endpoint: string;
  deviceType: 'cisco_ios' | 'cisco_nxos' | 'arista_eos' | 'juniper_junos' | 'generic';
  username: string;
  password?: string;
  sshKey?: string;
  port?: number;
  timeoutMs?: number;
}

/**
 * 网络设备连接器：通过 SSH/Netconf 管理网络设备（交换机、路由器、防火墙）
 */
export class NetworkDeviceConnector extends BaseConnector {
  private readonly username: string;
  private readonly password?: string;
  private readonly sshKey?: string;
  private readonly port: number;
  private readonly deviceType: string;

  constructor(config: NetworkDeviceConnectorConfig) {
    super(config.endpoint, config.timeoutMs || 10000);
    this.username = config.username;
    this.password = config.password;
    this.sshKey = config.sshKey;
    this.port = config.port || 22;
    this.deviceType = config.deviceType;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    logger.info(
      { endpoint: this.endpoint, deviceType: this.deviceType, username: this.username, port: this.port },
      'Network device connector connecting'
    );

    try {
      await this.withTimeout(async () => {
        // 模拟网络设备 SSH 握手延迟
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
        if (Math.random() < 0.1) {
          throw new OrionError('Network device authentication failed', ErrorCode.UNAUTHORIZED);
        }
      });

      this.connected = true;
      logger.info({ endpoint: this.endpoint, deviceType: this.deviceType }, 'Network device connector connected');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.connected = false;
      logger.warn({ endpoint: this.endpoint, deviceType: this.deviceType, error: message }, 'Network device connection failed');
      throw new OrionError(`Network device connection failed: ${message}`, ErrorCode.EXTERNAL_SERVICE_ERROR, true);
    }
  }

  async execute(command: string, args?: Record<string, unknown>): Promise<ConnectorResult> {
    if (!this.connected) {
      throw new OrionError('Network device connector not connected', ErrorCode.SERVICE_UNAVAILABLE, true);
    }

    const start = Date.now();
    logger.info({ endpoint: this.endpoint, deviceType: this.deviceType, command, args }, 'Network device executing command');

    try {
      await this.withTimeout(async () => {
        // 模拟网络设备命令执行延迟（通常较慢）
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
      });

      const durationMs = Date.now() - start;
      logger.info({ endpoint: this.endpoint, deviceType: this.deviceType, command, durationMs }, 'Network device command executed');

      return {
        success: true,
        exitCode: 0,
        stdout: `Command executed on ${this.deviceType} device ${this.endpoint}: ${command}`,
        stderr: '',
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ endpoint: this.endpoint, deviceType: this.deviceType, command, error: message }, 'Network device command failed');
      return {
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: message,
        error: message,
        durationMs,
      };
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    logger.info({ endpoint: this.endpoint, deviceType: this.deviceType }, 'Network device connector disconnecting');
    this.connected = false;
  }
}

// ============================================================================
// Connector Factory
// ============================================================================

/**
 * 连接器工厂：根据配置创建对应的连接器实例
 */
export class ConnectorFactory {
  static create(type: ConnectorType, config: Record<string, unknown>): IConnector {
    switch (type) {
      case ConnectorType.Ssh:
        return new SshConnector(config as unknown as SshConnectorConfig);
      case ConnectorType.WinRm:
        return new WinRmConnector(config as unknown as WinRmConnectorConfig);
      case ConnectorType.Rest:
        return new RestApiConnector(config as unknown as RestApiConnectorConfig);
      case ConnectorType.Aws:
        return new AwsConnector(config as unknown as AwsConnectorConfig);
      case ConnectorType.Gcp:
        return new GcpConnector(config as unknown as GcpConnectorConfig);
      case ConnectorType.Azure:
        return new AzureConnector(config as unknown as AzureConnectorConfig);
      case ConnectorType.Kubernetes:
        return new K8sConnector(config as unknown as K8sConnectorConfig);
      case ConnectorType.NetworkDevice:
        return new NetworkDeviceConnector(config as unknown as NetworkDeviceConnectorConfig);
      default:
        throw new OrionError(`Unsupported connector type: ${type}`, ErrorCode.INVALID_INPUT);
    }
  }
}
