/**
 * RunDetailModal.tsx - 金丝雀分析详情 Modal
 * 抽取自 CanaryAnalysis/index.tsx (P2-9 Phase 80)
 */
import React from 'react';
import { Typography, Modal, Button, Space, Alert, Descriptions, Tag, Card } from 'antd';
import { spacing } from '@/tokens';
import Table from '@/components/Table';
import StatusBadge, { type StatusType } from '@/components/StatusBadge';
import type { CanaryAnalysisRun, CanaryMetricResult, CanaryMlResult } from '@/api/canary-analysis';

const { Text } = Typography;

interface RunDetailModalProps {
  visible: boolean;
  selectedRun: CanaryAnalysisRun | null;
  metrics: CanaryMetricResult[];
  mlResults: CanaryMlResult[];
  onCancel: () => void;
  onForcePromote: (runId: string) => void;
  onForceRollback: (runId: string) => void;
}

export const RunDetailModal: React.FC<RunDetailModalProps> = ({
  visible,
  selectedRun,
  metrics,
  mlResults,
  onCancel,
  onForcePromote,
  onForceRollback,
}) => (
  <Modal
    title="金丝雀分析详情"
    open={visible}
    onCancel={onCancel}
    footer={
      selectedRun && selectedRun.status === 'running' ? (
        <Space>
          <Button danger onClick={() => onForceRollback(selectedRun.id)}>
            强制回滚
          </Button>
          <Button type="primary" onClick={() => onForcePromote(selectedRun.id)}>
            强制升级
          </Button>
        </Space>
      ) : null
    }
    width={1000}
  >
    {selectedRun && (
      <>
        {selectedRun.status === 'rollback' && (
          <Alert
            type="error"
            message="ROLLBACK TRIGGERED"
            description="Canary detected significant degradation"
            style={{ marginBottom: spacing.md }}
          />
        )}
        {selectedRun.status === 'promote' && (
          <Alert
            type="success"
            message="PROMOTE DECISION"
            description="Canary passed all analysis rounds"
            style={{ marginBottom: spacing.md }}
          />
        )}

        <Descriptions bordered column={3} style={{ marginBottom: spacing.md }}>
          <Descriptions.Item label="部署">{selectedRun.deploymentId}</Descriptions.Item>
          <Descriptions.Item label="轮次">{selectedRun.runNumber}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <StatusBadge
              status={
                selectedRun.status === 'running'
                  ? 'running'
                  : selectedRun.status === 'promote'
                    ? 'success'
                    : 'failed'
              }
              size="small"
            />
          </Descriptions.Item>
          <Descriptions.Item label="置信度">
            {selectedRun.confidence ? `${(selectedRun.confidence * 100).toFixed(1)}%` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="决策">
            {selectedRun.decision ? <Tag>{selectedRun.decision}</Tag> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="耗时">
            {selectedRun.durationMs ? `${(selectedRun.durationMs / 1000).toFixed(1)}s` : '-'}
          </Descriptions.Item>
        </Descriptions>

        <Card title="指标比对结果" size="small" style={{ marginBottom: spacing.md }}>
          {metrics.length > 0 ? (
            <Table
              columns={[
                {
                  key: 'metricName',
                  title: '指标',
                  dataIndex: 'metricName',
                  width: 180,
                  render: (value: unknown) => <Text strong>{String(value)}</Text>,
                },
                {
                  key: 'category',
                  title: '类别',
                  dataIndex: 'category',
                  width: 100,
                  render: (value: unknown) => (value ? <Tag>{String(value)}</Tag> : '-'),
                },
                {
                  key: 'baselineValue',
                  title: 'Baseline',
                  dataIndex: 'baselineValue',
                  width: 100,
                  render: (value: unknown) => (value ? String(value) : '-'),
                },
                {
                  key: 'canaryValue',
                  title: 'Canary',
                  dataIndex: 'canaryValue',
                  width: 100,
                  render: (value: unknown) => (value ? String(value) : '-'),
                },
                {
                  key: 'mannWhitneyP',
                  title: 'MW P值',
                  dataIndex: 'mannWhitneyP',
                  width: 100,
                  render: (value: unknown) => {
                    if (!value) return '-';
                    const p = Number(value);
                    return <Text type={p < 0.05 ? 'danger' : 'secondary'}>{p.toFixed(4)}</Text>;
                  },
                },
                {
                  key: 'verdict',
                  title: '判定',
                  dataIndex: 'verdict',
                  width: 100,
                  render: (value: unknown) => {
                    const statusMap: Record<string, string> = {
                      pass: 'success',
                      warn: 'warning',
                      fail: 'failed',
                    };
                    return value ? (
                      <StatusBadge
                        status={(statusMap[String(value)] || 'unknown') as StatusType}
                        size="small"
                      />
                    ) : (
                      '-'
                    );
                  },
                },
              ]}
              dataSource={metrics}
              rowKey="id"
              size="small"
              pagination={false}
            />
          ) : (
            <Text type="secondary">暂无指标数据</Text>
          )}
        </Card>

        {mlResults.length > 0 && (
          <Card title="ML 分析结果" size="small">
            {mlResults.map((ml) => (
              <Descriptions
                key={ml.id}
                bordered
                column={3}
                size="small"
                style={{ marginBottom: spacing.sm }}
              >
                <Descriptions.Item label="模型">{ml.modelName}</Descriptions.Item>
                <Descriptions.Item label="预测">
                  <Tag color={ml.prediction === 'healthy' ? 'green' : 'red'}>
                    {ml.prediction}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="置信度">
                  {ml.confidence ? `${(ml.confidence * 100).toFixed(1)}%` : '-'}
                </Descriptions.Item>
              </Descriptions>
            ))}
          </Card>
        )}
      </>
    )}
  </Modal>
);
