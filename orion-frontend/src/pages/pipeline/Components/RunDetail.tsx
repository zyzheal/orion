/**
 * RunDetail - 右侧运行详情
 * 抽取自 PipelineRetryRollback.tsx (P2-9 Phase 111)
 */
import React from 'react';
import {
  Card,
  Descriptions,
  Divider,
  Tag,
  Space,
  Typography,
  Button,
  Empty,
} from 'antd';
import { ReloadOutlined, RollbackOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import {
  formatDuration,
  statusColorMap,
  statusIconMap,
  stageStatusColorMap,
} from '../runRetryConstants';
import type { PipelineRetryRollbackState } from '../usePipelineRetryRollbackState';

const { Text } = Typography;

interface RunDetailProps {
  state: PipelineRetryRollbackState;
}

export const RunDetail: React.FC<RunDetailProps> = ({ state }) => {
  const { selectedRun } = state;
  return (
    <Card
      title="运行详情"
      bordered={false}
      extra={
        selectedRun && (
          <Tag color={statusColorMap[selectedRun.status]}>{selectedRun.status}</Tag>
        )
      }
      style={{ minHeight: 520 }}
    >
      {selectedRun ? (
        <>
          <Descriptions column={1} bordered size="small" style={{ marginBottom: spacing.md }}>
            <Descriptions.Item label="Run ID">
              <Text code style={{ fontSize: 12 }}>
                {selectedRun.id}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Pipeline 名称">
              <Text strong>{selectedRun.pipelineName}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Run 编号">#{selectedRun.runNumber}</Descriptions.Item>
            <Descriptions.Item label="触发方式">
              <Tag color={colors.info[500]}>
                {selectedRun.trigger === 'manual' && '手动触发'}
                {selectedRun.trigger === 'push' && '代码推送'}
                {selectedRun.trigger === 'schedule' && '定时触发'}
                {selectedRun.trigger === 'api' && 'API 触发'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="分支">
              <Text code>{selectedRun.branch}</Text>
            </Descriptions.Item>
            {selectedRun.commit && (
              <Descriptions.Item label="提交哈希">
                <Text code style={{ fontSize: 12 }}>
                  {selectedRun.commit}
                </Text>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="操作者">{selectedRun.author}</Descriptions.Item>
            <Descriptions.Item label="开始时间">
              {dayjs(selectedRun.startTime).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="结束时间">
              {selectedRun.endTime ? (
                dayjs(selectedRun.endTime).format('YYYY-MM-DD HH:mm:ss')
              ) : (
                <Text type="secondary">运行中</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColorMap[selectedRun.status]}>
                {statusIconMap[selectedRun.status]} {selectedRun.status}
              </Tag>
            </Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: `${spacing.sm} 0` }} />

          {/* 阶段执行状态 */}
          <Text strong style={{ display: 'block', marginBottom: spacing.sm }}>
            阶段执行状态
          </Text>
          <Space direction="vertical" size={spacing.xs} style={{ marginBottom: spacing.md }}>
            {selectedRun.stages.map((stage, idx) => (
              <div
                key={String(idx)}
                style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}
              >
                <Tag color={stageStatusColorMap[stage.status]} style={{ flex: '0 0 auto' }}>
                  {stage.name}
                </Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatDuration(stage.duration || 0)}
                </Text>
              </div>
            ))}
          </Space>

          <Divider style={{ margin: `${spacing.sm} 0` }} />

          {/* 操作按钮组 */}
          <Space>
            {(selectedRun.status === 'failed' || selectedRun.status === 'cancelled') && (
              <Button
                type="primary"
                onClick={() => state.handleRetry(selectedRun)}
                icon={<ReloadOutlined />}
                style={{ borderColor: colors.warning[500], color: colors.warning[500] }}
              >
                重试
              </Button>
            )}
            {(selectedRun.status === 'success' || selectedRun.status === 'failed') && (
              <Button
                onClick={() => state.handleRollback(selectedRun)}
                icon={<RollbackOutlined />}
                danger
                style={{ color: colors.error[500], borderColor: colors.error[500] }}
              >
                回滚
              </Button>
            )}
            {selectedRun.status === 'running' && (
              <Button
                onClick={() => state.handleCancel(selectedRun)}
                icon={<StopOutlined />}
                danger
              >
                取消
              </Button>
            )}
          </Space>
        </>
      ) : (
        <Empty description="请在左侧选择一个 Pipeline Run" />
      )}
    </Card>
  );
};
