/**
 * 诊断决策树实现
 *
 * 基于树结构的诊断流程，通过症状评估逐步缩小根因范围
 */

import { v4 as uuidv4 } from 'uuid';
import { Symptom, SymptomSeverity, DiagnosticCategory, RootCause, RootCauseCategory, RecommendedAction, FixComplexity } from './types';

// ==================== 决策树节点类型 ====================

/**
 * 条件操作符
 */
export type ConditionOperator = 'equals' | 'contains' | 'gte' | 'lte' | 'regex' | 'any_of';

/**
 * 决策树节点条件
 */
export interface DecisionCondition {
  /** 检查的症状字段 */
  field: 'type' | 'source' | 'severity' | 'description' | 'metadata';
  /** 操作符 */
  operator: ConditionOperator;
  /** 比较值 */
  value: any;
}

/**
 * 决策树分支
 */
export interface DecisionBranch {
  /** 分支 ID */
  id: string;
  /** 分支名称 */
  name: string;
  /** 条件列表（AND 关系） */
  conditions: DecisionCondition[];
  /** 子节点 */
  children: DecisionTreeNode;
  /** 推荐检查项 */
  recommendedChecks?: string[];
}

/**
 * 决策树节点
 */
export interface DecisionTreeNode {
  /** 节点 ID */
  id: string;
  /** 节点名称 */
  name: string;
  /** 节点描述 */
  description: string;
  /** 是否为叶子节点 */
  isLeaf: boolean;
  /** 分支列表 */
  branches: DecisionBranch[];
  /** 叶子节点时的根因 */
  rootCause?: RootCause;
  /** 默认分支（无匹配时使用） */
  defaultBranch?: DecisionBranch;
}

/**
 * 决策树评估结果
 */
export interface DecisionTreeResult {
  /** 匹配的路径 */
  path: string[];
  /** 最终节点 */
  node: DecisionTreeNode;
  /** 根因（如果是叶子节点） */
  rootCause: RootCause | null;
  /** 推荐检查项 */
  recommendedChecks: string[];
  /** 匹配的分支 */
  matchedBranches: DecisionBranch[];
}

// ==================== 决策树构建工具 ====================

/**
 * 诊断决策树构建器
 */
export class DiagnosticDecisionTree {
  private root: DecisionTreeNode;
  private nodes: Map<string, DecisionTreeNode>;

  constructor() {
    this.root = {
      id: 'root',
      name: 'Diagnosis Root',
      description: 'Start of diagnostic procedure',
      isLeaf: false,
      branches: [],
    };
    this.nodes = new Map();
    this.nodes.set('root', this.root);
  }

  /**
   * 获取根节点
   */
  getRoot(): DecisionTreeNode {
    return this.root;
  }

  /**
   * 添加分支到指定节点
   */
  addBranch(
    parentId: string,
    branch: {
      name: string;
      conditions: DecisionCondition[];
      recommendedChecks?: string[];
      childNode?: {
        name: string;
        description: string;
        isLeaf: boolean;
        rootCause?: RootCause;
      };
    }
  ): string {
    const parent = this.nodes.get(parentId);
    if (!parent) {
      throw new Error(`Parent node ${parentId} not found`);
    }

    const childId = uuidv4();
    const branchId = uuidv4();

    let childNode: DecisionTreeNode;

    if (branch.childNode) {
      childNode = {
        id: childId,
        name: branch.childNode.name,
        description: branch.childNode.description,
        isLeaf: branch.childNode.isLeaf,
        branches: [],
        rootCause: branch.childNode.rootCause,
      };
      this.nodes.set(childId, childNode);
    } else {
      childNode = {
        id: childId,
        name: `${branch.name} - Next`,
        description: '',
        isLeaf: false,
        branches: [],
      };
      this.nodes.set(childId, childNode);
    }

    const decisionBranch: DecisionBranch = {
      id: branchId,
      name: branch.name,
      conditions: branch.conditions,
      children: childNode,
      recommendedChecks: branch.recommendedChecks,
    };

    parent.branches.push(decisionBranch);
    return childId;
  }

