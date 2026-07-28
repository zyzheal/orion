import { useState, useEffect } from 'react';
import { Card, Col, Row, Typography, Space, Tag, Statistic, Spin, Alert } from 'antd';
import {
  DashboardOutlined,
  RobotOutlined,
  CodeOutlined,
  SecurityScanOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  DollarOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getAllHealth, AIGatewayHealth } from '@/api/ai-gateway';
import { aiAgentApi } from '@/api/ai-agents';
import { listModels } from '@/api/ai-decision';
import { getDashboardData } from '@/api/ai-cost';
import { getSecurityStats } from '@/api/ai-security';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

const AICATEGORIES = [
  { key: 'overview', label: 'AI 总览', icon: <DashboardOutlined />, route: '/ai/dashboard' },
  { key: 'assistant', label: '智能助手', icon: <RobotOutlined />, route: '/ai/chatops' },
  { key: 'code', label: '代码智能', icon: <CodeOutlined />, route: '/ai/review' },
  { key: 'security', label: '安全与治理', icon: <SecurityScanOutlined />, route: '/ai/security' },
  { key: 'platform', label: '平台配置', icon: <ToolOutlined />, route: '/ai/gateway' },
];

const STATE_ICONS: Record<string, React.ReactNode> = {
  CLOSED: <CheckCircleOutlined style={{ color: colors.success[500] }} />,
  OPEN: <CloseCircleOutlined style={{ color: colors.error[500] }} />,
  HALF_OPEN: <WarningOutlined style={{ color: colors.warning[500] }} />,
};

interface AggregateStats {
  agentCount: number;
  modelCount: number;
  todayCost: number;
  complianceScore: number;
}

export default function AIDashboard() {
  const navigate = useNavigate();
  const [healthData, setHealthData] = useState<AIGatewayHealth[]>([]);
  const [loading, setLoading] = useState(true);

  // Aggregated stats from 4 parallel API calls
  const [aggregateStats, setAggregateStats] = useState<AggregateStats>({
    agentCount: 0,
    modelCount: 0,
    todayCost: 0,
    complianceScore: 0,
  });
  const [aggregateLoading, setAggregateLoading] = useState(true);
  const [aggregateError, setAggregateError] = useState<string | null>(null);

  useEffect(() => {
    loadHealth();
    loadAggregateStats();
  }, []);

  const loadHealth = async () => {
    try {
      const res = await getAllHealth();
      const data = (res as any)?.data?.health || (res as any)?.health || [];
      setHealthData(Array.isArray(data) ? data : []);
    } catch {
      // Silently fail — health data is optional
    } finally {
      setLoading(false);
    }
  };

  const loadAggregateStats = async () => {
    try {
      const [agentsRes, modelsRes, costRes, securityRes] = await Promise.all([
        aiAgentApi.getList(),
        listModels({ status: 'active' }),
        getDashboardData(),
        getSecurityStats(),
      ]);

      const agents = (agentsRes as any)?.data || agentsRes || [];
      const models = (modelsRes as any)?.data?.models || (modelsRes as any)?.models || [];
      const cost = (costRes as any)?.data || costRes;
      const security = (securityRes as any)?.data || securityRes;

      setAggregateStats({
        agentCount: Array.isArray(agents) ? agents.length : 0,
        modelCount: Array.isArray(models) ? models.length : 0,
        todayCost: Number(cost?.todayCost) || 0,
        complianceScore: Number(security?.complianceScore) || 0,
      });
    } catch {
      setAggregateError('聚合数据加载失败，请稍后重试');
    } finally {
      setAggregateLoading(false);
    }
  };

  const healthyCount = healthData.filter((h) => h.isHealthy).length;
  const totalRequests = healthData.reduce((sum, h) => sum + (h.metrics?.totalRequests || 0), 0);
  const avgLatency = healthData.length > 0
    ? Math.round(healthData.reduce((sum, h) => sum + (h.metrics?.avgLatency || 0), 0) / healthData.length)
    : 0;

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <RobotOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        AI 能力平台
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.lg }}>
        AI 驱动的研发效能提升，让工具链更智能
      </Text>

      {/* Health Stats Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="健康场景"
              value={healthyCount}
              suffix={`/ ${healthData.length}`}
              prefix={<CheckCircleOutlined style={{ color: colors.success[500] }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="总请求数"
              value={totalRequests}
              prefix={<ThunderboltOutlined style={{ color: colors.primary[500] }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="平均延迟"
              value={avgLatency}
              suffix="ms"
              prefix={<DashboardOutlined style={{ color: colors.warning[500] }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Aggregate Stats Row — 4 个 AI 域聚合数据 */}
      {aggregateError ? (
        <Alert
          message="聚合数据加载异常"
          description={aggregateError}
          type="warning"
          showIcon
          style={{ marginBottom: spacing.lg }}
          action={
            <a onClick={loadAggregateStats}>重试</a>
          }
        />
      ) : (
        <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
          <Col xs={24} sm={6}>
            <Card size="small" loading={aggregateLoading}>
              <Statistic
                title="AI Agents 在线"
                value={aggregateStats.agentCount}
                prefix={<RobotOutlined style={{ color: colors.primary[500] }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card size="small" loading={aggregateLoading}>
              <Statistic
                title="模型数量"
                value={aggregateStats.modelCount}
                prefix={<CodeOutlined style={{ color: colors.purple[500] }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card size="small" loading={aggregateLoading}>
              <Statistic
                title="今日成本"
                value={aggregateStats.todayCost}
                prefix={<DollarOutlined style={{ color: colors.success[500] }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card size="small" loading={aggregateLoading}>
              <Statistic
                title="合规评分"
                suffix="%"
                valueStyle={{
                  color: aggregateStats.complianceScore < 60 ? colors.error[500] : colors.success[500],
                }}
                prefix={
                  aggregateStats.complianceScore < 60
                    ? <CloseCircleOutlined style={{ color: colors.error[500] }} />
                    : <SafetyOutlined style={{ color: colors.success[500] }} />
                }
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Category Cards */}
      <Row gutter={[16, 16]}>
        {AICATEGORIES.map((cat) => (
          <Col key={cat.key} xs={24} sm={12} md={8} lg={8}>
            <Card
              hoverable
              size="small"
              onClick={() => navigate(cat.route)}
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

      {/* Health Status */}
      {healthData.length > 0 && (
        <>
          <Title level={3} style={{ marginTop: spacing.lg, marginBottom: spacing.md }}>
            场景健康状态
          </Title>
          <Row gutter={[16, 16]}>
            {healthData.map((h) => (
              <Col key={h.scenario} xs={24} sm={12} md={8} lg={6}>
                <Card size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      {STATE_ICONS[h.circuitState] || <WarningOutlined />}
                      <Text strong>{h.scenario}</Text>
                    </Space>
                    <Space>
                      <Tag color={h.isHealthy ? 'green' : 'red'}>
                        {h.isHealthy ? '健康' : '异常'}
                      </Tag>
                      <Tag>{h.circuitState}</Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      请求: {h.metrics?.totalRequests || 0} | 延迟: {Math.round(h.metrics?.avgLatency || 0)}ms
                    </Text>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      )}
    </div>
  );
}
