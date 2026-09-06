/**
 * constants.ts - Assistant 常量
 * 抽取自 Assistant/index.tsx (P2-9 Phase 66)
 */
import type { SourceSamples } from './types';

export const SUGGESTIONS = [
  '为什么服务一直告警 cpu 高',
  '帮我查一下工单处理进度',
  '如何创建知识库文档',
  '流水线构建失败了怎么办',
];

export const INTENT_LABEL: Record<string, { label: string; color: string }> = {
  alert: { label: '告警', color: 'red' },
  ticket: { label: '工单', color: 'blue' },
  pipeline: { label: '流水线', color: 'purple' },
  change: { label: '变更', color: 'orange' },
  knowledge: { label: '知识库', color: 'green' },
};

export const SOURCE_SAMPLES: SourceSamples[] = [
  {
    label: '告警',
    source: 'alert',
    items: [
      {
        title: '支付服务 CPU 使用率超过阈值',
        content:
          '告警：payment-svc 实例 cpu_usage 达 92%，阈值 80%。状态 firing，来源 Prometheus，所属 cluster prod-ap-southeast。',
        tags: ['payment-svc', 'cpu'],
        status: 'firing',
      },
      {
        title: '订单服务 5xx 错误率上升',
        content: '告警：order-svc 5xx 错误率 5.2%，阈值 2%。状态 firing，来源 Grafana Mimir。',
        tags: ['order-svc', '5xx'],
        status: 'firing',
      },
    ],
  },
  {
    label: '工单',
    source: 'ticket',
    items: [
      {
        title: '用户反馈无法支付',
        content:
          '工单 INC-20260813-001：支付链路超时，用户反馈下单后卡在支付页。优先级 P1，处理人 oncall-payment。',
        tags: ['payment', 'INC-20260813-001'],
        status: 'open',
      },
    ],
  },
  {
    label: '变更',
    source: 'change',
    items: [
      {
        title: '支付网关 v8.2 上线',
        content:
          '变更 chg-1001：支付网关 v8.2 全量发布，涉及路由规则调整，风险等级 medium，回滚方案已配置。',
        tags: ['payment-gateway', 'v8.2'],
        status: 'completed',
      },
    ],
  },
  {
    label: '事件复盘',
    source: 'incident',
    items: [
      {
        title: '支付链路抖动的复盘',
        content:
          '事件 SEV-2：2026-08-13 支付链路抖动 15 分钟，根因为网关路由配置热更新冲击连接池，已回滚并补充监控。',
        tags: ['postmortem', 'payment'],
        status: 'resolved',
      },
    ],
  },
];