  /**
   * 设置默认分支
   */
  setDefaultBranch(
    parentId: string,
    branch: {
      name: string;
      recommendedChecks?: string[];
      childNode?: {
        name: string;
        description: string;
        isLeaf: boolean;
        rootCause?: RootCause;
      };
    }
  ): string {
    const parent = this.nodes.get(parentId);
    if (!parent) {
      throw new Error(`Parent node ${parentId} not found`);
    }

    const childId = uuidv4();

    let childNode: DecisionTreeNode;

    if (branch.childNode) {
      childNode = {
        id: childId,
        name: branch.childNode.name,
        description: branch.childNode.description,
        isLeaf: branch.childNode.isLeaf,
        branches: [],
        rootCause: branch.childNode.rootCause,
      };
      this.nodes.set(childId, childNode);
    } else {
      childNode = {
        id: childId,
        name: `${branch.name} - Next`,
        description: '',
        isLeaf: false,
        branches: [],
      };
      this.nodes.set(childId, childNode);
    }

    parent.defaultBranch = {
      id: uuidv4(),
      name: branch.name,
      conditions: [],
      children: childNode,
      recommendedChecks: branch.recommendedChecks,
    };

    return childId;
  }

  /**
   * 评估症状，遍历决策树
   */
  evaluate(symptoms: Symptom[]): DecisionTreeResult {
    const path: string[] = [];
    const matchedBranches: DecisionBranch[] = [];
    const allChecks: string[] = [];
    let currentNode = this.root;

    path.push(currentNode.name);

    // 最多遍历 20 层防止无限循环
    for (let depth = 0; depth < 20; depth++) {
      if (currentNode.isLeaf) {
        return {
          path,
          node: currentNode,
          rootCause: currentNode.rootCause || null,
          recommendedChecks: allChecks,
          matchedBranches,
        };
      }

      // 查找匹配的分支
      let matchedBranch: DecisionBranch | undefined;
      for (const branch of currentNode.branches) {
        if (this.conditionsMatch(branch.conditions, symptoms)) {
          matchedBranch = branch;
          break;
        }
      }

      if (matchedBranch) {
        path.push(matchedBranch.name);
        matchedBranches.push(matchedBranch);
        if (matchedBranch.recommendedChecks) {
          allChecks.push(...matchedBranch.recommendedChecks);
        }
        currentNode = matchedBranch.children;
      } else if (currentNode.defaultBranch) {
        path.push(`Default: ${currentNode.defaultBranch.name}`);
        if (currentNode.defaultBranch.recommendedChecks) {
          allChecks.push(...currentNode.defaultBranch.recommendedChecks);
        }
        currentNode = currentNode.defaultBranch.children;
      } else {
        // 无匹配分支且无默认分支，终止
        break;
      }
    }

    // 达到最大深度，返回当前节点
    return {
      path,
      node: currentNode,
      rootCause: currentNode.rootCause || null,
      recommendedChecks: allChecks,
      matchedBranches,
    };
  }

  /**
   * 获取推荐检查项
   */
  getRecommendedChecks(symptoms: Symptom[]): string[] {
    const result = this.evaluate(symptoms);
    return result.recommendedChecks;
  }

  /**
   * 获取所有叶子节点的根因
   */
  getAllRootCauses(): RootCause[] {
    const rootCauses: RootCause[] = [];
    for (const node of this.nodes.values()) {
      if (node.isLeaf && node.rootCause) {
        rootCauses.push(node.rootCause);
      }
    }
    return rootCauses;
  }

  /**
   * 获取节点数量
   */
  getNodeCount(): number {
    return this.nodes.size;
  }

  // ==================== 私有方法 ====================

  /**
   * 检查条件是否匹配症状
   */
  private conditionsMatch(conditions: DecisionCondition[], symptoms: Symptom[]): boolean {
    // 所有条件都必须满足 (AND 关系)
    return conditions.every((condition) => {
      return symptoms.some((symptom) => this.conditionMatchesSymptom(condition, symptom));
    });
  }

  /**
   * 检查单个条件是否匹配症状
   */
  private conditionMatchesSymptom(condition: DecisionCondition, symptom: Symptom): boolean {
    let fieldValue: any;

    switch (condition.field) {
      case 'type':
        fieldValue = symptom.type;
        break;
      case 'source':
        fieldValue = symptom.source;
        break;
      case 'severity':
        fieldValue = symptom.severity;
        break;
      case 'description':
        fieldValue = symptom.description;
        break;
      case 'metadata':
        fieldValue = symptom.metadata;
        break;
      default:
        return false;
    }

    return this.evaluateCondition(fieldValue, condition);
  }

