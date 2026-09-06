/**
 * Graph Service Page
 * Neo4j graph database query service for service dependency visualization,
 * infrastructure topology, and impact analysis.
 * Four-tab layout: Service Dependencies | Infrastructure Topology | Impact Analysis | Cypher Query
 */
import React, { useState, useEffect } from 'react';
import {
  Form,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CodeOutlined,
  DeploymentUnitOutlined,
  ShareAltOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getHealth,
  executeQuery,
  getServiceDependencies,
  getServiceDetail,
  getInfrastructureTopology,
  getImpactAnalysis,
  type GraphHealth,
  type ServiceDependency,
  type ServiceDetail,
  type InfrastructureTopology,
  type ImpactAnalysis,
} from '@/api/graph';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { DEFAULT_ACTIVE_TAB, type GraphTabKey } from './config';
import DependenciesTab from './DependenciesTab';
import InfrastructureTab from './InfrastructureTab';
import ImpactTab from './ImpactTab';
import CypherTab from './CypherTab';

const { Title, Text } = Typography;

// ---- Header Styles ----

const titleStyle: React.CSSProperties = { marginBottom: spacing.sm };
const titleIconFirstStyle: React.CSSProperties = {
  marginRight: spacing[3],
  color: colors.primary[500],
};
const titleIconSecondStyle: React.CSSProperties = {
  marginRight: spacing.sm,
  color: colors.primary[500],
};

// ---- Main Component ----

const GraphPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<GraphTabKey>(DEFAULT_ACTIVE_TAB);
  const [health, setHealth] = useState<GraphHealth | null>(null);

  // Service Dependencies state
  const [services, setServices] = useState<ServiceDependency[]>([]);
  const [svcLoading, setSvcLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceDetail | null>(null);
  const [_serviceDetailLoading, setServiceDetailLoading] = useState(false);

  // Infrastructure Topology state
  const [infraTopology, setInfraTopology] = useState<InfrastructureTopology>({
    nodes: [],
    edges: [],
  });
  const [infraLoading, setInfraLoading] = useState(false);

  // Impact Analysis state
  const [impactData, setImpactData] = useState<ImpactAnalysis | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactServiceId, setImpactServiceId] = useState<string>('');

  // Cypher Query state
  const [queryForm] = Form.useForm();
  const [queryResult, setQueryResult] = useState<{
    columns: string[];
    rows: Record<string, unknown>[];
  } | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  // ---- Data Loading ----

  const loadHealth = async () => {
    try {
      const res = await getHealth();
      setHealth(res.data ?? null);
    } catch {
      setHealth(null);
    }
  };

  const loadServices = async () => {
    setSvcLoading(true);
    try {
      const res = await getServiceDependencies({ tenantId: 'default' });
      const list = res.data;
      setServices(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setServices([]);
      message.error(`加载服务依赖失败: ${(error as Error).message}`);
    } finally {
      setSvcLoading(false);
    }
  };

  const loadInfrastructure = async () => {
    setInfraLoading(true);
    try {
      const res = await getInfrastructureTopology({ tenantId: 'default' });
      const data = res.data;
      setInfraTopology(data ?? { nodes: [], edges: [] });
    } catch (error: unknown) {
      setInfraTopology({ nodes: [], edges: [] });
      message.error(`加载基础设施拓扑失败: ${(error as Error).message}`);
    } finally {
      setInfraLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadHealth(), loadServices(), loadInfrastructure()]).finally(() =>
      setLoading(false)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Service Dependency Handlers ----

  const handleSelectService = async (id: string) => {
    setServiceDetailLoading(true);
    try {
      const res = await getServiceDetail(id);
      setSelectedService(res.data ?? null);
    } catch (error: unknown) {
      setSelectedService(null);
      message.error(`加载服务详情失败: ${(error as Error).message}`);
    } finally {
      setServiceDetailLoading(false);
    }
  };

  // ---- Impact Analysis Handler ----

  const handleAnalyzeImpact = async () => {
    if (!impactServiceId) {
      message.warning('请选择要分析的服务');
      return;
    }
    setImpactLoading(true);
    try {
      const res = await getImpactAnalysis(impactServiceId);
      setImpactData(res.data ?? null);
    } catch (error: unknown) {
      setImpactData(null);
      message.error(`影响分析失败: ${(error as Error).message}`);
    } finally {
      setImpactLoading(false);
    }
  };

  // ---- Cypher Query Handler ----

  const handleExecuteQuery = async () => {
    try {
      const values = await queryForm.validateFields();
      setQueryLoading(true);
      setQueryError(null);
      const res = await executeQuery({ query: values.cypherQuery, parameters: {} });
      const data = res.data;
      setQueryResult({
        columns: data?.columns ?? [],
        rows: data?.rows ?? [],
      });
      message.success('查询执行成功');
    } catch (error: unknown) {
      setQueryResult(null);
      setQueryError((error as Error).message);
      message.error(`查询失败: ${(error as Error).message}`);
    } finally {
      setQueryLoading(false);
    }
  };

  // ---- Tab Items ----

  const tabItems = [
    {
      key: 'dependencies' as GraphTabKey,
      label: <span><DeploymentUnitOutlined /> 服务依赖图</span>,
      children: (
        <DependenciesTab
          services={services}
          svcLoading={svcLoading}
          selectedService={selectedService}
          onCloseServiceDetail={() => setSelectedService(null)}
          onSelectService={handleSelectService}
          onRefresh={loadServices}
        />
      ),
    },
    {
      key: 'infrastructure' as GraphTabKey,
      label: <span><ShareAltOutlined /> 基础设施拓扑</span>,
      children: (
        <InfrastructureTab
          topology={infraTopology}
          infraLoading={infraLoading}
          onRefresh={loadInfrastructure}
        />
      ),
    },
    {
      key: 'impact' as GraphTabKey,
      label: <span><ThunderboltOutlined /> 影响分析</span>,
      children: (
        <ImpactTab
          impactData={impactData}
          impactLoading={impactLoading}
          impactServiceId={impactServiceId}
          onImpactServiceIdChange={setImpactServiceId}
          onAnalyzeImpact={handleAnalyzeImpact}
          onReset={() => {
            setImpactData(null);
            setImpactServiceId('');
          }}
          services={services}
        />
      ),
    },
    {
      key: 'cypher' as GraphTabKey,
      label: <span><CodeOutlined /> Cypher 查询</span>,
      children: (
        <CypherTab
          form={queryForm}
          queryLoading={queryLoading}
          queryError={queryError}
          queryResult={queryResult}
          onExecuteQuery={handleExecuteQuery}
        />
      ),
    },
  ];

  const isInitialLoading =
    loading && services.length === 0 && infraTopology.nodes.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading ? (
        <PageSkeleton cards={4} rows={8} />
      ) : (
        <>
          {/* Header */}
          <div style={{ marginBottom: spacing.lg }}>
            <Title level={2} style={titleStyle}>
              <ShareAltOutlined style={titleIconFirstStyle} />
              <ShareAltOutlined style={titleIconSecondStyle} />
              图数据库服务
            </Title>
            <Text type="secondary">
              服务依赖可视化、基础设施拓扑与影响分析 (Neo4j)
            </Text>
            {health && (
              <div style={{ marginTop: spacing.sm }}>
                <Tag
                  color={
                    health.status === 'healthy'
                      ? 'green'
                      : health.status === 'degraded'
                        ? 'orange'
                        : 'red'
                  }
                >
                  {health.status}
                </Tag>
                <Text
                  type="secondary"
                  style={{ marginLeft: spacing.sm, fontSize: 12 }}
                >
                  节点: {health.nodeCount} | 边: {health.edgeCount}
                  {health.lastChecked && ` | 最后检查: ${health.lastChecked}`}
                </Text>
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as GraphTabKey)}
            items={tabItems}
            size="large"
          />
        </>
      )}
    </div>
  );
};

export default GraphPage;
