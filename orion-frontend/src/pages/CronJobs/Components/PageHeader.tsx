/**
 * CronJobs PageHeader
 * 抽取自 index.tsx (P2-9 Phase 195)
 */
import { Button, Typography } from 'antd';
import { PlusOutlined, ScheduleOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PageHeaderProps {
  onCreate: () => void;
}

export const PageHeader = ({ onCreate }: PageHeaderProps) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    }}
  >
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <ScheduleOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        定时任务
      </Title>
      <Text type="secondary">管理和调度周期性执行的任务</Text>
    </div>
    <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
      新建任务
    </Button>
  </div>
);
