/**
 * VisualizationTab.tsx - 依赖可视化 Tab
 * 抽取自 WorkflowDependencies/index.tsx (P2-9 Phase 85)
 */
import React from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Empty,
  Spin,
  Tooltip,
} from 'antd';
import {
  ReloadOutlined,
  WarningOutlined,
  ApiOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import { colors } from '@/tokens/colors';
import type {
  VisualizationData,
  VisualizationNode,
  VisualizationEdge,
} from '@/api/workflow-dependency';

const { Text } = Typography;

interface VisualizationTabProps {
  vizData: VisualizationData | null;
  vizLoading: boolean;
  loadVizData: () => Promise<void>;
}

export const VisualizationTab: React.FC<VisualizationTabProps> = ({
  vizData,
  vizLoading,
  loadVizData,
}) => {
  const renderNodeList = (nodes: VisualizationNode[]) => {
    if (nodes.length === 0) {
      return <Empty description="暂无工作流定义" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    const cycleNodes = nodes.filter((n) => n.inCycle);
    const normalNodes = nodes.filter((n) => !n.inCycle);

    return (
      <div style={{ maxHeight: 400, overflow: 'auto' }}>
        {cycleNodes.length > 0 && (
          <div style={{ marginBottom: spacing.md }}>
            <Text strong style={{ color: colors.error[500] }}>
              循环中的工作流 ({cycleNodes.length})
            </Text>
            <div style={{ marginTop: spacing.sm, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {cycleNodes.map((node) => (
                <Tooltip key={node.id} title={`ID: ${node.id}`}>
                  <Tag color="red" style={{ cursor: 'pointer', borderRadius: 6 }}>
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
            <div style={{ marginTop: spacing.sm, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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

  const renderEdgeList = (edges: VisualizationEdge[], nodes: VisualizationNode[]) => {
    if (edges.length === 0) {
      return <Text type="secondary">暂无依赖关系</Text>;
    }

    const getNodeName = (id: string) => {
      const node = nodes.find((n) => n.id === id);
      return node?.name ?? id.slice(0, 8);
    };

    const edgeMap = new Map<string, string[]>();
    for (const edge of edges) {
      const existing = edgeMap.get(edge.source) || [];
      existing.push(edge.target);
      edgeMap.set(edge.source, existing);
    }

    return (
      <div style={{ maxHeight: 300, overflow: 'auto' }}>
        {Array.from(edgeMap.entries())
          .slice(0, 30)
          .map(([sourceId, targets]) => (
            <div
              key={sourceId}
              style={{
                padding: '6px 0',
                borderBottom: `1px solid ${colors.neutral[100]}`,
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
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
              {targets.length > 5 && <Text type="secondary">...还有 {targets.length - 5} 个</Text>}
            </div>
          ))}
        {edgeMap.size > 30 && <Text type="secondary">...还有 {edgeMap.size - 30} 个来源</Text>}
      </div>
    );
  };

  return (
    <div>
      <Row gutter={16}>
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
              <Button icon={<ReloadOutlined />} onClick={loadVizData} loading={vizLoading} size="small">
                刷新
              </Button>
            }
          >
            <Spin spinning={vizLoading}>{vizData && renderNodeList(vizData.nodes)}</Spin>
          </Card>
        </Col>

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
              <Button icon={<ReloadOutlined />} onClick={loadVizData} loading={vizLoading} size="small">
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

      {vizData?.cycles && vizData.cycles.length > 0 && (
        <Card
          title={
            <Space>
              <WarningOutlined style={{ color: colors.error[500] }} />
              <Text>循环依赖汇总</Text>
            </Space>
          }
          style={{ marginTop: spacing.md }}
        >
          {vizData.cycles.map((cycle, index) => (
            <div
              key={String(index)}
              style={{
                padding: '8px 12px',
                marginBottom: spacing.sm,
                background: colors.error[50],
                borderRadius: 6,
                borderLeft: `3px solid ${colors.error[500]}`,
              }}
            >
              <Text strong>循环 #{index + 1}:</Text>
              <span style={{ marginLeft: spacing.sm }}>{cycle.names.join(' → ')}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};
