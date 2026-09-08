import { Typography } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export function PageHeader() {
  return (
    <>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <ThunderboltOutlined style={{ marginRight: spacing.sm, color: colors.purple[500] }} />
        评测集管理
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        管理 RAG 评测集及评测用例，支持创建/查看/删除/运行/对比。用例格式: query ||| gold_answer
      </Text>
    </>
  );
}
