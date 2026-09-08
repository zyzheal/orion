/**
 * TraceDetailModal.tsx - Trace 详情弹窗
 * 抽取自 index.tsx (P2-9 Phase 223)
 */
import { Descriptions, Divider, Modal, Tag, Typography } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { TraceSummary } from '@/api/apm';

const { Text } = Typography;

interface Props {
  open: boolean;
  trace: TraceSummary | null;
  onClose: () => void;
}

export const TraceDetailModal = ({ open, trace, onClose }: Props) => (
  <Modal
    title={
      <span>
        <CodeOutlined style={{ marginRight: spacing.sm, color: colors.error[500] }} />
        Trace 详情
      </span>
    }
    open={open}
    onCancel={onClose}
    footer={null}
    width={700}
  >
    {trace && (
      <>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="Trace ID" span={2}>
            <code style={{ fontSize: 12 }}>{trace.traceId}</code>
          </Descriptions.Item>
          <Descriptions.Item label="服务">{trace.root_service}</Descriptions.Item>
          <Descriptions.Item label="操作">{trace.root_operation}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag
              color={trace.status === 'error' ? colors.error[500] : colors.success[500]}
            >
              {trace.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="耗时">
            <span
              style={{
                color: trace.duration_ms > 5000 ? colors.error[500] : colors.neutral[900],
                fontWeight: 600,
              }}
            >
              {trace.duration_ms} ms
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="Span 数">{trace.span_count}</Descriptions.Item>
          <Descriptions.Item label="发生时间">
            {new Date(trace.start_time).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="结束时间">
            {new Date(trace.end_time).toLocaleString()}
          </Descriptions.Item>
        </Descriptions>

        <Divider />
        <Text type="secondary">提示：点击 Trace ID 可跳转到完整的链路追踪详情页</Text>
      </>
    )}
  </Modal>
);