  /**
   * 评估单个条件
   */
  private evaluateCondition(value: any, condition: DecisionCondition): boolean {
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;

      case 'contains':
        if (typeof value !== 'string') return false;
        return value.toLowerCase().includes(String(condition.value).toLowerCase());

      case 'gte': {
        const severityOrder: Record<string, number> = {
          info: 0,
          warning: 1,
          error: 2,
          critical: 3,
        };
        const valLevel = severityOrder[value] ?? 0;
        const condLevel = severityOrder[condition.value] ?? 0;
        return valLevel >= condLevel;
      }

      case 'lte': {
        const severityOrderLte: Record<string, number> = {
          info: 0,
          warning: 1,
          error: 2,
          critical: 3,
        };
        const valLevel = severityOrderLte[value] ?? 0;
        const condLevel = severityOrderLte[condition.value] ?? 0;
        return valLevel <= condLevel;
      }

      case 'regex':
        if (typeof value !== 'string') return false;
        try {
          return new RegExp(condition.value).test(value);
        } catch {
          return false;
        }

      case 'any_of':
        if (Array.isArray(condition.value)) {
          return condition.value.includes(value);
        }
        return value === condition.value;

      default:
        return false;
    }
  }
}

/**
 * 创建默认诊断决策树
 *
 * 内置常见故障的诊断流程
 */
