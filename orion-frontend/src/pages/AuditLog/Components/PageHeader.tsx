/**
 * PageHeader - 审计日志页头
 * 抽取自 index.tsx (P2-9 Phase 208)
 */
import { Typography, Space, Button } from 'antd';
import {
  ReloadOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  loading: boolean;
  onRefresh: () => void;
  onVerify: () => void;
  onGenerateReport: () => void;
}

export const PageHeader = ({ loading, onRefresh, onVerify, onGenerateReport }: Props) => (
  <div
    style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}
  >
    <div>
      <Title level={2}>审计日志</Title>
      <Text type="secondary">不可逆审计链、完整性验证</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
      <Button icon={<SafetyCertificateOutlined />} onClick={onVerify}>
        验证完整性
      </Button>
      <Button icon={<FileTextOutlined />} onClick={onGenerateReport}>
        生成报告
      </Button>
    </Space>
  </div>
);
