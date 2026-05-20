/**
 * Workflow Dependencies Page
 * 工作流依赖分析 - 循环依赖检测与可视化
 *
 * 功能：
 * 1. 全局循环依赖检测结果
 * 2. 工作流依赖图可视化
 * 3. 单个工作流检测工具
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Form,
  Input,
  Select,
  message,
  Tabs,
  Spin,
  Badge,
  Statistic,
  Row,
  Col,
  Alert,
  Empty,
  Tooltip,
  Divider,
} from 'antd';
import {
  ReloadOutlined,
  SafetyOutlined,
  WarningOutlined,
  ApiOutlined,
  SearchOutlined,
  NodeIndexOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getDependencyGraph,
  checkDefinition,
  getVisualizationData,
  type DependencyGraphResult,
  type DefinitionCheckResult,
  type VisualizationData,
  type VisualizationNode,
  type VisualizationEdge,
  type CircularDependencyPath,
} from '@/api/workflow-dependency';
import { colors } from '@/tokens/colors';

const { Title, Text, Paragraph } = Typography;

// ---- Color Maps ----

const cycleColorMap = {
  safe: colors.success[500],
  danger: colors.error[500],
};

const nodeStatusColor = (inCycle: boolean) =>
  inCycle ? colors.error[500] : colors.primary[500];

const nodeStatusBg = (inCycle: boolean) =>
  inCycle ? colors.error[50] : colors.primary[50];

// ---- Main Component ----

const WorkflowDependenciesPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Overview state
  const [graphData, setGraphData] = useState<DependencyGraphResult | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);

  // Visualization state
  const [vizData, setVizData] = useState<VisualizationData | null>(null);
  const [vizLoading, setVizLoading] = useState(false);

  // Single definition check state
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<DefinitionCheckResult | null>(null);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string>('');

  // ---- Data Loading ----

  const loadGraphData = useCallback(async () => {
    setGraphLoading(true);
    try {
      const res = await getDependencyGraph();
      setGraphData(res.data?.data ?? null);
    } catch (error: unknown) {
      setGraphData(null);
      message.error(`加载依赖图失败: ${(error as Error).message}`);
    } finally {
      setGraphLoading(false);
    }
  }, []);

  const loadVizData = useCallback(async () => {
    setVizLoading(true);
    try {
      const res = await getVisualizationData();
      setVizData(res.data?.data ?? null);
    } catch (error: unknown) {
      setVizData(null);
      message.error(`加载可视化数据失败: ${(error as Error).message}`);
    } finally {
      setVizLoading(false);
    }
  }, []);

  const handleCheckDefinition = useCallback(async () => {
    if (!selectedDefinitionId) {
      message.warning('请输入工作流定义 ID');
      return;
    }
    setCheckLoading(true);
    try {
      const res = await checkDefinition(selectedDefinitionId);
      setCheckResult(res.data?.data ?? null);
    } catch (error: unknown) {
      setCheckResult(null);
      message.error(`检查失败: ${(error as Error).message}`);
    } finally {
      setCheckLoading(false);
    }
  }, [selectedDefinitionId]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([loadGraphData(), loadVizData()]).finally(() => setLoading(false));
  }, [loadGraphData, loadVizData]);

  // ---- Render Components ----

  /**
   * 渲染循环依赖路径
   */
  const renderCyclePath = (cycle: CircularDependencyPath, index: number) => (
    <Card
      key={index}
      size="small"
      style={{
        marginBottom: 12,
        borderLeft: `3px solid ${colors.error[500]}`,
      }}
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <div>
          <Tag color="red">循环 #{index + 1}</Tag>
          <Text type="secondary">长度: {cycle.length}</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          {cycle.names.map((name, i) => (
            <React.Fragment key={i}>
              <Tag color="orange" style={{ margin: 0 }}>
                {name}
              </Tag>
              {i < cycle.names.length - 1 && (
                <ArrowRightOutlined style={{ color: colors.neutral[400], fontSize: 10 }} />
              )}
            </React.Fragment>
          ))}
        </div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          IDs: {cycle.cycle.join(' → ')}
        </Text>
      </Space>
    </Card>
  );

  /**
   * 渲染节点列表（依赖图可视化）
   */
  const renderNodeList = (nodes: VisualizationNode[]) => {
    if (nodes.length === 0) {
      return <Empty description="暂无工作流定义" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    // Group by inCycle status
    const cycleNodes = nodes.filter((n) => n.inCycle);
    const normalNodes = nodes.filter((n) => !n.inCycle);

    return (
      <div style={{ maxHeight: 400, overflow: 'auto' }}>
        {cycleNodes.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ color: colors.error[500] }}>
              循环中的工作流 ({cycleNodes.length})
            </Text>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {cycleNodes.map((node) => (
                <Tooltip key={node.id} title={`ID: ${node.id}`}>
                  <Tag
                    color="red"
                    style={{
                      cursor: 'pointer',
                      borderRadius: 6,
                    }}
                  >
                    {node.name}
                  </Tag>
                </Tooltip>
              ))}
            </div>
          </div>
        )}
        {normalNodes.length > 0 && (
          <div>
            <Text type="secondary">正常工作流 ({normalNodes.length})</Text>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {normalNodes.slice(0, 50).map((node) => (
                <Tooltip key={node.id} title={`ID: ${node.id}`}>
                  <Tag
                    style={{
                      cursor: 'pointer',
                      borderRadius: 6,
                      background: colors.primary[50],
                      borderColor: colors.primary[200],
                      color: colors.primary[700],
                    }}
                  >
                    {node.name}
                  </Tag>
                </Tooltip>
              ))}
              {normalNodes.length > 50 && (
                <Text type="secondary">...还有 {normalNodes.length - 50} 个</Text>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  /**
   * 渲染边列表（依赖关系）
   */
  const renderEdgeList = (edges: VisualizationEdge[], nodes: VisualizationNode[]) => {
    if (edges.length === 0) {
      return <Text type="secondary">暂无依赖关系</Text>;
    }

    const getNodeName = (id: string) => {
      const node = nodes.find((n) => n.id === id);
      return node?.name ?? id.slice(0, 8);
    };

    // Group edges by source
    const edgeMap = new Map<string, string[]>();
    for (const edge of edges) {
      const existing = edgeMap.get(edge.source) || [];
      existing.push(edge.target);
      edgeMap.set(edge.source, existing);
    }

    return (
      <div style={{ maxHeight: 300, overflow: 'auto' }}>
        {Array.from(edgeMap.entries()).slice(0, 30).map(([sourceId, targets]) => (
          <div
            key={sourceId}
            style={{
              padding: '6px 0',
              borderBottom: `1px solid ${colors.neutral[100]}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <Tag color="blue">{getNodeName(sourceId)}</Tag>
            <Text type="secondary">依赖</Text>
            {targets.slice(0, 5).map((targetId) => (
              <Tag key={targetId} color="purple">
                {getNodeName(targetId)}
              </Tag>
            ))}
            {targets.length > 5 && (
              <Text type="secondary">...还有 {targets.length - 5} 个</Text>
            )}
          </div>
        ))}
        {edgeMap.size > 30 && (
          <Text type="secondary">...还有 {edgeMap.size - 30} 个来源</Text>
        )}
      </div>
    );
  };

  // ---- Tab Contents ----

  const overviewTab = (
    <div>
      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="工作流定义数"
              value={graphData?.totalDefinitions ?? 0}
              prefix={<ApiOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="依赖边数"
              value={graphData?.totalEdges ?? 0}
              prefix={<NodeIndexOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="循环依赖数"
              value={graphData?.cycles.length ?? 0}
              valueStyle={{ color: (graphData?.cycles.length ?? 0) > 0 ? colors.error[500] : colors.success[500] }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="状态"
              value={graphData?.isSafe ? '安全' : '存在循环'}
              valueStyle={{
                color: graphData?.isSafe ? colors.success[500] : colors.error[500],
              }}
              prefix={<SafetyOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Safety Status Alert */}
      {graphData?.isSafe ? (
        <Alert
          message="依赖关系安全"
          description="当前所有工作流定义之间不存在循环依赖，可以正常执行。"
          type="success"
          showIcon
          icon={<SafetyOutlined />}
          style={{ marginBottom: 24 }}
        />
      ) : (
        <Alert
          message="检测到循环依赖"
          description={`发现 ${graphData?.cycles.length ?? 0} 个循环依赖，这些工作流在执行时可能会导致无限循环。请及时修复。`}
          type="error"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Cycles List */}
      <Card
        title={
          <Space>
            <WarningOutlined style={{ color: colors.error[500] }} />
            <Text>循环依赖详情</Text>
            <Tag color="red">{graphData?.cycles.length ?? 0}</Tag>
          </Space>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={loadGraphData}
            loading={graphLoading}
            size="small"
          >
            刷新
          </Button>
        }
      >
        <Spin spinning={graphLoading}>
          {graphData?.cycles && graphData.cycles.length > 0 ? (
            graphData.cycles.map((cycle, index) => renderCyclePath(cycle, index))
          ) : (
            <Empty
              description={
                graphData?.isSafe
                  ? '未检测到循环依赖'
                  : '暂无数据'
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Spin>
      </Card>
    </div>
  );

  const visualizationTab = (
    <div>
      <Row gutter={16}>
        {/* Nodes */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <ApiOutlined style={{ color: colors.primary[500] }} />
                <Text>工作流节点</Text>
                <Tag color="blue">{vizData?.nodes.length ?? 0}</Tag>
              </Space>
            }
            extra={
              <Button
                icon={<ReloadOutlined />}
                onClick={loadVizData}
                loading={vizLoading}
                size="small"
              >
                刷新
              </Button>
            }
          >
            <Spin spinning={vizLoading}>
              {vizData && renderNodeList(vizData.nodes)}
            </Spin>
          </Card>
        </Col>

        {/* Edges */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <NodeIndexOutlined style={{ color: colors.purple[500] }} />
                <Text>依赖关系</Text>
                <Tag color="purple">{vizData?.edges.length ?? 0}</Tag>
              </Space>
            }
            extra={
              <Button
                icon={<ReloadOutlined />}
                onClick={loadVizData}
                loading={vizLoading}
                size="small"
              >
                刷新
              </Button>
            }
          >
            <Spin spinning={vizLoading}>
              {vizData && renderEdgeList(vizData.edges, vizData.nodes)}
            </Spin>
          </Card>
        </Col>
      </Row>

      {/* Cycle Summary */}
      {vizData?.cycles && vizData.cycles.length > 0 && (
        <Card
          title={
            <Space>
              <WarningOutlined style={{ color: colors.error[500] }} />
              <Text>循环依赖汇总</Text>
            </Space>
          }
          style={{ marginTop: 16 }}
        >
          {vizData.cycles.map((cycle, index) => (
            <div
              key={index}
              style={{
                padding: '8px 12px',
                marginBottom: 8,
                background: colors.error[50],
                borderRadius: 6,
                borderLeft: `3px solid ${colors.error[500]}`,
              }}
            >
              <Text strong>循环 #{index + 1}:</Text>
              <span style={{ marginLeft: 8 }}>
                {cycle.names.join(' → ')}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );

  const checkTab = (
    <div>
      <Card title="单工作流循环检测" style={{ marginBottom: 24 }}>
        <Form layout="inline">
          <Form.Item label="工作流定义 ID" style={{ width: 300 }}>
            <Input
              placeholder="请输入工作流定义 ID"
              value={selectedDefinitionId}
              onChange={(e) => setSelectedDefinitionId(e.target.value)}
              onPressEnter={handleCheckDefinition}
              allowClear
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleCheckDefinition}
              loading={checkLoading}
            >
              检测
            </Button>
          </Form.Item>
        </Form>
        <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          输入要检查的工作流定义 ID，系统将分析其依赖链，判断是否存在循环依赖。
        </Paragraph>
      </Card>

      {/* Check Result */}
      <Spin spinning={checkLoading}>
        {checkResult ? (
          <div>
            {/* Status */}
            <Alert
              message={checkResult.isSafe ? '检测结果：安全' : '检测结果：存在循环依赖'}
              description={
                checkResult.isSafe
                  ? '该工作流定义不存在循环依赖，可以正常执行。'
                  : `该工作流存在 ${checkResult.cycles.length} 个循环依赖，可能导致执行时无限循环。`
              }
              type={checkResult.isSafe ? 'success' : 'error'}
              showIcon
              icon={checkResult.isSafe ? <SafetyOutlined /> : <WarningOutlined />}
              style={{ marginBottom: 24 }}
            />

            <Row gutter={16}>
              {/* Dependencies */}
              <Col span={12}>
                <Card
                  title="直接依赖的子流程"
                  size="small"
                >
                  {checkResult.dependencies.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {checkResult.dependencies.map((dep) => (
                        <Tag key={dep} color="blue">
                          {dep}
                        </Tag>
                      ))}
                    </div>
                  ) : (
                    <Text type="secondary">无直接依赖</Text>
                  )}
                </Card>
              </Col>

              {/* Cycles */}
              <Col span={12}>
                <Card
                  title={
                    <Space>
                      <WarningOutlined style={{ color: colors.error[500] }} />
                      循环依赖
                    </Space>
                  }
                  size="small"
                >
                  {checkResult.cycles.length > 0 ? (
                    checkResult.cycles.map((cycle, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '8px',
                          marginBottom: 8,
                          background: colors.error[50],
                          borderRadius: 6,
                          borderLeft: `3px solid ${colors.error[500]}`,
                        }}
                      >
                        <Text strong>循环 #{index + 1}</Text>
                        <div style={{ marginTop: 4 }}>
                          {cycle.names.join(' → ')}
                        </div>
                      </div>
                    ))
                  ) : (
                    <Text type="secondary">无循环依赖</Text>
                  )}
                </Card>
              </Col>
            </Row>
          </div>
        ) : (
          <Card>
            <Empty
              description="请输入工作流定义 ID 并点击检测按钮"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </Card>
        )}
      </Spin>
    </div>
  );

  // ---- Tab Items ----

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span>
          <SafetyOutlined /> 检测概览
        </span>
      ),
      children: overviewTab,
    },
    {
      key: 'visualization',
      label: (
        <span>
          <NodeIndexOutlined /> 依赖可视化
        </span>
      ),
      children: visualizationTab,
    },
    {
      key: 'check',
      label: (
        <span>
          <SearchOutlined /> 单工作流检测
        </span>
      ),
      children: checkTab,
    },
  ];

  // ---- Render ----

  const isInitialLoading = loading && !graphData && !vizData;

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading ? (
        <PageSkeleton cards={3} rows={8} />
      ) : (
        <>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <Title level={3} style={{ margin: 0 }}>
              <NodeIndexOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
              工作流依赖分析
            </Title>
            <Text type="secondary">
              检测工作流定义之间的循环依赖，支持依赖关系可视化
            </Text>
            {graphData && (
              <div style={{ marginTop: 8 }}>
                <Badge
                  status={graphData.isSafe ? 'success' : 'error'}
                  text={graphData.isSafe ? '无循环依赖' : `存在 ${graphData.cycles.length} 个循环`}
                />
                <Text type="secondary" style={{ marginLeft: 16, fontSize: 12 }}>
                  定义: {graphData.totalDefinitions} | 边: {graphData.totalEdges}
                </Text>
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="large"
          />
        </>
      )}
    </div>
  );
};

export default WorkflowDependenciesPage;