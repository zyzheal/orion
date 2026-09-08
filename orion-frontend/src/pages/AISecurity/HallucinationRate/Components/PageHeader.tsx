import { Button, Select, Space, Typography } from 'antd';
import { AlertOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { PERIOD_OPTIONS } from '../constants';

const { Title, Text } = Typography;

interface Props {
  period: string;
  setPeriod: (p: string) => void;
  loading: boolean;
  loadData: () => void;
}

export function PageHeader({ period, setPeriod, loading, loadData }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md }}>
      <div>
        <Title level={2} style={{ marginBottom: 4 }}>
          <AlertOutlined style={{ marginRight: spacing.sm, color: colors.error[500] }} />
          幻觉率监控
        </Title>
        <Text type="secondary">LLM 幻觉检测 · 知识核验 · 模型漂移预警</Text>
      </div>
      <Space>
        <Select
          value={period}
          onChange={setPeriod}
          style={{ width: 120 }}
          options={PERIOD_OPTIONS}
        />
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
      </Space>
    </div>
  );
}
