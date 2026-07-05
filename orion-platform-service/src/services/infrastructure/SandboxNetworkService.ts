/**
 * Sandbox Network Service
 *
 * 提供沙箱网络隔离能力，基于 Kubernetes NetworkPolicy API。
 * 支持创建隔离网络、允许/阻断流量、管理网络策略规则。
 */

import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import { getTenantId } from '../../utils/tenant';
import { InfrastructureService, SandboxInfo, SandboxNetworkPolicy, NetworkPolicyRule, SandboxIsolationStatus } from './InfrastructureService';

const logger = createLogger('Infrastructure-SandboxNetwork');

// ============================================================================
// Types
// ============================================================================

/**
 * 沙箱网络创建参数
 */
export interface CreateSandboxNetworkParams {
  name: string;
  namespace: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

/**
 * 流量允许规则参数
 */
export interface AllowTrafficParams {
  fromEnv: string;
  toEnv: string;
  ports: Array<{ port: number; protocol: 'TCP' | 'UDP' | 'SCTP' }>;
}

/**
 * DNS 隔离配置参数
 */
export interface DnsIsolationParams {
  /** 允许解析的 DNS 域名列表（空数组 = 只允许 cluster-local） */
  allowedDomains: string[];
  /** 是否使用自定义 DNS 服务器 */
  customDnsServers?: string[];
  /** DNS 查询超时（毫秒） */
  dnsTimeoutMs?: number;
}

/**
 * 出站流量控制规则
 */
export interface EgressTrafficRule {
  name: string;
  destination: string; // CIDR 或域名
  ports: Array<{ port: number; protocol: 'TCP' | 'UDP' | 'SCTP' }>;
  allow: boolean;
}

/**
 * 出站流量控制参数
 */
export interface EgressTrafficControlParams {
  sandboxId: string;
  rules: EgressTrafficRule[];
  defaultAction: 'allow' | 'deny';
}

// ============================================================================
// SandboxNetworkService
// ============================================================================

/**
 * 沙箱网络隔离服务
 *
 * 职责：
 * 1. 创建隔离的 Kubernetes 网络命名空间
 * 2. 应用网络策略隔离环境
 * 3. 管理环境间允许的流量规则
 * 4. 阻断所有入站/出站流量
 */
export class SandboxNetworkService {
  private infrastructureService: InfrastructureService;

  constructor(infrastructureService: InfrastructureService) {
    this.infrastructureService = infrastructureService;
  }

  // ==========================================================================
  // Network Namespace Management
  // ==========================================================================

  /**
   * 创建隔离的网络命名空间
   *
   * @param params - 命名空间参数
   * @returns 创建的沙箱信息
   */
  async createSandboxNetwork(params: CreateSandboxNetworkParams): Promise<SandboxInfo> {
    const { name, namespace, labels, annotations } = params;

    logger.info({ name, namespace, labels }, 'Creating sandbox network');

    // 创建网络策略，默认阻断所有流量
    const policy = this.infrastructureService.createSandboxNetworkPolicy({
      sandboxId: name,
      name: `isolation-policy-${name}`,
      namespace,
      labels: {
        app: name,
        isolation: 'enforced',
        ...labels,
      },
      annotations: {
        'orion.io/isolation': 'true',
        ...annotations,
      },
      ingressRules: [
        {
          name: 'deny-all-ingress',
          podSelector: {},
          allow: false,
        },
      ],
      egressRules: [
        {
          name: 'deny-all-egress',
          podSelector: {},
          allow: false,
        },
      ],
    });

    const sandbox: SandboxInfo = {
      id: name,
      name,
      namespace,
      isolationStatus: SandboxIsolationStatus.Isolated,
      networkPolicyId: policy.id,
      createdAt: new Date(),
    };

    // 应用网络策略（模拟 K8s NetworkPolicy API 调用）
    await this.infrastructureService.isolateSandbox(name);

    logger.info({ sandboxId: name, namespace, policyId: policy.id }, 'Sandbox network created');
    return sandbox;
  }

  // ==========================================================================
  // Isolation Management
  // ==========================================================================

  /**
   * 隔离指定环境，应用网络策略阻断所有流量
   *
   * @param envId - 环境 ID
   * @returns 沙箱信息
   */
  async isolateEnvironment(envId: string): Promise<SandboxInfo> {
    logger.info({ envId }, 'Isolating environment');

    const sandbox = await this.infrastructureService.isolateSandbox(envId);

    logger.info({ envId, namespace: sandbox.namespace, status: sandbox.isolationStatus }, 'Environment isolated');
    return sandbox;
  }

