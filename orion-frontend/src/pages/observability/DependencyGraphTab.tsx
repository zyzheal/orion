/**
 * DependencyGraphTab.tsx - 服务依赖图 Tab（自包含）
 * 抽取自 observability/RootCausePage.tsx (P2-9 Phase 70)
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Input,
  Alert,
  Text,
  Row,
  Col,
  message,
} from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  getDependencyGraph,
  analyzeDependencyRootCause,
  type ServiceDependency,
} from '@/api/observability';
import { spacing } from '@/tokens';
import { DEP_TYPE_COLOR_MAP } from './constants';

const DependencyGraphTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [deps, setDeps] = useState<ServiceDependency[]>([]);
  const [affectedServices, setAffectedServices] = useState('');
  const [analysisResult, setAnalysisResult] = useState<string[]>([]);

  const loadGraph = async () => {
    setLoading(true);
    try {
      const res = await getDependencyGraph();
      const rawData = (res.data as any)?.data;
      setDeps(
        Array.isArray(rawData) ? rawData : ((rawData as any)?.data as ServiceDependency[]) || []
      );
    } catch (error: unknown) {
      message.error(`加载依赖图失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, []);

  const handleAnalyze = async () => {
    if (!affectedServices) {
      message.warning('请输入受影响的服务列表');
      return;
    }
    try {
      const services = affectedServices
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await analyzeDependencyRootCause(services);
      const rawData = (res.data as any)?.data;
      setAnalysisResult(
        Array.isArray(rawData) ? rawData : ((rawData as any)?.data as string[]) || []
      );
      message.success('根因分析完成');
    } catch (error: unknown) {
      message.error(`分析失败: ${(error as Error).message}`);
    }
  };

  const columns = [
    {
      title: '服务名称',
      dataIndex: 'service',
      key: 'service',
      width: 180,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '依赖类型',
      dataIndex: 'dependencyType',
      key: 'dependencyType',
      width: 100,
      render: (v: string) => <Tag color={DEP_TYPE_COLOR_MAP[v]}>{v}</Tag>,
    },
    {
      title: '依赖服务',
      dataIndex: 'dependsOn',
      key: 'dependsOn',
      render: (deps: string[]) => (
        <Space wrap>
          {deps.map((d) => (
            <Tag key={d} color="blue">
              {d}
            </Tag>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Analysis Input */}
      <Card title="基于依赖图的根因分析">
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Input
              placeholder="输入受影响的服务（逗号分隔），如: api-gateway, auth-service"
              value={affectedServices}
              onChange={(e) => setAffectedServices(e.target.value)}
            />
          </Col>
          <Col>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleAnalyze}>
              分析根因
            </Button>
          </Col>
        </Row>
        {analysisResult.length > 0 && (
          <Alert
            message="分析结果"
            description={
              <Space wrap>
                <Text>最可能的根因服务：</Text>
                {analysisResult.map((s) => (
                  <Tag key={s} color="error">
                    {s}
                  </Tag>
                ))}
              </Space>
            }
            type="info"
            style={{ marginTop: spacing[3] }}
          />
        )}
      </Card>

      {/* Dependency Table */}
      <Card title="服务依赖关系">
        <div style={{ marginBottom: spacing.md }}>
          <Button icon={<ReloadOutlined />} onClick={loadGraph} loading={loading}>
            刷新
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={deps}
          rowKey="service"
          loading={loading}
          size="middle"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </Space>
  );
};

export default DependencyGraphTab;
