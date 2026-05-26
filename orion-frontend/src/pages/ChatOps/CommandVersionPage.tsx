/**
 * ChatOps 命令版本管理
 * 查看版本历史、回滚、标签管理
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, message, Tooltip, Popconfirm, Typography } from 'antd';
import { HistoryOutlined, RollbackOutlined, TagOutlined, DeleteOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { chatopsAdminApi } from '@/api/chatops-admin';
import { colors } from '@/tokens';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface CommandVersion {
  id: string;
  command_id: string;
  version: number;
  command_text: string;
  parameters: Record<string, unknown>;
  description: string;
  changelog: string;
  created_by: string;
  created_at: string;
  is_current: boolean;
  tags?: string[];
}

const CommandVersionPage: React.FC = () => {
  const [versions, setVersions] = useState<CommandVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<CommandVersion | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await chatopsAdminApi.getCommandVersions({ page, perPage });
      const data = (res as { data?: { data?: CommandVersion[]; total?: number } })?.data;
      setVersions(data?.data ?? []);
      setTotal(data?.total ?? 0);
    } catch {
      message.error('获取版本列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, perPage]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleViewDetail = (record: CommandVersion) => {
    setSelectedVersion(record);
    setDetailVisible(true);
  };

  const handleRollback = async (record: CommandVersion) => {
    try {
      await chatopsAdminApi.rollbackCommandVersion(record.command_id, record.version);
      message.success(`已回滚到 ${record.command_id} v${record.version}`);
      loadData();
    } catch {
      message.error('回滚失败');
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await chatopsAdminApi.createCommandVersion(values);
      message.success('版本已创建');
      setCreateVisible(false);
      form.resetFields();
      loadData();
    } catch {
      // validation error
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await chatopsAdminApi.deleteCommandVersion(id);
      message.success('版本已删除');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const columns: ColumnsType<CommandVersion> = [
    {
      title: '命令',
      dataIndex: 'command_id',
      key: 'command_id',
      width: 150,
      render: (v: string) => <Text code>/{v}</Text>,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: number, record) => (
        <Tag color={record.is_current ? colors.success[500] : colors.neutral[400]}>
          v{v}{record.is_current ? ' (当前)' : ''}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 150,
      render: (tags: string[]) => (
        <Space wrap>
          {tags?.map(t => <Tag key={t} icon={<TagOutlined />}>{t}</Tag>)}
        </Space>
      ),
    },
    {
      title: '创建者',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => <Text type="secondary">{dayjs(v).format('YYYY-MM-DD HH:mm')}</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => handleViewDetail(record)} />
          </Tooltip>
          {!record.is_current && (
            <Popconfirm title={`确认回滚到 v${record.version}?`} onConfirm={() => handleRollback(record)}>
              <Tooltip title="回滚">
                <Button type="link" size="small" icon={<RollbackOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
          <Popconfirm title="确认删除此版本?" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card bodyStyle={{ padding: '0 24px 24px' }}>
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${colors.light.border.light}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <HistoryOutlined style={{ color: colors.info[500], fontSize: 18 }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: colors.light.text.primary }}>
              命令版本历史
            </span>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
              新建版本
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={versions}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: perPage,
            total,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="版本详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={<Button onClick={() => setDetailVisible(false)}>关闭</Button>}
        width={600}
      >
        {selectedVersion && (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 16 }}>/{selectedVersion.command_id}</Text>
              <Tag color={selectedVersion.is_current ? colors.success[500] : 'default'}>
                v{selectedVersion.version}{selectedVersion.is_current ? ' (当前)' : ''}
              </Tag>
            </Space>
            <p><Text strong>描述:</Text> {selectedVersion.description || '-'}</p>
            <p><Text strong>变更日志:</Text> {selectedVersion.changelog || '-'}</p>
            <p><Text strong>命令内容:</Text></p>
            <pre style={{ background: colors.light.bg.secondary, padding: 12, borderRadius: 6, fontSize: 12 }}>
              {selectedVersion.command_text}
            </pre>
            {selectedVersion.parameters && Object.keys(selectedVersion.parameters).length > 0 && (
              <>
                <p><Text strong>参数:</Text></p>
                <pre style={{ background: colors.light.bg.secondary, padding: 12, borderRadius: 6, fontSize: 12 }}>
                  {JSON.stringify(selectedVersion.parameters, null, 2)}
                </pre>
              </>
            )}
            <p><Text strong>创建者:</Text> {selectedVersion.created_by}</p>
            <p><Text strong>创建时间:</Text> {dayjs(selectedVersion.created_at).format('YYYY-MM-DD HH:mm:ss')}</p>
          </div>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal
        title="新建命令版本"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={handleCreate}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="command_id" label="命令 ID" rules={[{ required: true }]}>
            <Input placeholder="deploy" />
          </Form.Item>
          <Form.Item name="command_text" label="命令内容" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="命令的实际内容" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="版本描述" />
          </Form.Item>
          <Form.Item name="changelog" label="变更日志">
            <Input.TextArea rows={2} placeholder="本次变更的内容" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CommandVersionPage;