  /**
   * 阻断指定环境的所有入站和出站流量
   *
   * @param envId - 环境 ID
   * @returns 沙箱信息
   */
  async blockAll(envId: string): Promise<SandboxInfo> {
    logger.info({ envId }, 'Blocking all traffic');

    // 先确保沙箱存在
    let sandbox = this.infrastructureService.getSandbox(envId);
    if (!sandbox) {
      sandbox = await this.infrastructureService.isolateSandbox(envId);
    }

    // 更新网络策略为完全阻断
    const policies = this.infrastructureService.listNetworkPolicies().filter(p => p.sandboxId === envId);
    for (const policy of policies) {
      // 更新为阻断所有
      policy.ingressRules = [{ name: 'deny-all-ingress', podSelector: {}, allow: false }];
      policy.egressRules = [{ name: 'deny-all-egress', podSelector: {}, allow: false }];
      policy.annotations = { ...policy.annotations, 'orion.io/isolation': 'blocked' };
    }

    sandbox.isolationStatus = SandboxIsolationStatus.Isolated;
    this.infrastructureService.isolateSandbox(envId);

    logger.info({ envId }, 'All traffic blocked');
    return sandbox;
  }

  // ==========================================================================
  // Traffic Management
  // ==========================================================================

  /**
   * 允许两个环境之间的流量
   *
   * @param params - 流量规则参数
   * @returns 创建的或更新的网络策略
   */
  async allowTraffic(params: AllowTrafficParams): Promise<SandboxNetworkPolicy> {
    const { fromEnv, toEnv, ports } = params;

    logger.info({ fromEnv, toEnv, ports }, 'Allowing traffic between environments');

    // 查找源环境的网络策略
    const existingPolicies = this.infrastructureService.listNetworkPolicies().filter(p => p.sandboxId === fromEnv);
    let policy = existingPolicies[0];

    if (!policy) {
      // 创建新策略
      policy = this.infrastructureService.createSandboxNetworkPolicy({
        sandboxId: fromEnv,
        name: `allow-${fromEnv}-to-${toEnv}`,
        namespace: fromEnv,
        labels: { app: fromEnv },
        annotations: { 'orion.io/traffic-allow': `to-${toEnv}` },
        ingressRules: [],
        egressRules: [],
      });
    }

    // 添加允许出站到目标环境的规则
    const allowRule: NetworkPolicyRule = {
      name: `allow-${fromEnv}-to-${toEnv}-${Date.now()}`,
      podSelector: {},
      namespaceSelector: { namespace: toEnv },
      ports,
      allow: true,
    };

    policy.egressRules.push(allowRule);
    policy.updatedAt = new Date();

    // 模拟应用网络策略
    await this.applyTrafficRule(fromEnv, toEnv, ports, true);

    logger.info({ fromEnv, toEnv, ports, policyId: policy.id }, 'Traffic allowed');
    return policy;
  }

  /**
   * 阻断两个环境之间的流量
   *
   * @param fromEnv - 源环境
   * @param toEnv - 目标环境
   * @returns 更新后的网络策略
   */
  async denyTraffic(fromEnv: string, toEnv: string): Promise<SandboxNetworkPolicy | undefined> {
    logger.info({ fromEnv, toEnv }, 'Denying traffic between environments');

    const policies = this.infrastructureService.listNetworkPolicies().filter(p => p.sandboxId === fromEnv);
    const policy = policies[0];

    if (!policy) {
      logger.warn({ fromEnv, toEnv }, 'No policy found for source environment');
      return undefined;
    }

    // 移除允许规则
    policy.egressRules = policy.egressRules.filter(
      rule => !(rule.namespaceSelector?.namespace === toEnv && rule.allow)
    );
    policy.updatedAt = new Date();

    await this.applyTrafficRule(fromEnv, toEnv, [], false);

    logger.info({ fromEnv, toEnv }, 'Traffic denied');
    return policy;
  }

  // ==========================================================================
  // DNS Isolation
  // ==========================================================================

