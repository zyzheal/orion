/**
 * NodeProperties - 节点属性编辑面板
 * 根据节点类型展示不同的属性编辑表单
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  InputNumber,
  Space,
  Typography,
  Divider,
  Tag,
  Button,
} from 'antd';
import {
  SettingOutlined,
  DeleteOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import { componentRadius } from '@/tokens/radius';
import { shadows } from '@/tokens/shadows';
import { spacing } from '@/tokens/spacing';
import type { WorkflowCanvasNode, WorkflowNodeType } from './types';
import { nodeTypeConfig } from './types';

const { Text, Title } = Typography;

const { TextArea } = Input;

// ==================== 各类型节点的属性表单 ====================

/**
 * 开始节点属性
 */
const StartNodeProperties: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue({
      outputVariables: JSON.stringify((config.outputVariables as object) || {}, null, 2),
    });
  }, [config, form]);

  const handleFinish = (values: Record<string, unknown>) => {
    try {
      const outputVariables = values.outputVariables
        ? JSON.parse(values.outputVariables as string)
        : {};
      onChange({ ...config, outputVariables });
    } catch {
      // JSON 解析失败，忽略
    }
  };

  return (
    <Form form={form} layout="vertical" onValuesChange={handleFinish} size="small">
      <Form.Item label="输出变量（JSON）" name="outputVariables">
        <TextArea rows={6} placeholder='{"key": "value"}' />
      </Form.Item>
    </Form>
  );
};

/**
 * 审批节点属性
 */
const ApprovalNodeProperties: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue({
      approverType: config.approverType || 'user',
      approvalType: config.approvalType || 'or',
      timeout: config.timeout || 24,
      timeoutAction: config.timeoutAction || 'remind',
      rejectAction: config.rejectAction || 'to_initiator',
      approverIds: (config.approverIds as string[]) || [],
    });
  }, [config, form]);

  const handleFinish = (values: Record<string, unknown>) => {
    onChange({ ...config, ...values });
  };

  return (
    <Form form={form} layout="vertical" onValuesChange={handleFinish} size="small">
      <Form.Item label="审批人类型" name="approverType">
        <Select>
          <Select.Option value="user">指定用户</Select.Option>
          <Select.Option value="role">指定角色</Select.Option>
          <Select.Option value="dynamic">动态获取</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item label="审批方式" name="approvalType">
        <Select>
          <Select.Option value="or">或签（任一人通过）</Select.Option>
          <Select.Option value="and">会签（所有人通过）</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item label="审批人 ID 列表" name="approverIds">
        <Select mode="tags" placeholder="输入用户/角色 ID" />
      </Form.Item>

      <Divider style={{ margin: `${spacing.sm}px 0` }} />

      <Form.Item label="超时时间（小时）" name="timeout">
        <InputNumber min={1} max={720} style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item label="超时动作" name="timeoutAction">
        <Select>
          <Select.Option value="remind">发送提醒</Select.Option>
          <Select.Option value="approve">自动通过</Select.Option>
          <Select.Option value="reject">自动拒绝</Select.Option>
          <Select.Option value="escalate">升级处理</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item label="拒绝动作" name="rejectAction">
        <Select>
          <Select.Option value="to_initiator">退回发起人</Select.Option>
          <Select.Option value="to_previous">退回上一节点</Select.Option>
        </Select>
      </Form.Item>
    </Form>
  );
};

/**
 * 条件节点属性
 */
