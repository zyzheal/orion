/**
 * APM Service Topology Page (Phase 3.5.3)
 * Service dependency visualization using ReactFlow
 * - Shows service-to-service call relationships
 * - Color-coded edges by error rate
 * - Node hover shows call metrics
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Card, Button, Tag, Space, message, Spin, Empty, Statistic, Row, Col } from 'antd';
import { DeploymentUnitOutlined, ReloadOutlined, ArrowRightOutlined, WarningOutlined, ClockCircleOutlined } from '@ant-design/icons';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  MarkerType,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  type OnNodesChange,
  type OnEdgesChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { apmApi, type ServiceDependency } from '@/api/apm';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

interface ServiceNodeData {
  name: string;
  totalCalls: number;
  avgLatency: number;
  errorRate: number;
}

const ServiceTopologyPage: React.FC = () => {
  const [dependencies, setDependencies] = useState<ServiceDependency[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);
  const [serviceStats, setServiceStats] = useState<Map<string, { calls: number; avgLatency: number; errorRate: number }>>(new Map());

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await apmApi.getServiceTopology();
      const deps: ServiceDependency[] = result.data ?? [];
      setDependencies(deps);

      // Aggregate per-service stats
      const stats = new Map<string, { calls: number; latencySum: number; latencyCount: number; errorRateSum: number; errorRateCount: number }>();
      deps.forEach((d) => {
        if (!stats.has(d.source_service)) {
          stats.set(d.source_service, { calls: 0, latencySum: 0, latencyCount: 0, errorRateSum: 0, errorRateCount: 0 });
        }
        const s = stats.get(d.source_service)!;
        s.calls += d.call_count;
        s.latencySum += d.avg_latency_ms;
        s.latencyCount += 1;
        if (d.error_rate) {
          s.errorRateSum += d.error_rate;
          s.errorRateCount += 1;
        }
      });

      const finalStats = new Map<string, { calls: number; avgLatency: number; errorRate: number }>();
      stats.forEach((v, k) => {
        finalStats.set(k, {
          calls: v.calls,
          avgLatency: v.latencyCount > 0 ? Math.round(v.latencySum / v.latencyCount) : 0,
          errorRate: v.errorRateCount > 0 ? Math.round((v.errorRateSum / v.errorRateCount) * 100) / 100 : 0,
        });
      });
      setServiceStats(finalStats);

      // Convert to ReactFlow nodes
      const uniqueServices = Array.from(new Set(deps.flatMap((d) => [d.source_service, d.target_service])));
      const flowNodes: Node[] = uniqueServices.map((name, i) => {
        const stat = finalStats.get(name);
        const isError = (stat?.errorRate ?? 0) > 5;
        const col = i % 4;
        const row = Math.floor(i / 4);
        return {
          id: name,
          position: { x: 100 + col * 280, y: 50 + row * 150 },
          data: {
            label: name,
            calls: stat?.calls ?? 0,
            avgLatency: stat?.avgLatency ?? 0,
            errorRate: stat?.errorRate ?? 0,
            isError,
          },
          style: {
            padding: '12px 16px',
            borderRadius: '12px',
            border: `2px solid ${isError ? colors.error[500] : colors.primary[500]}`,
            background: colors.neutral[0],
            minWidth: 180,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        };
      });
      setNodes(flowNodes);

      // Convert to ReactFlow edges
      const flowEdges: Edge[] = deps.map((d) => ({
        id: `${d.source_service}-${d.target_service}`,
        source: d.source_service,
        target: d.target_service,
        label: `${d.call_count} calls`,
        animated: true,
        style: {
          stroke: d.error_rate > 5 ? colors.error[500] : colors.neutral[400],
          strokeWidth: Math.max(1, Math.min(4, d.call_count / 100)),
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: d.error_rate > 5 ? colors.error[500] : colors.neutral[400] },
      }));
      setEdges(flowEdges);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载服务拓扑失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onNodesChange: OnNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange: OnEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  // Custom node renderer
  const nodeTypes = {
    serviceNode: ({ data }: { data: ServiceNodeData }) => (
      <div style={{ padding: '8px 12px', minWidth: 160 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <DeploymentUnitOutlined style={{ color: (data as any).isError ? colors.error[500] : colors.primary[500] }} />
          <Text strong style={{ fontSize: 13 }}>{data.name}</Text>
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
          <Tag style={{ margin: 0, padding: '0 6px', fontSize: 10 }}>
            <ClockCircleOutlined /> {data.avgLatency}ms
          </Tag>
          {data.errorRate > 0 && (
            <Tag color={data.errorRate > 5 ? colors.error[500] : colors.warning[500]} style={{ margin: 0, padding: '0 6px', fontSize: 10 }}>
              <WarningOutlined /> {data.errorRate}%
            </Tag>
          )}
        </div>
      </div>
    ),
  };

  const typedNodes = nodes.map((node) => ({ ...node, type: 'serviceNode' }));

  return (
    <Spin spinning={loading}>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <Title level={2} style={{ marginBottom: 8 }}>
              <DeploymentUnitOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
              服务依赖拓扑
            </Title>
            <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>服务间调用关系与依赖拓扑可视化</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
        </div>

        {/* Stats Overview */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="服务数" value={nodes.length} prefix={<DeploymentUnitOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="调用关系" value={edges.length} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="总调用次数"
                value={dependencies.reduce((sum, d) => sum + d.call_count, 0)}
                prefix={<ArrowRightOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="高错误服务"
                value={Array.from(serviceStats.values()).filter((s) => s.errorRate > 5).length}
                prefix={<WarningOutlined />}
                valueStyle={{ color: Array.from(serviceStats.values()).some((s) => s.errorRate > 5) ? colors.error[500] : colors.success[500] }}
              />
            </Card>
          </Col>
        </Row>

        {/* Topology Graph */}
        <Card styles={{ body: { padding: 0, height: 500 } }}>
          {nodes.length > 0 ? (
            <ReactFlow
              nodes={typedNodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.1}
              maxZoom={2}
              nodeTypes={nodeTypes}
            >
              <Background color={colors.neutral[200]} gap={16} size={1} />
              <Controls style={{ background: colors.neutral[0], border: `1px solid ${colors.neutral[200]}`, borderRadius: 8 }} />
              <MiniMap
                nodeColor={(node) => {
                  const d = node.data as ServiceNodeData;
                  return (d as any).isError ? colors.error[500] : colors.primary[500];
                }}
                nodeStrokeColor={colors.neutral[300]}
                nodeBorderRadius={12}
                maskColor="rgba(0, 0, 0, 0.1)"
                pannable
                zoomable
              />
            </ReactFlow>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 500 }}>
              <Empty description="暂无服务依赖数据" />
            </div>
          )}
        </Card>

        {/* Legend */}
        <Card size="small" style={{ marginTop: 16 }}>
          <Space>
            <Text type="secondary">图例：</Text>
            <Tag color={colors.primary[500]}>正常服务</Tag>
            <Tag color={colors.error[500]}>高错误率 (&gt;5%)</Tag>
            <Tag color={colors.neutral[400]}>调用关系</Tag>
            <Tag color={colors.error[500]}>高错误调用</Tag>
          </Space>
        </Card>
      </div>
    </Spin>
  );
};

export default ServiceTopologyPage;
