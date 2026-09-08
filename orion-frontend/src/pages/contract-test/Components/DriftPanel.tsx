import { Card, List, Space, Tag, Typography } from 'antd';
import { FALLBACK_DRIFT, SEVERITY_COLOR } from '../constants';
import { PactStepsPanel } from './PactInfo';

const { Text } = Typography;

export function DriftPanel() {
  return (
    <div>
      <Card title="最近漂移检测">
        <List
          dataSource={FALLBACK_DRIFT}
          renderItem={(item) => (
            <List.Item style={{ borderBottom: '1px solid #f0f0f0' }}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Space>
                  <Text code style={{ fontSize: 11 }}>{item.field}</Text>
                  <Tag color={SEVERITY_COLOR[item.severity] || 'default'}>{item.severity}</Tag>
                </Space>
                <Text type="secondary" style={{ fontSize: 11 }}>期望: {item.expected}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>实际: {item.actual}</Text>
              </Space>
            </List.Item>
          )}
        />
      </Card>
      <Card title="Pact 交互方式">
        <PactStepsPanel />
      </Card>
    </div>
  );
}
