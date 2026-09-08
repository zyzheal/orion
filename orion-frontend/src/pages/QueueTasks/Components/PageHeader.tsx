/**
 * PageHeader - 任务队列页头
 * 抽取自 index.tsx (P2-9 Phase 209)
 */
import { Typography, Space, Select, Button } from 'antd';
import { PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import type { JobStatus } from '@/api/queue';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  filterStatus: JobStatus | undefined;
  onFilterChange: (v: JobStatus | undefined) => void;
  onOpenEnqueue: () => void;
}

export const PageHeader = ({ filterStatus, onFilterChange, onOpenEnqueue }: Props) => (
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
        <UnorderedListOutlined
          style={{ marginRight: spacing[3], color: colors.primary[500] }}
        />
        任务队列
      </Title>
      <Text type="secondary">管理队列任务状态、手动入队和完成标记</Text>
    </div>
    <Space>
      <Select
        style={{ width: 120 }}
        placeholder="状态筛选"
        allowClear
        value={filterStatus}
        onChange={(v) => onFilterChange(v)}
        options={[
          { label: '待处理', value: 'pending' },
          { label: '处理中', value: 'processing' },
          { label: '已完成', value: 'completed' },
          { label: '失败', value: 'failed' },
        ]}
      />
      <Button type="primary" icon={<PlusOutlined />} onClick={onOpenEnqueue}>
        入队
      </Button>
    </Space>
  </div>
);
