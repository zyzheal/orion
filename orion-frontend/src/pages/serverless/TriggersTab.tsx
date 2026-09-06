/**
 * Serverless Page - TriggersTab
 * 从 ServerlessPage.tsx 抽出的 TriggersTab tab。
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Table, Button, Tag, Space, message, Modal, Form, Input, Select, Popconfirm, Row, Col, Empty } from 'antd';
import { PlusOutlined, ReloadOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { listTriggers, createTrigger, deleteTrigger, type ServerlessTrigger, type TriggerType } from '@/api/serverless';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { triggerTypeLabelMap, triggerTypeColorMap } from './ServerlessConfig';

const { Title, Text } = Typography;


export const TriggersTab: React.FC = () => {
  const [triggers, setTriggers] = useState<ServerlessTrigger[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTriggers();
      setTriggers((res.data as { data?: ServerlessTrigger[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载触发器失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (values: any) => {
    try {
      const config: ServerlessTrigger['config'] = {};
      if (values.type === 'http') {
        config.method = values.method || 'GET';
        config.path = values.path;
      } else if (values.type === 'cron') {
        config.schedule = values.schedule;
      } else if (values.type === 'event' || values.type === 'queue' || values.type === 'kafka') {
        config.eventSource = values.eventSource;
      } else if (values.type === 's3') {
        config.pattern = values.pattern;
      }

      await createTrigger({
        functionId: values.functionId,
        type: values.type,
        name: values.name,
        config,
      });
      message.success('触发器创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTrigger(id);
      message.success('触发器删除成功');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const columns = [
    { title: '触发器名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (t: TriggerType) => (
        <Tag color={triggerTypeColorMap[t]}>{triggerTypeLabelMap[t]}</Tag>
      ),
    },
    { title: '函数 ID', dataIndex: 'functionId', key: 'functionId', ellipsis: true },
    {
      title: '配置',
      dataIndex: 'config',
      key: 'config',
      render: (c: ServerlessTrigger['config']) => {
        const parts: string[] = [];
        if (c.method && c.path) parts.push(`${c.method} ${c.path}`);
        if (c.schedule) parts.push(`Schedule: ${c.schedule}`);
        if (c.eventSource) parts.push(`Source: ${c.eventSource}`);
        if (c.pattern) parts.push(`Pattern: ${c.pattern}`);
        return parts.join(' | ') || '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (e: boolean) => (
        <Tag color={e ? colors.success[500] : colors.neutral[500]}>{e ? '启用' : '禁用'}</Tag>
      ),
    },
    { title: '调用次数', dataIndex: 'invocationCount', key: 'invocationCount' },
    {
      title: '最近调用',
      dataIndex: 'lastInvokedAt',
      key: 'lastInvokedAt',
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, t: ServerlessTrigger) => (
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(t.id)}>
          <Button size="small" icon={<DeleteOutlined />} danger>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={3} style={{ marginBottom: spacing.sm }}>
            <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            事件触发器
          </Title>
          <Text type="secondary">管理函数的触发条件：HTTP、定时、事件、消息队列等</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setCreateModalOpen(true);
            }}
          >
            创建触发器
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={triggers}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{
          emptyText: (
            <Empty description="暂无触发器" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  form.resetFields();
                  setCreateModalOpen(true);
                }}
              >
                创建第一个触发器
              </Button>
            </Empty>
          ),
        }}
      />

      {/* Create Trigger Modal */}
      <Modal
        title="创建触发器"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="触发器名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="如: daily-cron" />
          </Form.Item>
          <Form.Item label="目标函数 ID" name="functionId" rules={[{ required: true }]}>
            <Input placeholder="选择关联的函数" />
          </Form.Item>
          <Form.Item label="触发类型" name="type" rules={[{ required: true }]} initialValue="http">
            <Select>
              <Select.Option value="http">HTTP</Select.Option>
              <Select.Option value="cron">定时任务</Select.Option>
              <Select.Option value="event">事件</Select.Option>
              <Select.Option value="queue">消息队列</Select.Option>
              <Select.Option value="kafka">Kafka</Select.Option>
              <Select.Option value="s3">对象存储</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              if (type === 'http') {
                return (
                  <>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item label="Method" name="method" initialValue="GET">
                          <Select>
                            <Select.Option value="GET">GET</Select.Option>
                            <Select.Option value="POST">POST</Select.Option>
                            <Select.Option value="PUT">PUT</Select.Option>
                            <Select.Option value="DELETE">DELETE</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={16}>
                        <Form.Item label="Path" name="path" rules={[{ required: true }]}>
                          <Input placeholder="/api/v1/hello" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                );
              }
              if (type === 'cron') {
                return (
                  <Form.Item label="Cron 表达式" name="schedule" rules={[{ required: true }]}>
                    <Input placeholder="0 0 * * *" />
                  </Form.Item>
                );
              }
              if (['event', 'queue', 'kafka'].includes(type)) {
                return (
                  <Form.Item label="事件源" name="eventSource" rules={[{ required: true }]}>
                    <Input placeholder={type === 'kafka' ? 'topic-name' : 'event-source'} />
                  </Form.Item>
                );
              }
              if (type === 's3') {
                return (
                  <Form.Item label="Key 模式" name="pattern" rules={[{ required: true }]}>
                    <Input placeholder="uploads/*.json" />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Metrics Tab
// ============================================================================