const ConditionNodeProperties: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue({
      expression: config.expression || '',
    });
  }, [config, form]);

  const handleFinish = (values: Record<string, unknown>) => {
    const branches = (config.branches as Array<{ name: string; condition: string }>) || [
      { name: '通过', condition: '${status} === "approved"' },
      { name: '拒绝', condition: '${status} === "rejected"' },
    ];
    onChange({ ...config, ...values, branches });
  };

  return (
    <Form form={form} layout="vertical" onValuesChange={handleFinish} size="small">
      <Form.Item label="条件表达式" name="expression">
        <TextArea rows={3} placeholder='例如: ${amount} > 10000' />
      </Form.Item>

      <Divider style={{ margin: `${spacing.sm}px 0` }} />

      <Form.Item label="分支">
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          {((config.branches as Array<{ name: string; condition: string }>) || []).map(
            (branch, index) => (
              <div
                key={index}
                style={{
                  padding: `${spacing.xs}px ${spacing.sm}px`,
                  background: colors.neutral[50],
                  borderRadius: componentRadius.tag,
                  border: `1px solid ${colors.light.border.light}`,
                }}
              >
                <Text strong style={{ fontSize: 12 }}>
                  {branch.name}
                </Text>
                <br />
                <Text code style={{ fontSize: 11 }}>
                  {branch.condition}
                </Text>
              </div>
            )
          )}
        </Space>
      </Form.Item>
    </Form>
  );
};

/**
 * 通知节点属性
 */
const NotificationNodeProperties: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue({
      template: config.template || '',
      channels: (config.channels as string[]) || ['email'],
      contentVariables: JSON.stringify(
        (config.contentVariables as object) || {},
        null,
        2
      ),
    });
  }, [config, form]);

  const handleFinish = (values: Record<string, unknown>) => {
    try {
      const contentVariables = values.contentVariables
        ? JSON.parse(values.contentVariables as string)
        : {};
      onChange({
        ...config,
        ...values,
        contentVariables,
      });
    } catch {
      // JSON 解析失败，忽略
    }
  };

  return (
    <Form form={form} layout="vertical" onValuesChange={handleFinish} size="small">
      <Form.Item label="通知模板" name="template">
        <TextArea rows={3} placeholder="支持 ${variable} 变量替换" />
      </Form.Item>

      <Form.Item label="通知渠道" name="channels">
        <Select mode="multiple">
          <Select.Option value="dingtalk">钉钉</Select.Option>
          <Select.Option value="wecom">企业微信</Select.Option>
          <Select.Option value="feishu">飞书</Select.Option>
          <Select.Option value="email">邮件</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item label="内容变量（JSON）" name="contentVariables">
        <TextArea rows={4} placeholder='{"key": "value"}' />
      </Form.Item>
    </Form>
  );
};

/**
 * Webhook 节点属性
 */
const WebhookNodeProperties: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue({
      url: config.url || '',
      method: config.method || 'POST',
      headers: JSON.stringify((config.headers as object) || {}, null, 2),
      body: config.body || '',
      timeout: config.timeout || 30000,
    });
  }, [config, form]);

  const handleFinish = (values: Record<string, unknown>) => {
    try {
      const headers = values.headers ? JSON.parse(values.headers as string) : {};
      onChange({
        ...config,
        ...values,
        headers,
      });
    } catch {
      // JSON 解析失败，忽略
    }
  };

  return (
    <Form form={form} layout="vertical" onValuesChange={handleFinish} size="small">
      <Form.Item label="URL" name="url">
        <Input placeholder="https://api.example.com/webhook" />
      </Form.Item>

      <Form.Item label="HTTP 方法" name="method">
        <Select>
          <Select.Option value="GET">GET</Select.Option>
          <Select.Option value="POST">POST</Select.Option>
          <Select.Option value="PUT">PUT</Select.Option>
          <Select.Option value="DELETE">DELETE</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item label="请求头（JSON）" name="headers">
        <TextArea rows={3} placeholder='{"Content-Type": "application/json"}' />
      </Form.Item>

      <Form.Item label="请求体" name="body">
        <TextArea rows={4} placeholder="请求体内容，支持 ${variable} 变量" />
      </Form.Item>

      <Form.Item label="超时时间（毫秒）" name="timeout">
        <InputNumber min={1000} max={120000} style={{ width: '100%' }} />
      </Form.Item>
    </Form>
  );
};

/**
 * 结束节点属性
 */
