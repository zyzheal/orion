/**
 * PipelineBudget usage display card
 */
import React from 'react';
import {
  Alert,
  Card,
  Col,
  Descriptions,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
} from 'antd';
import { BarChartOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { BudgetConfig, BudgetUsage } from '../types';
import { ALERT_LEVEL_CONFIG, POLICY_LABEL_MAP } from '../constants';

interface UsageCardProps {
  config: BudgetConfig | null;
  usage: BudgetUsage | null;
}

const getProgressStatus = (pct?: number): 'success' | 'normal' | 'exception' => {
  if (pct && pct > 80) return 'exception';
  if (pct && pct > 60) return 'normal';
  return 'success';
};

export const UsageCard: React.FC<UsageCardProps> = ({ config, usage }) => (
  <Card
    title={
      <>
        <BarChartOutlined style={{ marginRight: spacing.sm }} />
        预算使用情况
      </>
    }
  >
    {/* Alerts */}
    {usage?.alerts && usage.alerts.length > 0 && (
      <Space
        direction="vertical"
        style={{ width: '100%', marginBottom: spacing.md }}
        size={8}
      >
        {usage.alerts.map((alert, i) => {
          const cfg = ALERT_LEVEL_CONFIG[alert.level] || ALERT_LEVEL_CONFIG.info;
          return (
            <Alert
              key={String(i)}
              message={cfg.label}
              description={alert.message}
              type={cfg.type}
              showIcon
              icon={
                alert.level === 'critical' ? <WarningOutlined /> : <CheckCircleOutlined />
              }
            />
          );
        })}
      </Space>
    )}

    {usage?.alerts?.length === 0 && (
      <Alert
        message="预算使用正常"
        description="当前未触发任何预算告警"
        type="success"
        showIcon
        style={{ marginBottom: spacing.md }}
      />
    )}

    {/* Usage Stats */}
    <Row gutter={16}>
      <Col span={12}>
        <Statistic title="时间使用" value={usage?.time_percent ?? 0} suffix="%" />
        <Progress
          percent={usage?.time_percent ?? 0}
          status={getProgressStatus(usage?.time_percent)}
          style={{ marginTop: spacing.sm }}
        />
      </Col>
      <Col span={12}>
        <Statistic title="成本使用" value={usage?.cost_percent ?? 0} suffix="%" />
        <Progress
          percent={usage?.cost_percent ?? 0}
          status={getProgressStatus(usage?.cost_percent)}
          style={{ marginTop: spacing.sm }}
        />
      </Col>
    </Row>

    {/* Budget Summary */}
    {config && (
      <Descriptions column={1} size="small" style={{ marginTop: spacing.md }} bordered>
        <Descriptions.Item label="时间预算">
          {config.time_budget?.maxDurationMs
            ? `${Math.round(config.time_budget.maxDurationMs / 60000)} 分钟`
            : '未配置'}
        </Descriptions.Item>
        <Descriptions.Item label="时间策略">
          {config.time_budget?.policy ? (
            <Tag color={config.time_budget.policy === 'block' ? 'red' : 'blue'}>
              {POLICY_LABEL_MAP[config.time_budget.policy] || config.time_budget.policy}
            </Tag>
          ) : (
            '未配置'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="成本预算">
          {config.cost_budget?.maxCostCents
            ? `¥${(config.cost_budget.maxCostCents / 100).toFixed(2)}`
            : '未配置'}
        </Descriptions.Item>
        <Descriptions.Item label="成本策略">
          {config.cost_budget?.policy ? (
            <Tag color={config.cost_budget.policy === 'block' ? 'red' : 'blue'}>
              {POLICY_LABEL_MAP[config.cost_budget.policy] || config.cost_budget.policy}
            </Tag>
          ) : (
            '未配置'
          )}
        </Descriptions.Item>
      </Descriptions>
    )}
  </Card>
);
