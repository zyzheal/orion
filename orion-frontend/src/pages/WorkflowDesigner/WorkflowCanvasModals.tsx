/**
 * WorkflowCanvas Modals & Drawers
 */
import React from 'react';
import {
  Drawer,
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Tag,
  Divider,
  Typography,
} from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { WorkflowNode } from '@/api/workflow';
import { nodeTypeColors, nodeTypeLabels } from './WorkflowCanvasConfig';

const { Text } = Typography;

type FormInstance = ReturnType<typeof Form.useForm>[0];

interface WorkflowCanvasModalsProps {
  selectedNode: WorkflowNode | null;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  handleEditToggle: () => void;
  handleDeleteNode: () => void;
  handleCancelEdit: () => void;
  handleSaveNodeWithVariables: () => void;
  editForm: FormInstance;
  renderNodeForm: (node: WorkflowNode, editable: boolean) => React.ReactNode;
  renderErrorHandlingForm: (editable: boolean) => React.ReactNode;
  renderInputVariableMapping: () => React.ReactNode;
  renderOutputVariables: () => React.ReactNode;
  edgeModalOpen: boolean;
  setEdgeModalOpen: (v: boolean) => void;
  handleSaveEdge: () => void;
  editingEdge: unknown | null;
  edgeForm: FormInstance;
  handleDeleteEdge: () => void;
  addEdgeModalOpen: boolean;
  setAddEdgeModalOpen: (v: boolean) => void;
  handleAddEdge: () => void;
  addEdgeForm: FormInstance;
  workflow: { nodes?: { id: string; name: string; type: string }[] } | null;
}

export const WorkflowCanvasModals: React.FC<WorkflowCanvasModalsProps> = (props) => (
  <>
      {/* Node Detail Drawer */}
      <Drawer
        title={
          <Space>
            {props.selectedNode && (
              <Tag color={nodeTypeColors[props.selectedNode.type]}>
                {nodeTypeLabels[props.selectedNode.type] || props.selectedNode.type}
              </Tag>
            )}
            {props.selectedNode?.name || '节点详情'}
          </Space>
        }
        placement="right"
        width={480}
        open={props.drawerOpen}
        onClose={() => {
          props.setDrawerOpen(false);
          props.setEditMode(false);
        }}
        extra={
          props.selectedNode && (
            <Space>
              {!props.editMode && (
                <Button type="link" icon={<EditOutlined />} onClick={props.handleEditToggle}>
                  编辑
                </Button>
              )}
              <Button
                danger
                type="link"
                icon={<DeleteOutlined />}
                onClick={props.handleDeleteNode}
                size="small"
              >
                删除
              </Button>
            </Space>
          )
        }
        footer={
          props.editMode && (
            <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
              <Button onClick={props.handleCancelEdit}>取消</Button>
              <Button type="primary" onClick={props.handleSaveNodeWithVariables}>
                保存
              </Button>
            </Space>
          )
        }
      >
        {props.selectedNode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Text type="secondary">
              位置：X: {props.selectedNode.position.x}, Y: {props.selectedNode.position.y}
            </Text>

            <Form form={props.editForm}>
              {props.editMode && (
                <Form.Item
                  label="名称"
                  name="name"
                  rules={[{ required: true, message: '请输入节点名称' }]}
                >
                  <Input />
                </Form.Item>
              )}

              {props.editMode ? (
                <>
                  {props.renderNodeForm(props.selectedNode, true)}
                  <Divider />
                  {props.renderErrorHandlingForm(true)}
                </>
              ) : (
                <>{props.renderNodeForm(props.selectedNode, false)}</>
              )}

              {props.editMode && (
                <>
                  <Divider>输入变量映射</Divider>
                  {props.renderInputVariableMapping()}
                  <Divider>输出变量</Divider>
                  {props.renderOutputVariables()}
                </>
              )}
            </Form>
          </div>
        )}
      </Drawer>

      {/* Edge Edit Modal */}
      <Modal
        title="编辑连线"
        open={props.edgeModalOpen}
        onOk={props.handleSaveEdge}
        onCancel={() => props.setEdgeModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        {props.editingEdge && (
          <Form form={props.edgeForm} layout="vertical">
            <Form.Item label="源节点" name="source">
              <Input disabled />
            </Form.Item>
            <Form.Item label="目标节点" name="target">
              <Input disabled />
            </Form.Item>
            <Form.Item label="条件表达式" name="condition">
              <Input placeholder="可选，如：${status} === 'approved'" />
            </Form.Item>
            <Form.Item label="描述" name="label">
              <Input placeholder="连线描述" />
            </Form.Item>
            <Button danger onClick={props.handleDeleteEdge} style={{ marginTop: 8 }}>
              删除连线
            </Button>
          </Form>
        )}
      </Modal>

      {/* Add Edge Modal */}
      <Modal
        title="添加连线"
        open={props.addEdgeModalOpen}
        onOk={props.handleAddEdge}
        onCancel={() => props.setAddEdgeModalOpen(false)}
        okText="添加"
        cancelText="取消"
      >
        <Form form={props.addEdgeForm} layout="vertical">
          <Form.Item label="源节点" name="source" rules={[{ required: true }]}>
            <Select
              options={(props.workflow.nodes || []).map((n) => ({
                label: `${nodeTypeLabels[n.type] || n.type} - ${n.name}`,
                value: n.id,
              }))}
              placeholder="选择源节点"
            />
          </Form.Item>
          <Form.Item label="目标节点" name="target" rules={[{ required: true }]}>
            <Select
              options={(props.workflow.nodes || []).map((n) => ({
                label: `${nodeTypeLabels[n.type] || n.type} - ${n.name}`,
                value: n.id,
              }))}
              placeholder="选择目标节点"
            />
          </Form.Item>
          <Form.Item label="条件表达式" name="condition">
            <Input placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </>
);
