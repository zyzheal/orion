/**
 * KnowledgeBase PageHeader
 * 抽取自 index.tsx (P2-9 Phase 169)
 */
import { Button, Space, Typography } from 'antd';
import { BookOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Paragraph } = Typography;

interface PageHeaderProps {
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}

export const PageHeader = ({ loading, onRefresh, onCreate }: PageHeaderProps) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing[6],
    }}
  >
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <BookOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        AI 知识库
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        知识沉淀与智能检索
      </Paragraph>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
        新建知识
      </Button>
    </Space>
  </div>
);
