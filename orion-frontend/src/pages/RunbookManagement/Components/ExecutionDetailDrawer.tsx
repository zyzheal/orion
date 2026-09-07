/**
 * Execution detail drawer (with step timeline)
 * 抽取自 index.tsx (P2-9 Phase 163)
 */
import { Descriptions, Drawer, Tag, Timeline, Typography } from 'antd';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import type { RunbookExecution } from '@/api/runbooks';
import { statusColor, statusLabel } from '../constants';

const { Title, Text } = Typography;

interface ExecutionDetailDrawerProps {
  open: boolean;
  execution: RunbookExecution | null;
  onClose: () => void;
}

export const ExecutionDetailDrawer = ({ open, execution, onClose }: ExecutionDetailDrawerProps) => (
  <Drawer title="执行详情" open={open} onClose={onClose} width={500}>
    {execution && (
      <>
        <Descriptions column={1} bordered size="small" style={{ marginBottom: spacing.md }}>
          <Descriptions.Item label="状态">
            <Tag color={statusColor[execution.status]}>
              {statusLabel[execution.status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="触发者">{execution.triggeredBy}</Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {dayjs(execution.startedAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          {execution.completedAt && (
            <Descriptions.Item label="完成时间">
              {dayjs(execution.completedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          )}
        </Descriptions>

        <Title level={4}>步骤执行结果</Title>
        <Timeline
          items={execution.stepResults?.map((step, index) => ({
            color: statusColor[step.status] ?? colors.neutral[400],
            children: (
              <div>
                <Text strong>步骤 {index + 1}</Text>
                <br />
                <Tag color={statusColor[step.status]} style={{ fontSize: 12 }}>
                  {statusLabel[step.status]}
                </Tag>
                {step.output && (
                  <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                    {step.output}
                  </Text>
                )}
                {step.error && (
                  <Text type="danger" style={{ display: 'block', marginTop: 4 }}>
                    {step.error}
                  </Text>
                )}
              </div>
            ),
          }))}
        />
      </>
    )}
  </Drawer>
);
