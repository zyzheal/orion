/**
 * DBA Audit Rule Engine Page (Yearning-style)
 * SQL audit rules: pattern matching, severity, enable/disable, CRUD with React Query optimistic updates
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@/providers/QueryProvider';
import {
  Typography,
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Popconfirm,
  Statistic,
  Row,
  Col,
  Empty,
} from 'antd';
import {
  SafetyCertificateOutlined,
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  BellOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { colors, spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
const { Title, Text } = Typography;
const { Option } = Select;

interface AuditRule {
  id: string;
  tenantId: string;
  name: string;
  pattern: string;
  severity: string;
  enabled: boolean;
  createdAt: string;
}

type Severity = 'low' | 'medium' | 'high' | 'critical';

const severityConfig: Record<Severity, { label: string; color: string }> = {
  low: { label: '低', color: 'blue' },
  medium: { label: '中', color: 'gold' },
  high: { label: '高', color: 'orange' },
  critical: { label: '严重', color: 'red' },
};

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`/api/v1/dba${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      ...options?.headers,
    },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${resp.status}`);
  }
  const json = await resp.json();
  return (json.data || json) as T;
}

const AuditRulePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AuditRule | null>(null);
  const [form] = Form.useForm<{ name: string; pattern: string; severity: string; enabled: boolean }>();

  const {
    data = { rules: [] as AuditRule[] },
    isLoading: loading,
    refetch: loadRules,
    error: queryError,
  } = useQuery({
    queryKey: ['dba', 'audit-rules'],
    queryFn: async () => {
      const rules = await apiCall<AuditRule[]>('/audit-rules');
      return { rules: Array.isArray(rules) ? rules : [] };
    },
  });

  useEffect(() => {
    if (queryError) message.warning('审计规则加载失败');
  }, [queryError]);

  const upsertMutation = useMutation({
    mutationFn: (values: { id?: string; name: string; pattern: string; severity: string; enabled: boolean }) =>
      values.id
        ? apiCall<AuditRule>(`/audit-rules/${values.id}`, { method: 'PUT', body: JSON.stringify(values) })
        : apiCall<AuditRule>('/audit-rules', { method: 'POST', body: JSON.stringify(values) }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['dba', 'audit-rules'] });
      const prev = queryClient.getQueryData<{ rules: AuditRule[] }>(['dba', 'audit-rules']);
      const optimistic: AuditRule = {
        id: variables.id || `new-${Date.now()}`,
        tenantId: 'default',
        name: variables.name,
        pattern: variables.pattern,
        severity: variables.severity,
        enabled: variables.enabled,
        createdAt: new Date().toISOString(),
      };
      if (prev) {
        const rules = prev.rules.map((r) => r.id === optimistic.id ? optimistic : r);
        queryClient.setQueryData(['dba', 'audit-rules'], {
          rules: optimistic.id.startsWith('new-') ? [...rules, optimistic] : rules,
        });
      }
      return { prev };
    },
    onSuccess: (_data, variables) => {
      message.success(variables.id ? '审计规则已更新' : '审计规则已创建');
    },
    onError: (_err, _variables, ctx) => {
      message.warning('操作失败');
      if (ctx?.prev) queryClient.setQueryData(['dba', 'audit-rules'], ctx.prev);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['dba', 'audit-rules'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiCall<void>(`/audit-rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => message.success('审计规则已删除'),
    onError: () => message.warning('删除失败'),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['dba', 'audit-rules'] }),
  });

  const rules = data.rules;
  const enabledCount = rules.filter((r) => r.enabled).length;
  const criticalCount = rules.filter((r) => r.severity === 'critical').length;

  const columns: ColumnsType<AuditRule> = [
    { title: '规则名称', dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
    { title: '匹配模式', dataIndex: 'pattern', key: 'pattern', render: (v: string) => <Text code>{v}</Text> },
    {
      title: '严重级别', dataIndex: 'severity', key: 'severity', width: 100,
      render: (v: Severity) => <Tag color={severityConfig[v]?.color || 'default'}>{severityConfig[v]?.label || v}</Tag>,
    },
    {
      title: '启用', dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '停用'}</Tag>,
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
    {
      title: '操作', key: 'action', width: 140,
      render: (_: unknown, record: AuditRule) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); }}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除此规则?" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <SafetyCertificateOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
        SQL 审计规则引擎
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        基于模式的 SQL 操作审计 · 敏感操作拦截 · 合规报表 (Yearning/Bytebase 模式)
      </Text>

      {loading ? (
        <PageSkeleton rows={5} />
      ) : (
        <>
          <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
            <Col span={8}>
              <Card size="small"><Statistic title="规则总数" value={rules.length} prefix={<FilterOutlined />} /></Card>
            </Col>
            <Col span={8}>
              <Card size="small"><Statistic title="启用规则" value={enabledCount} prefix={<SafetyCertificateOutlined />} valueStyle={{ color: colors.success[500] }} /></Card>
            </Col>
            <Col span={8}>
              <Card size="small"><Statistic title="严重级别规则" value={criticalCount} prefix={<BellOutlined />} valueStyle={{ color: criticalCount > 0 ? colors.error[500] : colors.success[500] }} /></Card>
            </Col>
          </Row>

          <Card
            title="审计规则列表"
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={() => { void loadRules(); }}>刷新</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新建规则</Button>
              </Space>
            }
          >
            <Table
              dataSource={rules}
              columns={columns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: <Empty description="暂无审计规则，请创建规则以启用 SQL 操作审计" /> }}
            />
          </Card>
        </>
      )}

      <Modal
        title={editing ? '编辑审计规则' : '新建审计规则'}
        open={modalOpen}
        confirmLoading={upsertMutation.isPending}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditing(null); }}
        onOk={async () => {
          const values = await form.validateFields();
          upsertMutation.mutate({ ...(editing || {}), ...values }, {
            onSettled: () => { setModalOpen(false); form.resetFields(); setEditing(null); },
          });
        }}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label="规则名称" name="name" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="例: 禁止 DDL 操作" />
          </Form.Item>
          <Form.Item label="匹配模式" name="pattern" rules={[{ required: true, message: '请输入 SQL 匹配模式' }]}>
            <Input placeholder="例: ^(DROP|ALTER|TRUNCATE)\b" />
          </Form.Item>
          <Form.Item label="严重级别" name="severity" rules={[{ required: true, message: '请选择严重级别' }]}>
            <Select>
              <Option value="low">低</Option>
              <Option value="medium">中</Option>
              <Option value="high">高</Option>
              <Option value="critical">严重</Option>
            </Select>
          </Form.Item>
          <Form.Item label="启用" name="enabled" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AuditRulePage;