  /**
   * 为沙箱配置隔离的 DNS 解析策略
   *
   * 在沙箱环境中，通过 CoreDNS 配置实现 DNS 级别的隔离：
   * - 只允许解析白名单域名
   * - 阻断外部 DNS 查询（防止数据渗出）
   * - 使用自定义 DNS 转发器（可选）
   *
   * @param sandboxId - 沙箱 ID
   * @param params - DNS 隔离参数
   * @returns 更新后的网络策略
   */
  async configureIsolatedDns(sandboxId: string, params: DnsIsolationParams): Promise<SandboxNetworkPolicy> {
    logger.info({ sandboxId, allowedDomains: params.allowedDomains }, 'Configuring isolated DNS resolution');

    // 查找或创建网络策略
    const existingPolicies = this.infrastructureService.listNetworkPolicies().filter(p => p.sandboxId === sandboxId);
    let policy = existingPolicies[0];

    if (!policy) {
      // 确保沙箱存在
      let sandbox = this.infrastructureService.getSandbox(sandboxId);
      if (!sandbox) {
        sandbox = await this.infrastructureService.isolateSandbox(sandboxId);
      }

      const dnsAnnotations: Record<string, string> = {
        'orion.io/isolation': 'true',
        'orion.io/dns-isolation': 'enforced',
        'orion.io/dns-allowed-domains': params.allowedDomains.join(','),
        'orion.io/dns-timeout': String(params.dnsTimeoutMs ?? 5000),
      };
      if (params.customDnsServers && params.customDnsServers.length > 0) {
        dnsAnnotations['orion.io/dns-servers'] = params.customDnsServers.join(',');
      }

      policy = this.infrastructureService.createSandboxNetworkPolicy({
        sandboxId,
        name: `dns-policy-${sandboxId}`,
        namespace: sandbox.namespace,
        labels: { app: sandboxId },
        annotations: dnsAnnotations,
        ingressRules: [
          { name: 'deny-all-ingress', podSelector: {}, allow: false },
        ],
        egressRules: [
          { name: 'deny-all-egress', podSelector: {}, allow: false },
        ],
      });
    } else {
      // 更新现有策略的 DNS 隔离注解
      policy.annotations = {
        ...policy.annotations,
        'orion.io/dns-isolation': 'enforced',
        'orion.io/dns-allowed-domains': params.allowedDomains.join(','),
        'orion.io/dns-timeout': String(params.dnsTimeoutMs ?? 5000),
      };
      if (params.customDnsServers && params.customDnsServers.length > 0) {
        policy.annotations['orion.io/dns-servers'] = params.customDnsServers.join(',');
      }
      policy.updatedAt = new Date();
    }

    // 模拟应用 DNS 隔离策略（生产环境通过 CoreDNS ConfigMap 实现）
    await this.applyDnsIsolation(sandboxId, params);

    logger.info({ sandboxId, policyId: policy.id, allowedDomains: params.allowedDomains }, 'DNS isolation configured');
    return policy;
  }

  /**
   * 清除沙箱的 DNS 隔离策略
   */
  async clearDnsIsolation(sandboxId: string): Promise<void> {
    const policies = this.infrastructureService.listNetworkPolicies().filter(p => p.sandboxId === sandboxId);
    for (const policy of policies) {
      delete policy.annotations['orion.io/dns-isolation'];
      delete policy.annotations['orion.io/dns-allowed-domains'];
      delete policy.annotations['orion.io/dns-timeout'];
      delete policy.annotations['orion.io/dns-servers'];
      policy.updatedAt = new Date();
    }

    await this.removeDnsIsolation(sandboxId);
    logger.info({ sandboxId }, 'DNS isolation cleared');
  }

  // ==========================================================================
  // Egress Traffic Control
  // ==========================================================================

  /**
   * 配置沙箱的出站流量控制规则
   *
   * @param params - 出站流量控制参数
   * @returns 更新后的网络策略
   */
  async configureEgressTraffic(params: EgressTrafficControlParams): Promise<SandboxNetworkPolicy> {
    const { sandboxId, rules, defaultAction } = params;

    logger.info({ sandboxId, ruleCount: rules.length, defaultAction }, 'Configuring egress traffic control');

    // 查找或创建网络策略
    const existingPolicies = this.infrastructureService.listNetworkPolicies().filter(p => p.sandboxId === sandboxId);
    let policy = existingPolicies[0];

    if (!policy) {
      let sandbox = this.infrastructureService.getSandbox(sandboxId);
      if (!sandbox) {
        sandbox = await this.infrastructureService.isolateSandbox(sandboxId);
      }

      policy = this.infrastructureService.createSandboxNetworkPolicy({
        sandboxId,
        name: `egress-policy-${sandboxId}`,
        namespace: sandbox.namespace,
        labels: { app: sandboxId },
        annotations: {
          'orion.io/isolation': 'true',
          'orion.io/egress-control': 'enforced',
          'orion.io/egress-default': defaultAction,
        },
        ingressRules: [
          { name: 'deny-all-ingress', podSelector: {}, allow: false },
        ],
        egressRules: rules.map(r => ({
          name: r.name,
          podSelector: {},
          namespaceSelector: r.destination ? { namespace: r.destination } : undefined,
          ports: r.ports,
          allow: r.allow,
        })),
      });
    } else {
      // 更新现有策略的出站规则
      policy.egressRules = rules.map(r => ({
        name: r.name,
        podSelector: {},
        namespaceSelector: r.destination ? { namespace: r.destination } : undefined,
        ports: r.ports,
        allow: r.allow,
      }));
      policy.annotations = {
        ...policy.annotations,
        'orion.io/egress-control': 'enforced',
        'orion.io/egress-default': defaultAction,
      };
      policy.updatedAt = new Date();
    }

    // 模拟应用出站流量控制（生产环境通过 NetworkPolicy Egress 规则实现）
    await this.applyEgressTrafficControl(sandboxId, rules, defaultAction);

    logger.info({ sandboxId, policyId: policy.id, ruleCount: rules.length }, 'Egress traffic control configured');
    return policy;
  }