const EndNodeProperties: React.FC<{
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}> = ({ config, onChange }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue({
      outputVariables: JSON.stringify((config.outputVariables as object) || {}, null, 2),
    });
  }, [config, form]);

  const handleFinish = (values: Record<string, unknown>) => {
    try {
      const outputVariables = values.outputVariables
        ? JSON.parse(values.outputVariables as string)
        : {};
      onChange({ ...config, outputVariables });
    } catch {
      // JSON 解析失败，忽略
    }
  };

  return (
    <Form form={form} layout="vertical" onValuesChange={handleFinish} size="small">
      <Form.Item label="输出变量（JSON）" name="outputVariables">
        <TextArea rows={6} placeholder='{"result": "completed"}' />
      </Form.Item>
    </Form>
  );
};

// ==================== 主组件 ====================

export interface NodePropertiesProps {
  node: WorkflowCanvasNode | null;
  onUpdate: (nodeId: string, config: Record<string, unknown>) => void;
  onDelete?: (nodeId: string) => void;
  onClose?: () => void;
}

/**
 * NodeProperties - 节点属性面板
 * 根据选中节点的类型展示对应的属性编辑表单
 */
const NodeProperties: React.FC<NodePropertiesProps> = ({
  node,
  onUpdate,
  onDelete,
  onClose,
}) => {
  if (!node) {
    return (
      <Card
        size="small"
        title={
          <Space size={4}>
            <SettingOutlined />
            <Text strong style={{ fontSize: 13 }}>
              节点属性
            </Text>
          </Space>
        }
        style={{
          borderRadius: componentRadius.card,
          boxShadow: shadows.card,
          border: 'none',
        }}
      >
        <div style={{ textAlign: 'center', padding: `${spacing.xl}px 0` }}>
          <Text type="secondary">选择节点查看属性</Text>
        </div>
      </Card>
    );
  }

  const config = nodeTypeConfig[node.type];

  // 根据类型选择对应表单
  const renderPropertiesForm = () => {
    const handleChange = (newConfig: Record<string, unknown>) => {
      onUpdate(node.id, newConfig);
    };

    switch (node.type) {
      case 'start':
        return <StartNodeProperties config={node.config} onChange={handleChange} />;
      case 'approval':
        return <ApprovalNodeProperties config={node.config} onChange={handleChange} />;
      case 'condition':
        return <ConditionNodeProperties config={node.config} onChange={handleChange} />;
      case 'notification':
        return <NotificationNodeProperties config={node.config} onChange={handleChange} />;
      case 'webhook':
        return <WebhookNodeProperties config={node.config} onChange={handleChange} />;
      case 'end':
        return <EndNodeProperties config={node.config} onChange={handleChange} />;
      default:
        return null;
    }
  };

  return (
    <Card
      size="small"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          {/* 节点类型标识 */}
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: componentRadius.button.sm,
              background: `${config.color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: config.color,
              }}
            />
          </div>

          {/* 可编辑的节点名称 */}
          <Input
            value={node.name}
            onChange={(e) => {
              onUpdate(node.id, { ...node.config, _name: e.target.value });
            }}
            variant="borderless"
            size="small"
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: 0,
              width: 120,
            }}
          />

          <Tag color={config.color} style={{ margin: 0, fontSize: 10 }}>
            {config.label}
          </Tag>
        </div>
      }
      extra={
        <Space size={4}>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete?.(node.id)}
          />
        </Space>
      }
      style={{
        borderRadius: componentRadius.card,
        boxShadow: shadows.card,
        border: 'none',
      }}
      styles={{
        body: { padding: `${spacing.sm}px` },
      }}
    >
      {/* 节点基本信息 */}
      <div
        style={{
          padding: `${spacing.xs}px 0`,
          marginBottom: spacing.sm,
          borderBottom: `1px solid ${colors.light.border.light}`,
        }}
      >
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              节点 ID
            </Text>
            <Text code style={{ fontSize: 10 }}>
              {node.id.slice(0, 16)}...
            </Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              节点类型
            </Text>
            <Text style={{ fontSize: 11 }}>{config.label}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              位置
            </Text>
            <Text style={{ fontSize: 11 }}>
              ({node.position.x}, {node.position.y})
            </Text>
          </div>
        </Space>
      </div>

      {/* 属性表单 */}
      {renderPropertiesForm()}
    </Card>
  );
};

export default NodeProperties;
