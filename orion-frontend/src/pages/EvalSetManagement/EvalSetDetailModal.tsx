/**
 * EvalSetDetailModal.tsx - 评测集详情 Modal
 * 抽取自 EvalSetManagement/index.tsx (P2-9 Phase 60)
 */
import React from 'react';
import { Modal, Button, Tag, Descriptions, Divider, Typography, Empty } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { EvalSet } from './types';

const { Text } = Typography;

export interface EvalSetDetailModalProps {
  selectedSet: EvalSet | null;
  runLoading: string | null;
  onClose: () => void;
  onRunEval: (setId: string, setName: string) => void;
}

export const EvalSetDetailModal: React.FC<EvalSetDetailModalProps> = ({
  selectedSet,
  runLoading,
  onClose,
  onRunEval,
}) => {
  if (!selectedSet) return null;

  return (
    <Modal
      title={`评测集详情: ${selectedSet.name}`}
      open={!!selectedSet}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        <Button
          key="run"
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={runLoading === selectedSet.id}
          onClick={() => onRunEval(selectedSet.id, selectedSet.name)}
        >
          运行评测
        </Button>,
      ]}
      width={700}
    >
      <Descriptions column={2} bordered size="small" style={{ marginBottom: spacing.md }}>
        <Descriptions.Item label="名称">{selectedSet.name}</Descriptions.Item>
        <Descriptions.Item label="版本">v{selectedSet.version}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={selectedSet.is_active ? 'green' : 'default'}>
            {selectedSet.is_active ? '活跃' : '非活跃'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="用例数">{selectedSet.cases?.length || 0}</Descriptions.Item>
      </Descriptions>
      {selectedSet.cases && selectedSet.cases.length > 0 ? (
        <>
          <Text strong>评测用例</Text>
          <Divider />
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {selectedSet.cases.map((c, idx) => (
              <div
                key={c.id}
                style={{
                  marginBottom: spacing.sm,
                  display: 'flex',
                  gap: spacing.sm,
                  padding: spacing.sm,
                  background: colors.light.bg.secondary,
                  borderRadius: 4,
                }}
              >
                <Text type="secondary" style={{ flexShrink: 0 }}>
                  #{idx + 1}
                </Text>
                <div style={{ flex: 1 }}>
                  <div>
                    <Text strong>Q:</Text> {c.query}
                  </div>
                  {c.gold_answer && (
                    <div>
                      <Text strong>A:</Text> {c.gold_answer}
                    </div>
                  )}
                  {c.gold_sources && (
                    <div>
                      <Text strong type="secondary">
                        来源:
                      </Text>{' '}
                      {c.gold_sources}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Empty description="暂无评测用例" />
      )}
    </Modal>
  );
};
