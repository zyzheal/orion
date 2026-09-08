/**
 * TaskTimeouts StatsRow
 * 抽取自 index.tsx (P2-9 Phase 200)
 */
import { Button, Card, Col, Row, Statistic, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { TimeoutStatus } from '@/api/task-timeout';

const { Text } = Typography;

interface Props {
  timedOutCount: number;
  status: TimeoutStatus;
  checking: boolean;
  onCheckNow: () => void;
}

export const StatsRow = ({ timedOutCount, status, checking, onCheckNow }: Props) => (
  <Row gutter={16} style={{ marginBottom: spacing.lg }}>
    <Col xs={24} sm={12} md={6}>
      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: spacing.md }}>
        <Statistic
          title="待处理超时任务"
          value={timedOutCount}
          prefix={
            timedOutCount > 0 ? (
              <ExclamationCircleOutlined style={{ color: colors.error[500] }} />
            ) : (
              <CheckCircleOutlined style={{ color: colors.success[500] }} />
            )
          }
          valueStyle={{
            color: timedOutCount > 0 ? colors.error[500] : colors.success[500],
          }}
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} md={6}>
      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: spacing.md }}>
        <Statistic
          title="检查器状态"
          value={status.isRunning ? '运行中' : '已停止'}
          prefix={
            status.isRunning ? (
              <SyncOutlined spin style={{ color: colors.success[500] }} />
            ) : (
              <ClockCircleOutlined style={{ color: colors.neutral[500] }} />
            )
          }
          valueStyle={
            status.isRunning ? { color: colors.success[500] } : { color: colors.neutral[500] }
          }
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} md={6}>
      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: spacing.md }}>
        <Statistic
          title="已处理事件数"
          value={status.processedEventsCount}
          prefix={<CheckCircleOutlined style={{ color: colors.primary[500] }} />}
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} md={6}>
      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: spacing.md, textAlign: 'center' }}>
        <div style={{ paddingTop: 8 }}>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={onCheckNow}
            loading={checking}
            style={{ borderRadius: 6 }}
          >
            立即检查
          </Button>
          <div style={{ marginTop: spacing.sm }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              手动触发超时检查
            </Text>
          </div>
        </div>
      </Card>
    </Col>
  </Row>
);
