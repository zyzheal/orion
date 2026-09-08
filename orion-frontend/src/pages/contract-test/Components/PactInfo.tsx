import { Alert, List, Space, Tag, Typography } from 'antd';
import { spacing } from '@/tokens';
import { PACT_STEPS } from '../constants';

const { Text } = Typography;

export function PactInfoAlert() {
  return (
    <Alert
      message="Pact 契约测试"
      description="Pact 是消费者驱动的契约测试框架。Consumer 定义期望 → Provider 验证 → CI 流水线门禁。当前通过率 71%，2 个漂移 + 1 个缺失需修复"
      type="info"
      showIcon
      style={{ marginBottom: spacing.md }}
    />
  );
}

export function PactStepsPanel() {
  return (
    <Space direction="vertical" style={{ width: '100%', marginTop: spacing.md }}>
      <List
        dataSource={PACT_STEPS}
        renderItem={(item) => (
          <List.Item>
            <Space>
              <Tag>{item.step.split('.')[0]}</Tag>
              <Text>{item.step.split('. ')[1]} · <Text type="secondary">{item.desc}</Text></Text>
            </Space>
          </List.Item>
        )}
      />
    </Space>
  );
}
