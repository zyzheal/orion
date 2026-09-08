import { Card, List, Space, Tag, Typography } from 'antd';
import { spacing } from '@/tokens';
import { BOOT_LEVELS } from '../constants';

const { Text } = Typography;

export function BootMaturityCard() {
  return (
    <Card title="配置化启动成熟度" style={{ marginBottom: spacing.md }}>
      <List
        dataSource={BOOT_LEVELS}
        renderItem={(item) => (
          <List.Item style={{ borderBottom: '1px solid #f0f0f0' }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Space>
                <Tag color={item.status === 'pass' ? 'green' : item.status === 'partial' ? 'orange' : 'red'}>
                  {item.status === 'pass' ? '✅ 通过' : item.status === 'partial' ? '⚠️ 部分' : '❌ 未实现'}
                </Tag>
                <Text strong>{item.level}</Text>
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>{item.desc}</Text>
            </Space>
          </List.Item>
        )}
      />
    </Card>
  );
}
