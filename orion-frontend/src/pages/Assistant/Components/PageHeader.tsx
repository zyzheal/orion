import { Typography } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export function PageHeader() {
  return (
    <div style={{ marginBottom: spacing.md }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <RobotOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        智能助手
      </Title>
      <Text type="secondary">
        跨模块问答：可同时检索知识库、流水线、告警、工单与变更记录，给出综合回答。
      </Text>
    </div>
  );
}
