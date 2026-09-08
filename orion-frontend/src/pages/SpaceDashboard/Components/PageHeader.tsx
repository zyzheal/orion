import { Typography, Space, Select, Button } from 'antd';
import { LineChartOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';

const { Title, Text } = Typography;
const { Option } = Select;

interface Props {
  period: string;
  setPeriod: (v: string) => void;
  loading: boolean;
  loadData: () => void;
}

export function PageHeader({ period, setPeriod, loading, loadData }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
      <div>
        <Title level={2} style={{ marginBottom: 4 }}>
          <LineChartOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          SPACE 效能 Dashboard
        </Title>
        <Text type="secondary" style={{ display: 'block' }}>
          开发者效能五维度模型 · 基于 SPACE 框架
        </Text>
      </div>
      <Space>
        <Select value={period} onChange={setPeriod} style={{ width: 120 }}>
          <Option value="7d">近 7 天</Option>
          <Option value="30d">近 30 天</Option>
          <Option value="90d">近 90 天</Option>
        </Select>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
      </Space>
    </div>
  );
}
