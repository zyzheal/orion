/**
 * Toolbar - 月份选择 + 刷新按钮
 * 抽取自 index.tsx (P2-9 Phase 220)
 */
import { Button, Col, Row, Select, Space, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';

const { Text } = Typography;

interface Props {
  selectedMonth: string;
  setSelectedMonth: (v: string) => void;
  monthOptions: { label: string; value: string }[];
  onRefresh: () => void;
  loading: boolean;
}

export const Toolbar = ({
  selectedMonth,
  setSelectedMonth,
  monthOptions,
  onRefresh,
  loading,
}: Props) => (
  <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
    <Col>
      <Space>
        <Text>选择月份：</Text>
        <Select
          value={selectedMonth}
          onChange={setSelectedMonth}
          options={monthOptions}
          style={{ width: 140 }}
        />
      </Space>
    </Col>
    <Col>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </Col>
  </Row>
);
