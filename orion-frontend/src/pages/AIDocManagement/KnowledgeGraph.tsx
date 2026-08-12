import React, { useState, useEffect, useCallback } from 'react';
import { Card, Select, Spin, Empty, Tag, message, Typography, Space, Row, Col } from 'antd';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import { getKnowledgeGraph } from '@/api/ai-docs';
import { BookOutlined, TagOutlined, FileTextOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

interface GraphNode {
  id: string;
  type: 'space' | 'doc' | 'tag';
  label: string;
  spaceId?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: 'contains' | 'tagged';
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const nodeColors: Record<string, string> = {
  space: colors.primary[500],
  doc: colors.success[500],
  tag: colors.warning[500],
};

const nodeIcons: Record<string, React.ReactNode> = {
  space: <BookOutlined />,
  doc: <FileTextOutlined />,
  tag: <TagOutlined />,
};

const KnowledgeGraphPage: React.FC = () => {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getKnowledgeGraph();
      const data = res as unknown as GraphData;
      setGraph(data);
    } catch (err) {
      message.error('加载知识图谱失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const filteredNodes = graph?.nodes.filter(n => selectedType === 'all' || n.type === selectedType) || [];
  const filteredEdges = graph?.edges.filter(e =>
    filteredNodes.some(n => n.id === e.source) && filteredNodes.some(n => n.id === e.target)
  ) || [];

  // Simple force-directed layout calculation
  const layout = useCallback(() => {
    if (!filteredNodes.length) return [];
    const positions: Record<string, { x: number; y: number }> = {};
    const centerX = 400;
    const centerY = 250;
    const radius = 180;

    const spaces = filteredNodes.filter(n => n.type === 'space');
    const docs = filteredNodes.filter(n => n.type === 'doc');
    const tags = filteredNodes.filter(n => n.type === 'tag');

    spaces.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / spaces.length - Math.PI / 2;
      positions[n.id] = { x: centerX + radius * 0.5 * Math.cos(angle), y: centerY + radius * 0.5 * Math.sin(angle) };
    });
    docs.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / docs.length;
      positions[n.id] = { x: centerX + radius * 0.9 * Math.cos(angle), y: centerY + radius * 0.9 * Math.sin(angle) };
    });
    tags.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / tags.length;
      positions[n.id] = { x: centerX + radius * 1.3 * Math.cos(angle), y: centerY + radius * 1.3 * Math.sin(angle) };
    });
    return positions;
  }, [filteredNodes]);

  const positions: Record<string, { x: number; y: number }> = (layout() as Record<string, { x: number; y: number }>) || {};

  return (
    <div>
      <Space style={{ marginBottom: spacing.md }}>
        <Select
          value={selectedType}
          onChange={setSelectedType}
          style={{ width: 160 }}
          options={[
            { value: 'all', label: '全部类型' },
            { value: 'space', label: '知识库' },
            { value: 'doc', label: '文档' },
            { value: 'tag', label: '标签' },
          ]}
        />
      </Space>

      <Row gutter={[spacing.md, spacing.md]}>
        <Col xs={24} lg={18}>
          <Card
            style={{ borderRadius: componentRadius.card, boxShadow: shadows.card, minHeight: 500 }}
            bodyStyle={{ padding: 0, position: 'relative' }}
          >
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 500 }}>
                <Spin size="large" tip="加载知识图谱..." />
              </div>
            ) : !graph || graph.nodes.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 500 }}>
                <Empty description="暂无知识图谱数据" />
              </div>
            ) : (
              <svg width="100%" height="500" viewBox="0 0 800 500">
                {/* Edges */}
                {filteredEdges.map((edge, i) => {
                  const src = positions[edge.source];
                  const tgt = positions[edge.target];
                  if (!src || !tgt) return null;
                  return (
                    <g key={`edge-${i}`}>
                      <line
                        x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                        stroke={edge.relation === 'tagged' ? colors.warning[500] : colors.light.border.light}
                        strokeWidth={edge.relation === 'tagged' ? 1.5 : 2}
                        strokeDasharray={edge.relation === 'tagged' ? '4,2' : 'none'}
                        opacity={0.6}
                      />
                      <text
                        x={(src.x + tgt.x) / 2} y={(src.y + tgt.y) / 2 - 4}
                        textAnchor="middle" fontSize={10}
                        fill={colors.neutral[400]}
                      >
                        {edge.relation === 'tagged' ? 'tagged' : 'contains'}
                      </text>
                    </g>
                  );
                })}
                {/* Nodes */}
                {filteredNodes.map((node) => {
                  const pos = positions[node.id];
                  if (!pos) return null;
                  const isSelected = selectedNode?.id === node.id;
                  const r = node.type === 'space' ? 22 : node.type === 'doc' ? 16 : 12;
                  return (
                    <g
                      key={node.id}
                      cursor="pointer"
                      onClick={() => setSelectedNode(node)}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle
                        cx={pos.x} cy={pos.y} r={r}
                        fill={nodeColors[node.type]}
                        stroke={isSelected ? '#fff' : 'none'}
                        strokeWidth={isSelected ? 3 : 0}
                        opacity={isSelected ? 1 : 0.85}
                      />
                      <text
                        x={pos.x} y={pos.y + r + 14}
                        textAnchor="middle" fontSize={11}
                        fill={isSelected ? colors.primary[500] : colors.neutral[600]}
                        fontWeight={isSelected ? 600 : 400}
                      >
                        {node.label.length > 10 ? node.label.slice(0, 10) + '...' : node.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card
            title="节点详情"
            style={{ borderRadius: componentRadius.card, boxShadow: shadows.card, minHeight: 500 }}
          >
            {selectedNode ? (
              <div>
                <div style={{ marginBottom: spacing.md }}>
                  <Space>
                    {nodeIcons[selectedNode.type]}
                    <Tag color={nodeColors[selectedNode.type]}>{selectedNode.type}</Tag>
                  </Space>
                </div>
                <Title level={4}>{selectedNode.label}</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: spacing.sm }}>ID: {selectedNode.id}</Text>
                {selectedNode.spaceId && (
                  <Text type="secondary" style={{ display: 'block' }}>所属知识库: {selectedNode.spaceId}</Text>
                )}
                <div style={{ marginTop: spacing.md }}>
                  <Text strong>关联关系</Text>
                  <div style={{ marginTop: spacing.sm }}>
                    {filteredEdges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).map((e, i) => {
                      const related = filteredNodes.find(n => n.id === (e.source === selectedNode.id ? e.target : e.source));
                      return (
                        <Tag key={i} style={{ marginBottom: 4, cursor: 'pointer' }}
                          onClick={() => related && setSelectedNode(related)}
                        >
                          {e.relation}: {related?.label || 'unknown'}
                        </Tag>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <Empty description="点击节点查看详情" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default KnowledgeGraphPage;