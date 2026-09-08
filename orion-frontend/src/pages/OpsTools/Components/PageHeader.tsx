import { Typography } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export function PageHeader() {
  return (
    <div style={{ marginBottom: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <ToolOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        运维管理工具
      </Title>
      <Text type="secondary">
        系统定时任务、数据库工具、Tagent管理、批量操作、文件管理与系统配置
      </Text>
    </div>
  );
}
