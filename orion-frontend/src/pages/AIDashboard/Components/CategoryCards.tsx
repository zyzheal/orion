/**
 * CategoryCards.tsx - 5 个 AI 功能入口卡
 * 抽取自 index.tsx (P2-9 Phase 224)
 */
import { Card, Col, Row, Space, Tag, Typography } from 'antd';
import {
  CodeOutlined,
  DashboardOutlined,
  RobotOutlined,
  SecurityScanOutlined,
  ToolOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface Category {
  key: string;
  label: string;
  icon: React.ReactNode;
  route: string;
}

const CATEGORIES: Category[] = [
  { key: 'overview', label: 'AI 总览', icon: <DashboardOutlined />, route: '/ai/dashboard' },
  { key: 'assistant', label: '智能助手', icon: <RobotOutlined />, route: '/ai/chatops' },
  { key: 'code', label: '代码智能', icon: <CodeOutlined />, route: '/ai/review' },
  { key: 'security', label: '安全与治理', icon: <SecurityScanOutlined />, route: '/ai/security' },
  { key: 'platform', label: '平台配置', icon: <ToolOutlined />, route: '/ai/gateway' },
];

interface Props {
  onNavigate: (route: string) => void;
}

export const CategoryCards = ({ onNavigate }: Props) => (
  <Row gutter={[16, 16]}>
    {CATEGORIES.map((cat) => (
      <Col key={cat.key} xs={24} sm={12} md={8} lg={8}>
        <Card
          hoverable
          size="small"
          onClick={() => onNavigate(cat.route)}
          style={{ cursor: 'pointer' }}
        >
          <Space>
            {cat.icon}
            <Text strong>{cat.label}</Text>
            <Tag color="blue">Phase 1</Tag>
          </Space>
        </Card>
      </Col>
    ))}
  </Row>
);
