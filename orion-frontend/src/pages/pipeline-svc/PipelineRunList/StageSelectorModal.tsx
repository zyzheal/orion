/**
 * Stage Selector Modal
 * Used for selecting a stage to retry from when retrying a failed/cancelled pipeline run.
 * Provides options to retry from a specific stage or retry only failed stages.
 */
import React, { useState, useEffect } from 'react';
import { Modal, Radio, List, Tag, Typography, Spin, message, Space, Button } from 'antd';
import { colors, spacing } from '@/tokens';
import { getPipelineRunStages } from '@/api/pipelineRuns';

const { Text } = Typography;

export interface StageInfo {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';
  index: number;
}

interface StageSelectorModalProps {
  visible: boolean;
  runId: string | null;
  onClose: () => void;
  onRetry: (runId: string, stageId?: string, onlyFailed?: boolean) => void;
}

const StageSelectorModal: React.FC<StageSelectorModalProps> = ({
  visible,
  runId,
  onClose,
  onRetry,
}) => {
  const [loading, setLoading] = useState(false);
  const [stages, setStages] = useState<StageInfo[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [retryMode, setRetryMode] = useState<'specific' | 'failed' | 'all'>('all');

  // Fetch stages when modal opens
  useEffect(() => {
    if (visible && runId) {
      loadStages();
    } else {
      setStages([]);
      setSelectedStageId(null);
      setRetryMode('all');
    }
  }, [visible, runId]);

  const loadStages = async () => {
    if (!runId) return;

    setLoading(true);
    try {
      const response = await getPipelineRunStages(runId);
      const data = response.data as any;
      // Handle both array and object response formats
      const stageList = Array.isArray(data) ? data : (data.data || []);
      setStages(stageList as StageInfo[]);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载阶段信息失败：${error.message}`);
      } else {
        message.error('加载阶段信息失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!runId) return;

    if (retryMode === 'all') {
      onRetry(runId, undefined, false);
    } else if (retryMode === 'failed') {
      onRetry(runId, undefined, true);
    } else if (retryMode === 'specific' && selectedStageId) {
      onRetry(runId, selectedStageId, false);
    } else {
      message.warning('请选择一个阶段');
    }
  };

  const getStatusTagColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'processing';
      case 'pending':
        return 'default';
      case 'skipped':
        return 'default';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Modal
      title="选择重试方式"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={handleConfirm}
          disabled={retryMode === 'specific' && !selectedStageId}
        >
          确认重试
        </Button>,
      ]}
      width={500}
      centered
    >
      <Spin spinning={loading}>
        {/* Retry mode selection */}
        <div style={{ marginBottom: spacing.lg }}>
          <Text strong style={{ display: 'block', marginBottom: spacing.sm }}>
            重试模式
          </Text>
          <Radio.Group
            value={retryMode}
            onChange={(e) => setRetryMode(e.target.value)}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Radio value="all">
                <Text>完整重试</Text>
                <Text type="secondary" style={{ marginLeft: spacing.sm, fontSize: 12 }}>
                  从第一个阶段重新开始
                </Text>
              </Radio>
              <Radio value="failed">
                <Text>仅失败阶段</Text>
                <Text type="secondary" style={{ marginLeft: spacing.sm, fontSize: 12 }}>
                  跳过已成功的阶段，只重试失败的阶段
                </Text>
              </Radio>
              <Radio value="specific">
                <Text>从指定阶段重试</Text>
                <Text type="secondary" style={{ marginLeft: spacing.sm, fontSize: 12 }}>
                  选择从某个阶段开始重试
                </Text>
              </Radio>
            </Space>
          </Radio.Group>
        </div>

        {/* Stage list for specific stage selection */}
        {retryMode === 'specific' && stages.length > 0 && (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <Text strong style={{ display: 'block', marginBottom: spacing.sm }}>
              选择阶段
            </Text>
            <Radio.Group
              value={selectedStageId}
              onChange={(e) => setSelectedStageId(e.target.value)}
              style={{ width: '100%' }}
            >
              <List
                size="small"
                bordered
                dataSource={stages}
                renderItem={(stage) => (
                  <List.Item
                    style={{
                      padding: `${spacing.sm} ${spacing.md}`,
                      cursor: 'pointer',
                      background:
                        selectedStageId === stage.id
                          ? colors.primary[50]
                          : undefined,
                    }}
                    onClick={() => setSelectedStageId(stage.id)}
                  >
                    <Radio value={stage.id} style={{ marginRight: spacing.sm }}>
                      <Space>
                        <Text strong>#{stage.index + 1}</Text>
                        <Text>{stage.name}</Text>
                        <Tag color={getStatusTagColor(stage.status)}>
                          {stage.status}
                        </Tag>
                      </Space>
                    </Radio>
                  </List.Item>
                )}
              />
            </Radio.Group>
          </div>
        )}

        {retryMode === 'specific' && !loading && stages.length === 0 && (
          <Text type="secondary">暂无阶段信息</Text>
        )}
      </Spin>
    </Modal>
  );
};

export default StageSelectorModal;