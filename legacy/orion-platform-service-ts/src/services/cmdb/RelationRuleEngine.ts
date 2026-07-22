/**
 * CMDB 关系规则引擎
 *
 * 定义和验证 CI 类型间的合法关系组合。
 * 规则采用白名单模式：只有明确定义的组合才允许创建关系。
 *
 * 规则结构：
 *   fromType → toType via relationType
 *   支持通配符 '*' 表示任意类型
 */

import { CiType, RelationType } from './CmdbTypes';

export interface RelationRule {
  fromType: CiType | '*';
  toType: CiType | '*';
  relationType: RelationType;
  allowed: boolean;
  description?: string;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// 所有 CI 类型
const ALL_CI_TYPES: CiType[] = [
  'APPLICATION', 'SERVICE', 'DATABASE', 'SERVER', 'CONTAINER',
  'K8S_CLUSTER', 'K8S_DEPLOYMENT', 'K8S_POD', 'NETWORK',
  'LOAD_BALANCER', 'STORAGE', 'MIDDLEWARE', 'PIPELINE', 'ENVIRONMENT',
];

/**
 * 默认关系规则集
 * 基于 ServiceNow CMDB 最佳实践和 Orion 架构特点
 */
const DEFAULT_RULES: RelationRule[] = [
  // === DEPENDS_ON: 应用/服务依赖 ===
  { fromType: 'APPLICATION', toType: 'SERVICE', relationType: 'DEPENDS_ON', allowed: true, description: '应用依赖服务' },
  { fromType: 'APPLICATION', toType: 'DATABASE', relationType: 'DEPENDS_ON', allowed: true, description: '应用依赖数据库' },
  { fromType: 'APPLICATION', toType: 'MIDDLEWARE', relationType: 'DEPENDS_ON', allowed: true, description: '应用依赖中间件' },
  { fromType: 'SERVICE', toType: 'SERVICE', relationType: 'DEPENDS_ON', allowed: true, description: '服务间依赖' },
  { fromType: 'SERVICE', toType: 'DATABASE', relationType: 'DEPENDS_ON', allowed: true, description: '服务依赖数据库' },
  { fromType: 'SERVICE', toType: 'MIDDLEWARE', relationType: 'DEPENDS_ON', allowed: true, description: '服务依赖中间件' },

  // === HOSTED_ON: 部署关系 ===
  { fromType: 'APPLICATION', toType: 'SERVER', relationType: 'HOSTED_ON', allowed: true, description: '应用部署在服务器上' },
  { fromType: 'APPLICATION', toType: 'CONTAINER', relationType: 'HOSTED_ON', allowed: true, description: '应用运行在容器中' },
  { fromType: 'APPLICATION', toType: 'K8S_DEPLOYMENT', relationType: 'HOSTED_ON', allowed: true, description: '应用部署为 K8s Deployment' },
  { fromType: 'SERVICE', toType: 'SERVER', relationType: 'HOSTED_ON', allowed: true, description: '服务部署在服务器上' },
  { fromType: 'SERVICE', toType: 'CONTAINER', relationType: 'HOSTED_ON', allowed: true, description: '服务运行在容器中' },
  { fromType: 'SERVICE', toType: 'K8S_DEPLOYMENT', relationType: 'HOSTED_ON', allowed: true, description: '服务部署为 K8s Deployment' },
  { fromType: 'DATABASE', toType: 'SERVER', relationType: 'HOSTED_ON', allowed: true, description: '数据库部署在服务器上' },
  { fromType: 'DATABASE', toType: 'CONTAINER', relationType: 'HOSTED_ON', allowed: true, description: '数据库运行在容器中' },
  { fromType: 'MIDDLEWARE', toType: 'SERVER', relationType: 'HOSTED_ON', allowed: true, description: '中间件部署在服务器上' },
  { fromType: 'MIDDLEWARE', toType: 'CONTAINER', relationType: 'HOSTED_ON', allowed: true, description: '中间件运行在容器中' },

  // === CONTAINS: 包含关系 ===
  { fromType: 'K8S_CLUSTER', toType: 'K8S_DEPLOYMENT', relationType: 'CONTAINS', allowed: true, description: 'K8s 集群包含 Deployment' },
  { fromType: 'K8S_CLUSTER', toType: 'K8S_POD', relationType: 'CONTAINS', allowed: true, description: 'K8s 集群包含 Pod' },
  { fromType: 'K8S_DEPLOYMENT', toType: 'K8S_POD', relationType: 'CONTAINS', allowed: true, description: 'Deployment 包含 Pod' },
  { fromType: 'K8S_CLUSTER', toType: 'CONTAINER', relationType: 'CONTAINS', allowed: true, description: 'K8s 集群包含容器' },
  { fromType: 'SERVER', toType: 'CONTAINER', relationType: 'CONTAINS', allowed: true, description: '服务器包含容器' },
  { fromType: 'ENVIRONMENT', toType: 'APPLICATION', relationType: 'CONTAINS', allowed: true, description: '环境包含应用' },
  { fromType: 'ENVIRONMENT', toType: 'SERVICE', relationType: 'CONTAINS', allowed: true, description: '环境包含服务' },
  { fromType: 'ENVIRONMENT', toType: 'DATABASE', relationType: 'CONTAINS', allowed: true, description: '环境包含数据库' },

  // === CONNECTS_TO: 网络连接 ===
  { fromType: 'SERVER', toType: 'SERVER', relationType: 'CONNECTS_TO', allowed: true, description: '服务器间网络连接' },
  { fromType: 'SERVER', toType: 'NETWORK', relationType: 'CONNECTS_TO', allowed: true, description: '服务器连接网络' },
  { fromType: 'LOAD_BALANCER', toType: 'SERVER', relationType: 'CONNECTS_TO', allowed: true, description: '负载均衡连接服务器' },
  { fromType: 'LOAD_BALANCER', toType: 'SERVICE', relationType: 'CONNECTS_TO', allowed: true, description: '负载均衡连接服务' },
  { fromType: 'NETWORK', toType: 'LOAD_BALANCER', relationType: 'CONNECTS_TO', allowed: true, description: '网络连接负载均衡' },

  // === DEPLOYED_TO: 部署目标 ===
  { fromType: 'K8S_DEPLOYMENT', toType: 'K8S_CLUSTER', relationType: 'DEPLOYED_TO', allowed: true, description: 'Deployment 部署到集群' },
  { fromType: 'PIPELINE', toType: 'ENVIRONMENT', relationType: 'DEPLOYED_TO', allowed: true, description: '流水线部署到环境' },
  { fromType: 'APPLICATION', toType: 'ENVIRONMENT', relationType: 'DEPLOYED_TO', allowed: true, description: '应用部署到环境' },

  // === USES: 使用关系 ===
  { fromType: 'APPLICATION', toType: 'STORAGE', relationType: 'USES', allowed: true, description: '应用使用存储' },
  { fromType: 'SERVICE', toType: 'STORAGE', relationType: 'USES', allowed: true, description: '服务使用存储' },
  { fromType: 'DATABASE', toType: 'STORAGE', relationType: 'USES', allowed: true, description: '数据库使用存储' },
  { fromType: 'APPLICATION', toType: 'PIPELINE', relationType: 'USES', allowed: true, description: '应用使用流水线' },
  { fromType: 'SERVICE', toType: 'PIPELINE', relationType: 'USES', allowed: true, description: '服务使用流水线' },

  // === MONITORED_BY: 监控关系 ===
  { fromType: '*', toType: 'APPLICATION', relationType: 'MONITORED_BY', allowed: true, description: '任意类型可被应用监控' },
  { fromType: '*', toType: 'SERVICE', relationType: 'MONITORED_BY', allowed: true, description: '任意类型可被服务监控' },

  // === VERSION_OF: 版本关系 ===
  { fromType: 'APPLICATION', toType: 'APPLICATION', relationType: 'VERSION_OF', allowed: true, description: '应用版本关系' },
  { fromType: 'SERVICE', toType: 'SERVICE', relationType: 'VERSION_OF', allowed: true, description: '服务版本关系' },

  // === BELONGS_TO: 归属关系 ===
  { fromType: 'APPLICATION', toType: 'SERVICE', relationType: 'BELONGS_TO', allowed: true, description: '应用归属服务' },
  { fromType: 'SERVER', toType: 'NETWORK', relationType: 'BELONGS_TO', allowed: true, description: '服务器归属网络' },
  { fromType: 'CONTAINER', toType: 'SERVER', relationType: 'BELONGS_TO', allowed: true, description: '容器归属服务器' },
  { fromType: 'K8S_POD', toType: 'K8S_DEPLOYMENT', relationType: 'BELONGS_TO', allowed: true, description: 'Pod 归属 Deployment' },
];

export class RelationRuleEngine {
  private rules: RelationRule[];

