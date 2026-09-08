import { Card, List, Tag, Typography } from 'antd';
import { FALLBACK_FE } from '../constants';

const { Text } = Typography;

export function FrontendCard() {
  return (
    <Card title="前端共享组件耦合">
      <List
        dataSource={FALLBACK_FE}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              title={<Text strong>{item.component}</Text>}
              description={`${item.references} 次引用 · 单向依赖`}
            />
            <Tag color="green">健康</Tag>
          </List.Item>
        )}
      />
    </Card>
  );
}
