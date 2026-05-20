/**
 * 工作流画布
 *
 * 可视化节点展示、SVG 连线、节点详情
 */
import React, { useEffect, useState } from 'react';
import { Button, Empty, Space, Tag, Typography, message, Drawer, Descriptions, Divider } from 'antd';
import {
  PlayCircleOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import {
  getWorkflow,
  executeWorkflow,
  deleteWorkflow,
  type WorkflowDefinition,
  type WorkflowNode,
} from '@/api/workflow';
import { colors } from '@/tokens';

const { Text } = Typography;

interface WorkflowCanvasProps {
  workflowId: string | null;
}

const nodeTypeColors: Record<string, string> = {
  start: colors.success[500],
  approval: colors.purple[500],
  condition: colors.warning[500],
  notification: colors.info[500],
  webhook: colors.primary[500],
  end: colors.neutral[500],
};

const nodeTypeLabels: Record<string, string> = {
  start: '开始节点',
  approval: '审批节点',
  condition: '条件分支',
  notification: '通知节点',
  webhook: 'Webhook',
  end: '结束节点',
};

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ workflowId }) => {
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!workflowId) {
      setWorkflow(null);
      setSelectedNode(null);
      return;
    }
    setLoading(true);
    getWorkflow(workflowId)
      .then((data) => {
        setWorkflow(data);
        setSelectedNode(null);
      })
      .catch(() => message.error('获取工作流失败'))
      .finally(() => setLoading(false));
  }, [workflowId]);

  const handleExecute = async () => {
    if (!workflowId) return;
    try {
      await executeWorkflow(workflowId, { triggeredBy: 'user' });
      message.success('工作流已触发执行');
    } catch {
      message.error('执行失败');
    }
  };

  const handleDelete = async () => {
    if (!workflowId || !workflow) return;
    try {
      await deleteWorkflow(workflowId);
      message.success(`工作流 "${workflow.name}" 已删除`);
      setWorkflow(null);
    } catch {
      message.error('删除失败');
    }
  };

  const handleNodeClick = (node: WorkflowNode) => {
    setSelectedNode(node);
    setDrawerOpen(true);
  };

  const calculateCanvasSize = () => {
    if (!workflow?.nodes?.length) return { width: 600, height: 400 };
    const nodes = workflow.nodes;
    const maxX = Math.max(...nodes.map((n) => n.position.x)) + 200;
    const maxY = Math.max(...nodes.map((n) => n.position.y)) + 120;
    return { width: Math.max(600, maxX), height: Math.max(400, maxY) };
  };

  if (!workflowId) {
    return (
      <div style={{ padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Empty description="请先从左侧选择一个工作流" />
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center' }}>加载中...</div>;
  }

  if (!workflow) {
    return (
      <div style={{ padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Empty description="工作流不存在" />
      </div>
    );
  }

  const canvasSize = calculateCanvasSize();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${colors.neutral[200]}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <Text strong>{workflow.name}</Text>
          <Tag>v{workflow.version}</Tag>
          {workflow.enabled ? (
            <Tag color={colors.success[500]}>已启用</Tag>
          ) : (
            <Tag color={colors.warning[500]}>已暂停</Tag>
          )}
        </Space>
        <Space>
          <Button
            icon={<ZoomOutOutlined />}
            size="small"
            onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
          />
          <Text style={{ fontSize: 12 }}>{Math.round(zoom * 100)}%</Text>
          <Button
            icon={<ZoomInOutlined />}
            size="small"
            onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
          />
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={handleDelete}
          >
            删除
          </Button>
          <Button type="primary" icon={<PlayCircleOutlined />} size="small" onClick={handleExecute}>
            执行
          </Button>
        </Space>
      </div>

      {/* Canvas area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: colors.light.bg.secondary,
          position: 'relative',
        }}
      >
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            width: canvasSize.width,
            minHeight: canvasSize.height,
            position: 'relative',
          }}
        >
          {/* SVG edges */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            {workflow.edges?.map((edge) => {
              const sourceNode = workflow.nodes?.find((n) => n.id === edge.source);
              const targetNode = workflow.nodes?.find((n) => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const startX = sourceNode.position.x + 180;
              const startY = sourceNode.position.y + 40;
              const endX = targetNode.position.x;
              const endY = targetNode.position.y + 40;

              const cp1x = startX + 50;
              const cp1y = startY;
              const cp2x = endX - 50;
              const cp2y = endY;

              return (
                <g key={edge.id}>
                  <path
                    d={`M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`}
                    fill="none"
                    stroke={colors.neutral[400]}
                    strokeWidth={2}
                    markerEnd="url(#arrowhead)"
                  />
                  {edge.condition && (
                    <text
                      x={(startX + endX) / 2}
                      y={(startY + endY) / 2 - 8}
                      textAnchor="middle"
                      fontSize={11}
                      fill={colors.neutral[500]}
                    >
                      {edge.condition}
                    </text>
                  )}
                </g>
              );
            })}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill={colors.neutral[400]} />
              </marker>
            </defs>
          </svg>

          {/* Nodes */}
          {workflow.nodes?.map((node) => (
            <div
              key={node.id}
              onClick={() => handleNodeClick(node)}
              style={{
                position: 'absolute',
                left: node.position.x,
                top: node.position.y,
                width: 180,
                minHeight: 80,
                background: selectedNode?.id === node.id ? colors.primary[50] : '#fff',
                borderRadius: 12,
                padding: '12px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                borderLeft: `3px solid ${nodeTypeColors[node.type] || colors.neutral[400]}`,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: 4, fontSize: 13 }}>{node.name}</div>
              <Tag color={nodeTypeColors[node.type]} style={{ fontSize: 10 }}>
                {nodeTypeLabels[node.type] || node.type}
              </Tag>
            </div>
          ))}

          {(!workflow.nodes || workflow.nodes.length === 0) && (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Empty description="该工作流暂无节点" />
            </div>
          )}
        </div>
      </div>

      {/* Node Detail Drawer */}
      <Drawer
        title="节点详情"
        placement="right"
        width={400}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {selectedNode && (
          <>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="节点 ID">
                <Text code>{selectedNode.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="节点名称">{selectedNode.name}</Descriptions.Item>
              <Descriptions.Item label="节点类型">
                <Tag color={nodeTypeColors[selectedNode.type]}>
                  {nodeTypeLabels[selectedNode.type] || selectedNode.type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="位置">
                X: {selectedNode.position.x}, Y: {selectedNode.position.y}
              </Descriptions.Item>
            </Descriptions>

            {selectedNode.config && Object.keys(selectedNode.config).length > 0 && (
              <>
                <Divider>配置</Divider>
                <Descriptions column={1} size="small">
                  {Object.entries(selectedNode.config).map(([key, value]) => (
                    <Descriptions.Item key={key} label={key}>
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </>
            )}

            <Divider>关联</Divider>
            <div style={{ fontSize: 12 }}>
              <Text type="secondary">上游：</Text>
              <Text>
                {workflow.edges
                  ?.filter((e) => e.target === selectedNode.id)
                  .map((e) => {
                    const src = workflow.nodes?.find((n) => n.id === e.source);
                    return src ? src.name : e.source;
                  })
                  .join('、') || '无'}
              </Text>
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              <Text type="secondary">下游：</Text>
              <Text>
                {workflow.edges
                  ?.filter((e) => e.source === selectedNode.id)
                  .map((e) => {
                    const tgt = workflow.nodes?.find((n) => n.id === e.target);
                    return tgt ? tgt.name : e.target;
                  })
                  .join('、') || '无'}
              </Text>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default WorkflowCanvas;