  constructor(rules?: RelationRule[]) {
    this.rules = rules || DEFAULT_RULES;
  }

  /**
   * 验证关系是否合法
   */
  validate(fromType: CiType, toType: CiType, relationType: RelationType): ValidationResult {
    // 查找匹配的规则（精确匹配优先于通配符）
    const matchingRule = this.rules.find(rule => {
      const fromMatch = rule.fromType === fromType || rule.fromType === '*';
      const toMatch = rule.toType === toType || rule.toType === '*';
      const typeMatch = rule.relationType === relationType;
      return fromMatch && toMatch && typeMatch;
    });

    if (!matchingRule) {
      // 没有匹配规则时，默认拒绝
      return {
        valid: false,
        reason: `No rule defined for relation: ${fromType} -[${relationType}]-> ${toType}`,
      };
    }

    if (!matchingRule.allowed) {
      return {
        valid: false,
        reason: matchingRule.description || `Relation not allowed: ${fromType} -[${relationType}]-> ${toType}`,
      };
    }

    return { valid: true };
  }

  /**
   * 获取指定 CI 类型的所有合法关系
   */
  getAllowedRelations(fromType: CiType): RelationRule[] {
    return this.rules.filter(rule => {
      const fromMatch = rule.fromType === fromType || rule.fromType === '*';
      return fromMatch && rule.allowed;
    });
  }

  /**
   * 获取指定 CI 类型作为目标时的所有合法关系
   */
  getAllowedIncomingRelations(toType: CiType): RelationRule[] {
    return this.rules.filter(rule => {
      const toMatch = rule.toType === toType || rule.toType === '*';
      return toMatch && rule.allowed;
    });
  }

  /**
   * 添加自定义规则
   */
  addRule(rule: RelationRule): void {
    this.rules.push(rule);
  }

  /**
   * 批量添加规则
   */
  addRules(rules: RelationRule[]): void {
    this.rules.push(...rules);
  }

  /**
   * 获取所有规则
   */
  getRules(): RelationRule[] {
    return [...this.rules];
  }
}