export function createDefaultDiagnosticDecisionTree(): DiagnosticDecisionTree {
  const tree = new DiagnosticDecisionTree();

  // ==================== 第一层：按症状类别分类 ====================

  // 分支：部署相关症状
  const deployNodeId = tree.addBranch('root', {
    name: 'Check Deployment Issues',
    conditions: [
      { field: 'type', operator: 'equals', value: 'deployment_failure' },
    ],
    recommendedChecks: ['Check deployment logs', 'Verify container status', 'Check resource quotas'],
    childNode: {
      name: 'Deployment Issues',
      description: 'Investigating deployment-related failures',
      isLeaf: false,
    },
  });

  // 部署失败 -> 容器启动失败
  tree.addBranch(deployNodeId, {
    name: 'Container Start Failure',
    conditions: [
      { field: 'description', operator: 'contains', value: 'CrashLoopBackOff' },
    ],
    recommendedChecks: ['Check container logs', 'Verify image pull policy', 'Check liveness probe config'],
    childNode: {
      name: 'Container Start Failure',
      description: 'Container is failing to start or crashing immediately',
      isLeaf: true,
      rootCause: {
        description: 'Container CrashLoopBackOff - likely due to application startup error, missing config, or failed health check',
        category: 'deployment',
        confidence: 75,
        evidence: ['Container status shows CrashLoopBackOff', 'Repeated restart attempts detected'],
        recommendedActions: [
          {
            description: 'Check container logs for startup errors',
            actionType: 'investigate',
            priority: 'critical',
            estimatedTimeMs: 300000,
            automationLevel: 'semi_auto',
            commands: ['kubectl logs <pod-name> --previous'],
          },
          {
            description: 'Verify environment variables and config maps',
            actionType: 'investigate',
            priority: 'high',
            estimatedTimeMs: 180000,
            automationLevel: 'manual',
          },
          {
            description: 'Check liveness and readiness probe configuration',
            actionType: 'investigate',
            priority: 'high',
            estimatedTimeMs: 120000,
            automationLevel: 'semi_auto',
            commands: ['kubectl describe pod <pod-name>'],
          },
        ],
      },
    },
  });

  // 部署失败 -> 镜像拉取失败
  tree.addBranch(deployNodeId, {
    name: 'Image Pull Failure',
    conditions: [
      { field: 'description', operator: 'contains', value: 'ImagePullBackOff' },
    ],
    recommendedChecks: ['Check image registry access', 'Verify image tag exists', 'Check pull secrets'],
    childNode: {
      name: 'Image Pull Failure',
      description: 'Container image cannot be pulled from registry',
      isLeaf: true,
      rootCause: {
        description: 'ImagePullBackOff - image not found or authentication failure',
        category: 'deployment',
        confidence: 85,
        evidence: ['Container status shows ImagePullBackOff', 'Image pull attempts failed'],
        recommendedActions: [
          {
            description: 'Verify image name and tag exist in registry',
            actionType: 'investigate',
            priority: 'critical',
            estimatedTimeMs: 120000,
            automationLevel: 'semi_auto',
          },
          {
            description: 'Check image pull secrets are configured correctly',
            actionType: 'investigate',
            priority: 'high',
            estimatedTimeMs: 180000,
            automationLevel: 'manual',
            commands: ['kubectl get secrets', 'kubectl describe pod <pod-name>'],
          },
          {
            description: 'Fix image reference and redeploy',
            actionType: 'fix',
            priority: 'critical',
            estimatedTimeMs: 300000,
            automationLevel: 'semi_auto',
          },
        ],
      },
    },
  });

  // 部署失败 -> 资源不足
  tree.addBranch(deployNodeId, {
    name: 'Insufficient Resources',
    conditions: [
      { field: 'description', operator: 'contains', value: 'Insufficient' },
    ],
    recommendedChecks: ['Check cluster resource usage', 'Review resource quotas', 'Check node capacity'],
    childNode: {
      name: 'Insufficient Resources',
      description: 'Cluster does not have enough resources for deployment',
      isLeaf: true,
      rootCause: {
        description: 'Insufficient cluster resources (CPU/memory) for deployment',
        category: 'infrastructure',
        confidence: 80,
        evidence: ['Scheduler reports Insufficient cpu/memory', 'Node resource utilization is high'],
        recommendedActions: [
          {
            description: 'Review current resource allocation and usage',
            actionType: 'investigate',
            priority: 'high',
            estimatedTimeMs: 180000,
            automationLevel: 'semi_auto',
            commands: ['kubectl top nodes', 'kubectl top pods'],
          },
          {
            description: 'Scale cluster or reduce resource requests',
            actionType: 'scale',
            priority: 'critical',
            estimatedTimeMs: 600000,
            automationLevel: 'semi_auto',
          },
        ],
      },
    },
  });

  // 部署失败 -> 默认
  tree.setDefaultBranch(deployNodeId, {
    name: 'Other Deployment Issue',
    recommendedChecks: ['Review deployment manifest', 'Check cluster events', 'Verify namespace config'],
    childNode: {
      name: 'Unknown Deployment Issue',
      description: 'Deployment failure not matching known patterns',
      isLeaf: true,
      rootCause: {
        description: 'Unknown deployment failure - manual investigation required',
        category: 'deployment',
        confidence: 40,
        evidence: ['Deployment failed', 'No matching diagnostic pattern found'],
        recommendedActions: [
          {
            description: 'Review full deployment logs and events',
            actionType: 'investigate',
            priority: 'high',
            estimatedTimeMs: 600000,
            automationLevel: 'manual',
          },
        ],
      },
    },
  });

  // 分支：Pipeline 相关症状
  const pipelineNodeId = tree.addBranch('root', {
    name: 'Check Pipeline Issues',
    conditions: [
      { field: 'type', operator: 'equals', value: 'pipeline_failure' },
    ],
    recommendedChecks: ['Check pipeline logs', 'Verify stage configurations', 'Check runner availability'],
    childNode: {
      name: 'Pipeline Issues',
      description: 'Investigating pipeline-related failures',
      isLeaf: false,
    },
  });

  // Pipeline 失败 -> 测试失败
  tree.addBranch(pipelineNodeId, {
    name: 'Test Failures',
    conditions: [
      { field: 'type', operator: 'equals', value: 'test_failure' },
    ],
    recommendedChecks: ['Review test output', 'Check test environment', 'Verify dependencies'],
    childNode: {
      name: 'Test Failures',
      description: 'Pipeline failed due to test failures',
      isLeaf: true,
      rootCause: {
        description: 'Pipeline test stage failed - application code or test environment issue',
        category: 'application',
        confidence: 70,
        evidence: ['Test stage reported failures', 'Test output shows assertion errors'],
        recommendedActions: [
          {
            description: 'Review test output and failing test cases',
            actionType: 'investigate',
            priority: 'high',
            estimatedTimeMs: 300000,
            automationLevel: 'semi_auto',
          },
          {
            description: 'Fix failing tests and re-run pipeline',
            actionType: 'fix',
            priority: 'high',
            estimatedTimeMs: 900000,
            automationLevel: 'manual',
          },
        ],
      },
    },
  });

  // Pipeline 失败 -> Runner 不可用
  tree.addBranch(pipelineNodeId, {
    name: 'Runner Unavailable',
    conditions: [
      { field: 'description', operator: 'contains', value: 'runner' },
      { field: 'severity', operator: 'gte', value: 'error' },
    ],
    recommendedChecks: ['Check runner status', 'Verify runner registration', 'Check runner resource usage'],
    childNode: {
      name: 'Runner Unavailable',
      description: 'Pipeline runner is not available or not responding',
      isLeaf: true,
      rootCause: {
        description: 'Pipeline runner unavailable - runner may be offline, overloaded, or misconfigured',
        category: 'infrastructure',
        confidence: 75,
        evidence: ['Pipeline stuck waiting for runner', 'Runner status shows offline or busy'],
        recommendedActions: [
          {
            description: 'Check runner registration and status',
            actionType: 'investigate',
            priority: 'high',
            estimatedTimeMs: 180000,
            automationLevel: 'semi_auto',
          },
          {
            description: 'Restart or re-register the runner',
            actionType: 'restart',
            priority: 'high',
            estimatedTimeMs: 300000,
            automationLevel: 'semi_auto',
          },
        ],
      },
    },
  });

  // Pipeline 失败 -> 默认
  tree.setDefaultBranch(pipelineNodeId, {
    name: 'Other Pipeline Issue',
    recommendedChecks: ['Review full pipeline log', 'Check stage configurations', 'Verify environment variables'],
    childNode: {
      name: 'Unknown Pipeline Issue',
      description: 'Pipeline failure not matching known patterns',
      isLeaf: true,
      rootCause: {
        description: 'Unknown pipeline failure - manual investigation required',
        category: 'pipeline',
        confidence: 35,
        evidence: ['Pipeline failed', 'No matching diagnostic pattern found'],
        recommendedActions: [
          {
            description: 'Review full pipeline execution log',
            actionType: 'investigate',
            priority: 'high',
            estimatedTimeMs: 600000,
            automationLevel: 'manual',
          },
        ],
      },
    },
  });

  // 分支：基础设施症状
  const infraNodeId = tree.addBranch('root', {
    name: 'Check Infrastructure Issues',
    conditions: [
      { field: 'type', operator: 'any_of', value: ['node_failure', 'resource_exhaustion', 'network_issue'] },
    ],
    recommendedChecks: ['Check node health', 'Review resource utilization', 'Check network connectivity'],
    childNode: {
      name: 'Infrastructure Issues',
      description: 'Investigating infrastructure-related failures',
      isLeaf: false,
    },
  });

  // 基础设施 -> 磁盘已满
  tree.addBranch(infraNodeId, {
    name: 'Disk Full',
    conditions: [
      { field: 'description', operator: 'contains', value: 'disk' },
      { field: 'description', operator: 'contains', value: 'full' },
    ],
    recommendedChecks: ['Check disk usage', 'Identify large files', 'Review log rotation'],
    childNode: {
      name: 'Disk Full',
      description: 'Node disk is full or nearly full',
      isLeaf: true,
      rootCause: {
        description: 'Disk space exhausted - likely due to log accumulation or large file generation',
        category: 'infrastructure',
        confidence: 85,
        evidence: ['Disk usage above 90%', 'Services failing to write'],
        recommendedActions: [
          {
            description: 'Identify and clean up large files and old logs',
            actionType: 'fix',
            priority: 'critical',
            estimatedTimeMs: 300000,
            automationLevel: 'semi_auto',
            commands: ['df -h', 'du -sh /* | sort -rh | head -20'],
          },
          {
            description: 'Configure log rotation and retention policies',
            actionType: 'fix',
            priority: 'medium',
            estimatedTimeMs: 600000,
            automationLevel: 'manual',
          },
        ],
      },
    },
  });

  // 基础设施 -> 默认
  tree.setDefaultBranch(infraNodeId, {
    name: 'Other Infrastructure Issue',
    recommendedChecks: ['Check system metrics', 'Review recent changes', 'Verify network connectivity'],
    childNode: {
      name: 'Unknown Infrastructure Issue',
      description: 'Infrastructure failure not matching known patterns',
      isLeaf: true,
      rootCause: {
        description: 'Unknown infrastructure failure - manual investigation required',
        category: 'infrastructure',
        confidence: 30,
        evidence: ['Infrastructure issue detected', 'No matching diagnostic pattern found'],
        recommendedActions: [
          {
            description: 'Review system metrics and recent changes',
            actionType: 'investigate',
            priority: 'high',
            estimatedTimeMs: 900000,
            automationLevel: 'manual',
          },
        ],
      },
    },
  });

  // 分支：数据库症状
  const dbNodeId = tree.addBranch('root', {
    name: 'Check Database Issues',
    conditions: [
      { field: 'type', operator: 'any_of', value: ['database_error', 'connection_timeout', 'query_failure'] },
    ],
    recommendedChecks: ['Check database connectivity', 'Review query performance', 'Check connection pool'],
    childNode: {
      name: 'Database Issues',
      description: 'Investigating database-related failures',
      isLeaf: false,
    },
  });

  // 数据库 -> 连接超时
  tree.addBranch(dbNodeId, {
    name: 'Connection Timeout',
    conditions: [
      { field: 'description', operator: 'contains', value: 'timeout' },
    ],
    recommendedChecks: ['Check database server status', 'Review connection pool config', 'Check network latency'],
    childNode: {
      name: 'Database Connection Timeout',
      description: 'Database connection timeout detected',
      isLeaf: true,
      rootCause: {
        description: 'Database connection timeout - likely due to connection pool exhaustion, network issue, or database overload',
        category: 'database',
        confidence: 70,
        evidence: ['Connection timeout errors detected', 'Slow query log may show issues'],
        recommendedActions: [
          {
            description: 'Check database server status and load',
            actionType: 'investigate',
            priority: 'critical',
            estimatedTimeMs: 180000,
            automationLevel: 'semi_auto',
          },
          {
            description: 'Increase connection pool size if needed',
            actionType: 'fix',
            priority: 'high',
            estimatedTimeMs: 300000,
            automationLevel: 'semi_auto',
          },
          {
            description: 'Review and optimize slow queries',
            actionType: 'investigate',
            priority: 'medium',
            estimatedTimeMs: 900000,
            automationLevel: 'manual',
          },
        ],
      },
    },
  });

  // 数据库 -> 默认
  tree.setDefaultBranch(dbNodeId, {
    name: 'Other Database Issue',
    recommendedChecks: ['Check database logs', 'Review recent migrations', 'Verify replication status'],
    childNode: {
      name: 'Unknown Database Issue',
      description: 'Database failure not matching known patterns',
      isLeaf: true,
      rootCause: {
        description: 'Unknown database failure - manual investigation required',
        category: 'database',
        confidence: 35,
        evidence: ['Database issue detected', 'No matching diagnostic pattern found'],
        recommendedActions: [
          {
            description: 'Review database logs and recent changes',
            actionType: 'investigate',
            priority: 'high',
            estimatedTimeMs: 600000,
            automationLevel: 'manual',
          },
        ],
      },
    },
  });

  // 默认分支 - 未知症状
  tree.setDefaultBranch('root', {
    name: 'Unknown Issue Type',
    recommendedChecks: ['Collect system logs', 'Check recent changes', 'Review monitoring alerts'],
    childNode: {
      name: 'General Diagnosis',
      description: 'General diagnostic procedure for unrecognized issues',
      isLeaf: true,
      rootCause: {
        description: 'Unrecognized issue pattern - requires manual investigation',
        category: 'unknown',
        confidence: 20,
        evidence: ['Symptoms do not match any known pattern'],
        recommendedActions: [
          {
            description: 'Collect all relevant logs and metrics',
            actionType: 'investigate',
            priority: 'high',
            estimatedTimeMs: 600000,
            automationLevel: 'manual',
          },
          {
            description: 'Check recent deployments and configuration changes',
            actionType: 'investigate',
            priority: 'high',
            estimatedTimeMs: 300000,
            automationLevel: 'manual',
          },
        ],
      },
    },
  });

  return tree;
}
