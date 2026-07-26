// orion-ai-svc/src/services/IntentClassifier.ts

import { AIGateway } from './AIGateway';

export type Intent =
  | 'query_metrics'
  | 'query_logs'
  | 'deploy'
  | 'rollback'
  | 'scale'
  | 'diagnose'
  | 'get_status'
  | 'create_ticket'
  | 'ack_alert'
  | 'explain_error'
  | 'general_chat';

export interface IntentResult {
  intent: Intent;
  confidence: number;
  entities: Record<string, string>;
  suggestedActions: string[];
  response?: string;
}

const INTENT_EXAMPLES: Record<Intent, string[]> = {
  query_metrics: ['查询 CPU 使用率', '显示内存趋势', 'QPS 是多少'],
  query_logs: ['查看错误日志', '最近有什么异常', '搜索 access 日志'],
  deploy: ['部署应用到生产', '发布新版本', '开始部署'],
  rollback: ['回滚到上一个版本', '撤销部署', '回滚'],
  scale: ['扩容到 10 个实例', '增加副本数', '扩大容量'],
  diagnose: ['诊断服务问题', '分析性能瓶颈', '检查健康状态'],
  get_status: ['服务状态怎么样', '查看部署状态', '当前状态'],
  create_ticket: ['创建一个工单', '提一个问题', '需要人工处理'],
  ack_alert: ['确认告警', '已收到通知', '处理告警'],
  explain_error: ['解释这个错误', '为什么会失败', '错误原因'],
  general_chat: ['你好', '今天怎么样', '帮忙'],
};

const ENTITY_PATTERNS: Record<string, RegExp> = {
  service: /(?:服务|service|应用|app)\s*[:：]?\s*(\S+)/i,
  environment: /(?:环境|env)\s*[:：]?(prod|production|staging|dev|development|test)/i,
  version: /(?:版本|version|v)\s*[:：]?(\S+)/i,
  time: /(?:最近|过去|since|from)\s*(\d+[mhwd])/i,
};

export class IntentClassifier {
  private aiGateway: AIGateway;

  constructor(aiGateway: AIGateway) {
    this.aiGateway = aiGateway;
  }

  async classify(userInput: string, context?: Record<string, string>): Promise<IntentResult> {
    const systemPrompt = `你是一个运维意图分类器。根据用户输入的自然语言，识别其运维意图。

可用意图类型：
- query_metrics: 查询指标数据（CPU、内存、QPS等）
- query_logs: 查询日志
- deploy: 部署应用
- rollback: 回滚部署
- scale: 扩容/缩容
- diagnose: 诊断问题
- get_status: 查看状态
- create_ticket: 创建工单
- ack_alert: 确认告警
- explain_error: 解释错误
- general_chat: 闲聊/一般问答

请返回 JSON 格式：
{
  "intent": "意图类型",
  "confidence": 0.0-1.0,
  "entities": {"key": "value"},
  "suggestedActions": ["建议操作1", "建议操作2"]
}`;

    try {
      const response = await this.aiGateway.execute({
        scenario: 'chatops_intent',
        input: {
          prompt: `用户输入: ${userInput}\n上下文: ${JSON.stringify(context || {})}`,
          systemPrompt,
        },
        options: { timeout: 10000 },
        context: { traceId: crypto.randomUUID() },
      });

      const result = JSON.parse(response.data as string);
      return {
        intent: result.intent as Intent,
        confidence: result.confidence || 0.5,
        entities: result.entities || {},
        suggestedActions: result.suggestedActions || [],
      };
    } catch {
      return this.ruleBasedClassification(userInput);
    }
  }

  private ruleBasedClassification(userInput: string): IntentResult {
    const lowerInput = userInput.toLowerCase();

    if (lowerInput.includes('查询') || lowerInput.includes('显示') || lowerInput.includes('指标') || lowerInput.includes('cpu') || lowerInput.includes('内存') || lowerInput.includes('qps')) {
      return { intent: 'query_metrics', confidence: 0.6, entities: this.extractEntities(userInput), suggestedActions: ['查看指标'] };
    }
    if (lowerInput.includes('日志') || lowerInput.includes('错误') || lowerInput.includes('异常') || lowerInput.includes('log')) {
      return { intent: 'query_logs', confidence: 0.6, entities: this.extractEntities(userInput), suggestedActions: ['查看日志'] };
    }
    if (lowerInput.includes('部署') || lowerInput.includes('发布') || lowerInput.includes('deploy')) {
      return { intent: 'deploy', confidence: 0.6, entities: this.extractEntities(userInput), suggestedActions: ['开始部署'] };
    }
    if (lowerInput.includes('回滚') || lowerInput.includes('撤销') || lowerInput.includes('rollback')) {
      return { intent: 'rollback', confidence: 0.6, entities: this.extractEntities(userInput), suggestedActions: ['确认回滚'] };
    }
    if (lowerInput.includes('扩容') || lowerInput.includes('缩容') || lowerInput.includes('副本') || lowerInput.includes('scale')) {
      return { intent: 'scale', confidence: 0.6, entities: this.extractEntities(userInput), suggestedActions: ['调整实例数'] };
    }
    if (lowerInput.includes('诊断') || lowerInput.includes('分析') || lowerInput.includes('检查') || lowerInput.includes('diagnose')) {
      return { intent: 'diagnose', confidence: 0.6, entities: this.extractEntities(userInput), suggestedActions: ['运行诊断'] };
    }
    if (lowerInput.includes('状态') || lowerInput.includes('怎么样') || lowerInput.includes('status')) {
      return { intent: 'get_status', confidence: 0.6, entities: this.extractEntities(userInput), suggestedActions: ['查看状态'] };
    }
    if (lowerInput.includes('工单') || lowerInput.includes('创建') || lowerInput.includes('ticket')) {
      return { intent: 'create_ticket', confidence: 0.6, entities: {}, suggestedActions: ['创建工单'] };
    }
    if (lowerInput.includes('告警') || lowerInput.includes('确认') || lowerInput.includes('alert')) {
      return { intent: 'ack_alert', confidence: 0.6, entities: {}, suggestedActions: ['确认告警'] };
    }
    if (lowerInput.includes('错误') || lowerInput.includes('失败') || lowerInput.includes('原因') || lowerInput.includes('error')) {
      return { intent: 'explain_error', confidence: 0.6, entities: {}, suggestedActions: ['分析错误'] };
    }

    return { intent: 'general_chat', confidence: 0.3, entities: {}, suggestedActions: [] };
  }

  extractEntities(userInput: string): Record<string, string> {
    const entities: Record<string, string> = {};
    for (const [key, pattern] of Object.entries(ENTITY_PATTERNS)) {
      const match = userInput.match(pattern);
      if (match) {
        entities[key] = match[1];
      }
    }
    return entities;
  }
}