  /**
   * 阻断沙箱的所有出站流量
   */
  async denyAllEgress(sandboxId: string): Promise<SandboxNetworkPolicy> {
    logger.info({ sandboxId }, 'Denying all egress traffic');

    // Always use the most recently created policy for this sandbox
    let policy = this.infrastructureService.listNetworkPolicies()
      .filter(p => p.sandboxId === sandboxId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (!policy) {
      let sandbox = this.infrastructureService.getSandbox(sandboxId);
      if (!sandbox) {
        sandbox = await this.infrastructureService.isolateSandbox(sandboxId);
      }

      policy = this.infrastructureService.createSandboxNetworkPolicy({
        sandboxId,
        name: `egress-deny-all-${sandboxId}`,
        namespace: sandbox.namespace,
        labels: { app: sandboxId },
        annotations: { 'orion.io/isolation': 'true', 'orion.io/egress': 'denied', 'orion.io/egress-default': 'deny' },
        ingressRules: [
          { name: 'deny-all-ingress', podSelector: {}, allow: false },
        ],
        egressRules: [
          { name: 'deny-all-egress', podSelector: {}, allow: false },
        ],
      });
    } else {
      policy.egressRules = [{ name: 'deny-all-egress', podSelector: {}, allow: false }];
      policy.annotations = {
        ...policy.annotations,
        'orion.io/egress': 'denied',
        'orion.io/egress-default': 'deny',
      };
      policy.updatedAt = new Date();
    }

    await this.applyEgressTrafficControl(sandboxId, [], 'deny');

    logger.info({ sandboxId, policyId: policy.id }, 'All egress traffic denied');
    return policy;
  }

  /**
   * 允许沙箱到指定目标的出站流量
   */
  async allowEgressTo(sandboxId: string, destination: string, ports: Array<{ port: number; protocol: 'TCP' | 'UDP' | 'SCTP' }>): Promise<SandboxNetworkPolicy> {
    logger.info({ sandboxId, destination, ports }, 'Allowing egress traffic to destination');

    // Always use the most recently created policy for this sandbox
    let policy = this.infrastructureService.listNetworkPolicies()
      .filter(p => p.sandboxId === sandboxId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (!policy) {
      let sandbox = this.infrastructureService.getSandbox(sandboxId);
      if (!sandbox) {
        sandbox = await this.infrastructureService.isolateSandbox(sandboxId);
      }

      policy = this.infrastructureService.createSandboxNetworkPolicy({
        sandboxId,
        name: `egress-allow-${sandboxId}-${destination}`,
        namespace: sandbox.namespace,
        labels: { app: sandboxId },
        annotations: { 'orion.io/isolation': 'true', 'orion.io/egress': 'controlled', 'orion.io/egress-default': 'deny' },
        ingressRules: [
          { name: 'deny-all-ingress', podSelector: {}, allow: false },
        ],
        egressRules: [
          {
            name: `allow-${destination}-${Date.now()}`,
            podSelector: {},
            namespaceSelector: { namespace: destination },
            ports,
            allow: true,
          },
        ],
      });
    } else {
      // 追加允许规则，不移除现有规则
      const allowRule = {
        name: `allow-${destination}-${Date.now()}`,
        podSelector: {},
        namespaceSelector: { namespace: destination },
        ports,
        allow: true,
      };
      policy.egressRules.push(allowRule);
      policy.annotations = {
        ...policy.annotations,
        'orion.io/egress': 'controlled',
        'orion.io/egress-default': 'deny',
      };
      policy.updatedAt = new Date();
    }

    await this.applyEgressTrafficControl(sandboxId, [{ name: `allow-${destination}`, destination, ports, allow: true }], 'deny');

    logger.info({ sandboxId, destination, ports, policyId: policy.id }, 'Egress traffic allowed to destination');
    return policy;
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * 获取沙箱信息
   */
  getSandbox(sandboxId: string): SandboxInfo | undefined {
    return this.infrastructureService.getSandbox(sandboxId);
  }

  /**
   * 列出所有沙箱
   */
  listSandboxes(): SandboxInfo[] {
    return this.infrastructureService.listSandboxes();
  }

  /**
   * 获取网络策略
   */
  getNetworkPolicy(policyId: string): SandboxNetworkPolicy | undefined {
    return this.infrastructureService.getNetworkPolicy(policyId);
  }

  /**
   * 列出所有网络策略
   */
  listNetworkPolicies(): SandboxNetworkPolicy[] {
    return this.infrastructureService.listNetworkPolicies();
  }

  /**
   * 获取环境隔离状态
   */
  getIsolationStatus(envId: string): SandboxIsolationStatus | undefined {
    const sandbox = this.infrastructureService.getSandbox(envId);
    return sandbox?.isolationStatus;
  }

  // ==========================================================================
  // Internal Helpers
  // ==========================================================================

  /**
   * 应用流量规则（模拟 K8s NetworkPolicy API 调用）
   */
  private async applyTrafficRule(
    fromEnv: string,
    toEnv: string,
    ports: Array<{ port: number; protocol: 'TCP' | 'UDP' | 'SCTP' }>,
    allow: boolean
  ): Promise<void> {
    // 模拟 NetworkPolicy API 调用延迟
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    logger.info(
      {
        fromEnv,
        toEnv,
        ports,
        allow,
      },
      'NetworkPolicy rule applied (simulated)'
    );

    // 生产环境应使用 @kubernetes/client-node 调用:
    // const k8s = new KubeConfig();
    // k8s.loadFromDefault();
    // const k8sApi = k8s.makeApiClient(NetworkingV1Api);
    // await k8sApi.createNamespacedNetworkPolicy(namespace, networkPolicy);
  }

  /**
   * 应用 DNS 隔离策略（模拟 CoreDNS ConfigMap 更新）
   */
  private async applyDnsIsolation(
    sandboxId: string,
    params: DnsIsolationParams
  ): Promise<void> {
    // 模拟 CoreDNS 配置更新延迟
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 150));

    logger.info(
      {
        sandboxId,
        allowedDomains: params.allowedDomains,
        customDnsServers: params.customDnsServers,
        dnsTimeoutMs: params.dnsTimeoutMs ?? 5000,
      },
      'DNS isolation policy applied (simulated CoreDNS ConfigMap update)'
    );

    // 生产环境应使用 @kubernetes/client-node 更新 CoreDNS ConfigMap:
    // const k8s = new KubeConfig();
    // k8s.loadFromDefault();
    // const k8sApi = k8s.makeApiClient(CoreV1Api);
    // await k8sApi.patchNamespacedConfigMap('coredns', 'kube-system', dnsPatch);
  }

  /**
   * 清除 DNS 隔离策略
   */
  private async removeDnsIsolation(sandboxId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    logger.info({ sandboxId }, 'DNS isolation policy removed (simulated)');
  }

  /**
   * 应用出站流量控制规则（模拟 NetworkPolicy Egress 规则）
   */
  private async applyEgressTrafficControl(
    sandboxId: string,
    rules: EgressTrafficRule[],
    defaultAction: 'allow' | 'deny'
  ): Promise<void> {
    // 模拟 NetworkPolicy Egress 规则应用延迟
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 200));

    logger.info(
      {
        sandboxId,
        ruleCount: rules.length,
        defaultAction,
        allowedRules: rules.filter(r => r.allow).length,
        deniedRules: rules.filter(r => !r.allow).length,
      },
      'Egress traffic control applied (simulated NetworkPolicy Egress)'
    );

    // 生产环境应使用 @kubernetes/client-node 创建带 Egress 规则的 NetworkPolicy:
    // const networkPolicy: NetworkPolicy = {
    //   apiVersion: 'networking.k8s.io/v1',
    //   kind: 'NetworkPolicy',
    //   metadata: { name: `egress-${sandboxId}`, namespace: sandboxNamespace },
    //   spec: {
    //     podSelector: { matchLabels: { app: sandboxId } },
    //     policyTypes: ['Egress'],
    //     egress: rules.map(r => ({
    //       to: r.destination ? [{ ipBlock: { cidr: r.destination } }] : [],
    //       ports: r.ports,
    //     })),
    //   },
    // };
  }
}
