/**
 * WorkflowCanvas — 节点配置表单（按节点类型分支渲染）
 *
 * 从 WorkflowCanvas.tsx 抽离的 renderNodeForm。
 * 纯渲染函数，无副作用；依赖审批/通知/Webhook/错误处理选项来自
 * WorkflowCanvasConfig.tsx。
 */
import React from 'react';
import { Form, Input, Select } from 'antd';
import type { WorkflowNode } from '@/api/workflow';
import {
  approvalModeOptions,
  notificationChannelOptions,
  webhookMethodOptions,
} from './WorkflowCanvasConfig';

export const renderNodeForm = (_node: WorkflowNode, _editable: boolean): React.ReactNode => {
  if (!_node) return null;

  switch (_node.type) {
    case 'start':
      return (
        <Form.Item label="描述" name="description">
          <Input.TextArea rows={2} />
        </Form.Item>
      );

    case 'end':
      return (
        <Form.Item label="描述" name="description">
          <Input.TextArea rows={2} />
        </Form.Item>
      );

    case 'approval':
      return (
        <>
          <Form.Item label="审批人" name="approvers">
            <Select mode="tags" placeholder="选择或输入审批人" />
          </Form.Item>
          <Form.Item label="审批模式" name="mode">
            <Select options={approvalModeOptions} />
          </Form.Item>
          <Form.Item label="超时时间(秒)" name="timeout">
            <Input type="number" />
          </Form.Item>
        </>
      );

    case 'notification':
      return (
        <>
          <Form.Item label="通知渠道" name="channel">
            <Select options={notificationChannelOptions} />
          </Form.Item>
          <Form.Item label="接收人" name="recipients">
            <Input placeholder="多个收件人以逗号分隔" />
          </Form.Item>
          <Form.Item label="标题" name="title">
            <Input />
          </Form.Item>
          <Form.Item label="内容模板" name="template">
            <Input.TextArea rows={3} />
          </Form.Item>
        </>
      );

    case 'webhook':
      return (
        <>
          <Form.Item label="URL" name="url">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item label="方法" name="method">
            <Select options={webhookMethodOptions} />
          </Form.Item>
          <Form.Item label="请求体" name="body">
            <Input.TextArea rows={3} />
          </Form.Item>
        </>
      );

    case 'condition':
      return (
        <>
          <Form.Item label="条件表达式" name="expression">
            <Input placeholder="${var} === 'value'" />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input />
          </Form.Item>
        </>
      );

    case 'task':
      return (
        <>
          <Form.Item label="任务标题" name="title">
            <Input />
          </Form.Item>
          <Form.Item label="负责人" name="assignee">
            <Input />
          </Form.Item>
          <Form.Item label="超时时间(分钟)" name="timeout">
            <Input type="number" />
          </Form.Item>
        </>
      );

    case 'delay':
      return (
        <Form.Item
          label="延迟时长(秒)"
          name="duration"
          rules={[
            { required: true, message: '请输入延迟时长' },
            {
              validator: (_, val) =>
                Promise.resolve(
                  val > 0 ? undefined : Promise.reject(new Error('必须为正整数')),
                ),
            },
          ]}
        >
          <Input type="number" />
        </Form.Item>
      );

    case 'timer':
      return (
        <>
          <Form.Item label="Cron 表达式" name="cron">
            <Input placeholder="0 12 * * *" />
          </Form.Item>
          <Form.Item label="时区" name="timezone">
            <Input placeholder="Asia/Shanghai" />
          </Form.Item>
        </>
      );

    case 'sub-workflow':
      return (
        <Form.Item label="子流程 ID" name="subWorkflowId">
          <Input placeholder="选择或输入子流程 ID" />
        </Form.Item>
      );

    default:
      return null;
  }
};
