import { Typography } from 'antd';
import { FileProtectOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export function PageHeader() {
  return (
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <FileProtectOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
        契约测试 (Pact)
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        前后端 API 契约验证 · Schema 漂移检测 · Mock Server · Pact 集成
      </Text>
    </div>
  );
}
