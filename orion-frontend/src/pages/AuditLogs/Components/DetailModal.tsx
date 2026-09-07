/**
 * AuditLogs DetailModal
 * 抽取自 index.tsx (P2-9 Phase 186)
 */
import { Modal, Descriptions, Divider, Timeline, Typography, Tag } from 'antd';
import type { PipelineAuditLog, AuditTrailEntry } from '@/api/audit-logs';
import { spacing, colors } from '@/tokens';
import { actionColor } from '../constants';
import dayjs from 'dayjs';

const { Text } = Typography;

interface DetailModalProps {
  open: boolean;
  selectedLog: PipelineAuditLog | null;
  trail: PipelineAuditLog[] | AuditTrailEntry[];
  onClose: () => void;
}

export const DetailModal = ({ open, selectedLog, trail, onClose }: DetailModalProps) => (
  <Modal
    title={`审计详情 — ${selectedLog?.runId}`}
    open={open}
    onCancel={onClose}
    footer={null}
    width={700}
  >
    {selectedLog && (
      <>
        <Descriptions bordered size="small" column={2} style={{ marginBottom: spacing.md }}>
          <Descriptions.Item label="Run ID">{selectedLog.runId}</Descriptions.Item>
          <Descriptions.Item label="Action">
            <Tag color={actionColor[selectedLog.action]}>{selectedLog.action}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Actor">{selectedLog.actor}</Descriptions.Item>
          <Descriptions.Item label="Outcome">
            <Tag
              color={
                selectedLog.outcome === 'success'
                  ? 'green'
                  : selectedLog.outcome === 'failed'
                    ? 'red'
                    : 'orange'
              }
            >
              {selectedLog.outcome}
            </Tag>
          </Descriptions.Item>
          {selectedLog.stageId && (
            <Descriptions.Item label="Stage ID">{selectedLog.stageId}</Descriptions.Item>
          )}
          {selectedLog.taskId && (
            <Descriptions.Item label="Task ID">{selectedLog.taskId}</Descriptions.Item>
          )}
          {selectedLog.durationMs && (
            <Descriptions.Item label="Duration">{selectedLog.durationMs}ms</Descriptions.Item>
          )}
          {selectedLog.errorMessage && (
            <Descriptions.Item label="Error" span={2} style={{ color: colors.error[500] }}>
              {selectedLog.errorMessage}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Time" span={2}>
            {dayjs(selectedLog.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
        </Descriptions>

        <Divider orientation="left">运行轨迹</Divider>
        {trail.length > 0 ? (
          <Timeline style={{ maxHeight: 300, overflow: 'auto' }}>
            {trail.map((entry) => (
              <Timeline.Item
                key={entry.id}
                color={
                  entry.outcome === 'success'
                    ? 'green'
                    : entry.outcome === 'failed'
                      ? 'red'
                      : 'gray'
                }
              >
                <Text strong>{entry.action}</Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  {entry.actor} · {dayjs(entry.createdAt).format('HH:mm:ss')}
                </Text>
                {entry.durationMs && <Text type="secondary"> · {entry.durationMs}ms</Text>}
                {entry.errorMessage && (
                  <div style={{ color: colors.error[500], marginTop: 4, fontSize: 12 }}>
                    {entry.errorMessage}
                  </div>
                )}
              </Timeline.Item>
            ))}
          </Timeline>
        ) : (
          <Text type="secondary">该运行暂无更多轨迹记录</Text>
        )}
      </>
    )}
  </Modal>
);
