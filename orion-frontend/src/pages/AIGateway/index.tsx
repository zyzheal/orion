/**
 * AI Gateway Management Page
 * AI model routing, degradation handling, and rule engine monitoring
 */
import React, { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Tag, Space, Button, Statistic, Progress } from 'antd';
import { colors } from '@/tokens';
import {
  ThunderboltOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/DashboardLayout';
import {
  getAllHealth,
  getRules,
  getGatewayStatus,
  getEngineStatus,
} from '@/api/ai-gateway';
import type { AIGatewayHealth } from '@/api/ai-gateway';

const { Title, Text } = Typography;

interface HealthRecord {
  key: string;
  scenario: string;
  circuitState: string;
  isHealthy: boolean;
  totalRequests: number;
  errorRate: string;
  avgLatency: number;
  degradationActive: boolean;
}

const AIGatewayPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [healthData, setHealthData] = useState<AIGatewayHealth[]>([]);
  const [gatewayStatus, setGatewayStatus] = useState<{ status: string } | null>(null);
  const [engineStatus, setEngineStatus] = useState<{ cacheEnabled: boolean; auditEnabled: boolean } | null>(null);
  const [rules, setRules] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [healthRes, statusRes, engineRes, rulesRes] = await Promise.all([
        getAllHealth(),
        getGatewayStatus(),
        getEngineStatus(),
        getRules(),
      ]);
      setHealthData(healthRes.data.data.health || []);
      setGatewayStatus(statusRes.data.data);
      setEngineStatus(engineRes.data.data);
      setRules(rulesRes.data.data.rules);
    } catch (error) {
      console.error('Failed to load AI Gateway data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const circuitStateColor = (state: string) => {
    switch (state) {
      case 'CLOSED':
        return 'green';
      case 'OPEN':
        return 'red';
      case 'HALF_OPEN':
        return 'orange';
      default:
        return 'default';
    }
  };

  const columns = [
    {
      title: '场景',
      dataIndex: 'scenario',
      key: 'scenario',
      render: (text: string) => (
        <Space>
          <ThunderboltOutlined />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '熔断状态',
      dataIndex: 'circuitState',
      key: 'circuitState',
      render: (state: string) => (
        <Tag color={circuitStateColor(state)}>
          {state === 'CLOSED' ? '正常' : state === 'OPEN' ? '熔断' : '半开'}
        </Tag>
      ),
    },
    {
      title: '健康状态',
      dataIndex: 'isHealthy',
      key: 'isHealthy',
      render: (healthy: boolean) =>
        healthy ? (
          <Tag color="green"><CheckCircleOutlined /> 健康</Tag>
        ) : (
          <Tag color="red"><CloseCircleOutlined /> 异常</Tag>
        ),
    },
    {
      title: '总请求数',
      dataIndex: ['metrics', 'totalRequests'],
      key: 'totalRequests',
    },
    {
      title: '错误率',
      dataIndex: ['metrics', 'errorRate'],
      key: 'errorRate',
      render: (rate: number) => (
        <Progress
          percent={(rate || 0) * 100}
          strokeColor={rate > 0.15 ? colors.error[500] : rate > 0.05 ? colors.warning[500] : colors.success[500]}
          format={(percent) => `${((percent ?? 0) / 100).toFixed(2)}`}
          size="small"
        />
      ),
    },
    {
      title: '平均延迟 (ms)',
      dataIndex: ['metrics', 'avgLatency'],
      key: 'avgLatency',
      render: (latency: number) => `${Math.round(latency)}ms`,
    },
    {
      title: '降级状态',
      dataIndex: 'degradationActive',
      key: 'degradationActive',
      render: (active: boolean) =>
        active ? <Tag color="orange">已激活</Tag> : <Tag color="default">未激活</Tag>,
    },
  ];

  const tableData: HealthRecord[] = healthData.map((h) => ({
    key: h.scenario,
    scenario: h.scenario,
    circuitState: h.circuitState,
    isHealthy: h.isHealthy,
    totalRequests: h.metrics?.totalRequests || 0,
    errorRate: ((h.metrics?.errorRate || 0) * 100).toFixed(2) + '%',
    avgLatency: Math.round(h.metrics?.avgLatency || 0),
    degradationActive: h.degradationActive,
  }));

  return (
    <DashboardLayout>
      <div style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <Title level={2}>AI 网关管理</Title>
            <Text type="secondary">AI 模型路由、降级处理、规则引擎监控</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              刷新
            </Button>
            <Button icon={<SettingOutlined />}>配置</Button>
          </Space>
        </div>

        {/* Summary Cards */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="场景总数"
                value={healthData.length}
                prefix={<ThunderboltOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="健康场景"
                value={healthData.filter((h) => h.isHealthy).length}
                valueStyle={{ color: colors.success[500] }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="熔断场景"
                value={healthData.filter((h) => h.circuitState === 'OPEN').length}
                valueStyle={{ color: colors.error[500] }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="降级激活"
                value={healthData.filter((h) => h.degradationActive).length}
                valueStyle={{ color: colors.warning[500] }}
                prefix={<SafetyOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* Gateway Status */}
        <Card title="网关状态" style={{ marginBottom: 24 }}>
          <Space size="large">
            <div>
              <Text type="secondary">网关状态:</Text>{' '}
              <Tag color={gatewayStatus?.status === 'healthy' ? 'green' : 'red'}>
                {gatewayStatus?.status || '未知'}
              </Tag>
            </div>
            <div>
              <Text type="secondary">缓存:</Text>{' '}
              <Tag color={engineStatus?.cacheEnabled ? 'green' : 'default'}>
                {engineStatus?.cacheEnabled ? '启用' : '禁用'}
              </Tag>
            </div>
            <div>
              <Text type="secondary">审计:</Text>{' '}
              <Tag color={engineStatus?.auditEnabled ? 'green' : 'default'}>
                {engineStatus?.auditEnabled ? '启用' : '禁用'}
              </Tag>
            </div>
          </Space>
        </Card>

        {/* Health Table */}
        <Card title="场景健康监控">
          <Table
            columns={columns}
            dataSource={tableData}
            loading={loading}
            pagination={false}
          />
        </Card>

        {/* Rules Info */}
        <Card title="规则引擎" style={{ marginTop: 24 }}>
          {rules ? (
            <div>
              <Text>内置降级规则覆盖 {rules.scenarios?.length || 15} 个 AI 场景</Text>
              <div style={{ marginTop: 12 }}>
                {rules.scenarios?.map((s: string) => (
                  <Tag key={s} style={{ marginBottom: 8 }}>{s}</Tag>
                ))}
              </div>
            </div>
          ) : (
            <Text type="secondary">加载中...</Text>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AIGatewayPage;
