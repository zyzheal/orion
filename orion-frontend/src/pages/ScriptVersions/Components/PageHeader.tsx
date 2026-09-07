/**
 * ScriptVersions PageHeader
 * 抽取自 index.tsx (P2-9 Phase 187)
 */
import { Typography, Button, Space, Input } from 'antd';
import { PlusOutlined, ReloadOutlined, BranchesOutlined, FileTextOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PageHeaderProps {
  scriptId: string;
  loading: boolean;
  onScriptIdChange: (v: string) => void;
  onSearch: () => void;
  onCreate: () => void;
  onDiff: () => void;
  onRefresh: () => void;
}

export const PageHeader = ({
  scriptId,
  loading,
  onScriptIdChange,
  onSearch,
  onCreate,
  onDiff,
  onRefresh,
}: PageHeaderProps) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
    <div style={{ flex: 1 }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <FileTextOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        脚本版本管理
      </Title>
      <Text type="secondary">脚本内容版本追踪与变更对比</Text>
    </div>
    <Space>
      <Input
        placeholder="Script ID"
        value={scriptId}
        onChange={(e) => onScriptIdChange(e.target.value)}
        style={{ width: 200 }}
        onPressEnter={onSearch}
      />
      <Button icon={<BranchesOutlined />} onClick={onDiff}>
        版本对比
      </Button>
      <Button icon={<PlusOutlined />} type="primary" onClick={onCreate}>
        创建版本
      </Button>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </Space>
  </div>
);
