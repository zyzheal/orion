import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  BranchesOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import {
  getBranchProfiles,
  getNamespaceMatrix,
  getNamespaceBindings,
  createNamespaceBinding,
  deleteNamespaceBinding,
  validateNamespaceBinding,
  type BranchProfile,
  type BranchEnvMatrix,
  type MatrixRow,
  type NamespaceBinding,
  type CreateNamespaceInput,
  type EnvName,
  type NamespaceValidationResult,
} from '@/api/branch-policy';

const { Title, Text } = Typography;

const ENV_ORDER: EnvName[] = ['dev', 'staging', 'prod'];
const ENV_COLORS: Record<EnvName, string> = { dev: 'green', staging: 'orange', prod: 'red' };
const ENV_LABELS: Record<EnvName, string> = { dev: '开发', staging: '预发', prod: '生产' };

interface CellState {
  binding?: NamespaceBinding;
  loading: boolean;
}

export default function NamespaceMatrix() {
  const [profiles, setProfiles] = useState<BranchProfile[]>([]);
  const [matrix, setMatrix] = useState<BranchEnvMatrix | null>(null);
  const [bindings, setBindings] = useState<Record<string, NamespaceBinding>>({});
  const [loading, setLoading] = useState(true);
  const [validateLoading, setValidateLoading] = useState(false);
  const [validateResult, setValidateResult] = useState<NamespaceValidationResult | null>(null);
  const [detail, setDetail] = useState<CellState | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState<EnvName>('dev');
  const [selectedProfile, setSelectedProfile] = useState<BranchProfile | null>(null);
  const [form] = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, matrixRes, bindingsRes] = await Promise.all([
        getBranchProfiles({ status: 'active' }),
        getNamespaceMatrix(),
        getNamespaceBindings(),
      ]);
      setProfiles((profilesRes.data ?? []) as unknown as BranchProfile[]);
      setMatrix(matrixRes.data as unknown as BranchEnvMatrix);
      const list = (bindingsRes.data ?? []) as unknown as NamespaceBinding[];
      setBindings(
        Object.fromEntries(list.map((b) => [`${b.branchProfileId}|${b.envName}`, b])),
      );
    } catch (err) {
      message.error(`加载命名空间矩阵失败：${(err as Error).message ?? err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // build rows: all active branch profiles (union of profiles + matrix rows)
  const rows = useMemo<MatrixRow[]>(() => {
    const byProfileId = new Map<string, MatrixRow>();
    for (const p of profiles) {
      byProfileId.set(p.id, {
        branchProfileId: p.id,
        branchName: p.name,
        semantic: p.semantic,
        status: p.status,
        bindings: {},
      });
    }
    for (const r of matrix?.branches ?? []) {
      const existing = byProfileId.get(r.branchProfileId);
      if (existing) {
        existing.bindings = r.bindings;
      } else {
        byProfileId.set(r.branchProfileId, r);
      }
    }
    return Array.from(byProfileId.values());
  }, [profiles, matrix]);

  const totalBindings = useMemo(() => Object.keys(bindings).length, [bindings]);
  const totalBranches = rows.length;
  const healthyCount = useMemo(
    () => rows.reduce((acc, r) => acc + ENV_ORDER.filter((env) => r.bindings[env]?.exists).length, 0),
    [rows],
  );

  const cell = (row: MatrixRow, env: EnvName): MatrixRow['bindings'][EnvName] | undefined =>
    row.bindings[env];

  const openCreate = (row: MatrixRow, env: EnvName) => {
    setSelectedProfile(row);
    setSelectedEnv(env);
    setCreateOpen(true);
    form.setFieldsValue({
      envName: env,
      imageTagPrefix: `${row.branchName}-${env}`,
    });
  };

  const handleCreate = async () => {
    if (!selectedProfile) return;
    try {
      const values = await form.validateFields();
      const payload: CreateNamespaceInput = {
        branchProfileId: selectedProfile.id,
        envName: values.envName,
        imageTagPrefix: values.imageTagPrefix,
        configNamespace: values.configNamespace,
        dbName: values.dbName,
        mqTopicPrefix: values.mqTopicPrefix,
        redisKeyPrefix: values.redisKeyPrefix,
      };
      setCreating(true);
      await createNamespaceBinding(payload);
      message.success('命名空间绑定创建成功');
      setCreateOpen(false);
      form.resetFields();
      void fetchAll();
    } catch (err) {
      if ((err as { errorFields?: unknown }).errorFields) return;
      message.error(`创建失败：${(err as Error).message ?? err}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (binding: NamespaceBinding) => {
    try {
      await deleteNamespaceBinding(binding.id);
      message.success('命名空间绑定已删除');
      setDetail(null);
      void fetchAll();
    } catch (err) {
      message.error(`删除失败：${(err as Error).message ?? err}`);
    }
  };

  const handleValidate = async (binding: NamespaceBinding) => {
    setValidateLoading(true);
    try {
      const res = await validateNamespaceBinding(binding.id);
      setValidateResult(res.data as unknown as NamespaceValidationResult);
    } catch (err) {
      message.error(`校验失败：${(err as Error).message ?? err}`);
    } finally {
      setValidateLoading(false);
    }
  };

  const openDetail = (row: MatrixRow, env: EnvName) => {
    const binding = bindings[`${row.branchProfileId}|${env}`];
    setSelectedProfile({ id: row.branchProfileId, name: row.branchName } as BranchProfile);
    setSelectedEnv(env);
    setValidateResult(null);
    setDetail({ binding, loading: false });
  };

  const envColumns = ENV_ORDER.map((env) => ({
    title: (
      <Space size={4}>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: 4,
            background: '#52c41a',
          }}
        />
        {ENV_LABELS[env]}
      </Space>
    ),
    dataIndex: env,
    key: env,
    width: 220,
    render: (_: unknown, row: MatrixRow) => {
      const c = cell(row, env);
      const bound = c?.exists;
      const binding = bindings[`${row.branchProfileId}|${env}`];
      return (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          {bound ? (
            <Button
              type="text"
              size="small"
              icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              onClick={() => openDetail(row, env)}
              style={{ paddingLeft: 0 }}
            >
              <Text style={{ color: '#52c41a' }}>{binding?.imageTagPrefix ?? c?.imageTagPrefix ?? '已绑定'}</Text>
            </Button>
          ) : (
            <Button
              type="text"
              size="small"
              icon={<CloseCircleOutlined style={{ color: '#d9d9d9' }} />}
              onClick={() => openCreate(row, env)}
              style={{ paddingLeft: 0 }}
            >
              <Text type="secondary">未绑定</Text>
            </Button>
          )}
        </Space>
      );
    },
  }));

  const columns = useMemo(
    () => [
      {
        title: '分支画像',
        dataIndex: 'branchName',
        key: 'branchName',
        fixed: 'left' as const,
        width: 200,
        render: (_: unknown, row: MatrixRow) => (
          <Space direction="vertical" size={2}>
            <Text strong>{row.branchName}</Text>
            <Tag color={row.semantic === 'main' ? 'blue' : 'purple'}>{row.semantic}</Tag>
          </Space>
        ),
      },
      ...envColumns,
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, bindings],
  );

  const renderCellDetail = () => {
    if (!detail) return null;
    const { binding } = detail;
    if (!binding) {
      return (
        <Empty description="该分支在此环境未绑定命名空间">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              const row = rows.find((r) => r.branchProfileId === selectedProfile?.id);
              if (row) openCreate(row, selectedEnv);
            }}
          >
            立即绑定
          </Button>
        </Empty>
      );
    }
    const items = [
      { label: '配置命名空间', children: binding.configNamespace ?? '-' },
      { label: '数据库', children: binding.dbName ?? '-' },
      { label: 'MQ Topic 前缀', children: binding.mqTopicPrefix ?? '-' },
      { label: 'Redis Key 前缀', children: binding.redisKeyPrefix ?? '-' },
      { label: '镜像 Tag 前缀', children: binding.imageTagPrefix },
      { label: '创建时间', children: new Date(binding.createdAt).toLocaleString() },
    ];
    return (
      <>
        <Card title="命名空间详情" size="small" style={{ marginBottom: spacing.md }}>
          <Row>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map((it) => (
                <div key={it.label}>
                  <Text type="secondary">{it.label}</Text>
                  <div>
                    <Text strong>{it.children}</Text>
                  </div>
                </div>
              ))}
            </div>
          </Row>
        </Card>
        <Card title="规则校验" size="small" style={{ marginBottom: spacing.md }}>
          <Space>
            <Button
              type="primary"
              icon={<SafetyCertificateOutlined />}
              loading={validateLoading}
              onClick={() => void handleValidate(binding)}
            >
              校验命名空间合规
            </Button>
          </Space>
          {validateResult && (
            <div style={{ marginTop: 12 }}>
              <Alert
                type={validateResult.valid ? 'success' : 'error'}
                showIcon
                message={validateResult.valid ? '校验通过，命名空间规则合规' : '校验未通过，存在不合规项'}
                description={
                  validateResult.checks?.length ? (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {validateResult.checks.map((c) => (
                        <li key={c.field}>
                          <Text type={c.valid ? undefined : 'danger'}>
                            {c.field}: {c.message}
                          </Text>
                        </li>
                      ))}
                    </ul>
                  ) : undefined
                }
              />
            </div>
          )}
        </Card>
        <Card size="small">
          <Popconfirm
            title="确认删除该命名空间绑定？"
            description="删除后此环境将不再隔离该分支的配置命名空间"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => void handleDelete(binding)}
          >
            <Button danger icon={<CloseCircleOutlined />}>
              删除绑定
            </Button>
          </Popconfirm>
        </Card>
      </>
    );
  };

  if (loading && rows.length === 0) {
    return <PageSkeleton rows={12} searchBar={false} />;
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: 8 }}>
        <BranchesOutlined style={{ marginRight: 12, color: '#3370E6' }} />
        命名空间矩阵
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        分支 × 环境命名空间绑定矩阵，展示每个分支在各环境的配置隔离状态
      </Text>

      <Row gutter={[16, 16]} style={{ marginBottom: spacing.md }}>
        <StatCard title="分支总数" value={totalBranches} />
        <StatCard title="已绑定命名空间" value={totalBindings} />
        <StatCard title="绑定环境格数" value={healthyCount} />
      </Row>

      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
          }}
        >
          <Space>
            <Text strong>分支 × 环境矩阵</Text>
            <Text type="secondary">（点击「未绑定」创建绑定，点击「已绑定」查看/校验）</Text>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={() => void fetchAll()}>
            刷新
          </Button>
        </div>
        {rows.length === 0 ? (
          <Empty description="暂无 active 分支画像" />
        ) : (
          <Table
            rowKey="branchProfileId"
            columns={columns}
            dataSource={rows}
            pagination={false}
            scroll={{ x: 860 }}
          />
        )}
      </Card>

      <Modal
        title={`为「${selectedProfile?.name ?? ''}」创建 ${selectedEnv} 环境命名空间`}
        open={createOpen}
        onOk={() => void handleCreate()}
        confirmLoading={creating}
        onCancel={() => {
          setCreateOpen(false);
          form.resetFields();
        }}
        okText="创建绑定"
        cancelText="取消"
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="envName"
            label="环境"
            rules={[{ required: true, message: '请选择环境' }]}
          >
            <Input disabled />
          </Form.Item>
          <Form.Item
            name="imageTagPrefix"
            label="镜像 Tag 前缀"
            rules={[
              { required: true, message: '请输入镜像 Tag 前缀' },
              {
                pattern: /^[a-z0-9][a-z0-9-]*$/,
                message: '仅支持小写字母、数字、连字符',
              },
            ]}
          >
            <Input placeholder="例如 main-prod" />
          </Form.Item>
          <Form.Item name="configNamespace" label="配置命名空间">
            <Input placeholder="例如 config/main-prod" />
          </Form.Item>
          <Form.Item name="dbName" label="数据库名">
            <Input placeholder="例如 orion_main_prod" />
          </Form.Item>
          <Form.Item name="mqTopicPrefix" label="MQ Topic 前缀">
            <Input placeholder="例如 mq.main-prod" />
          </Form.Item>
          <Form.Item name="redisKeyPrefix" label="Redis Key 前缀">
            <Input placeholder="例如 main-prod:" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`${selectedProfile?.name ?? ''} · ${selectedEnv} 环境`}
        width={560}
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {renderCellDetail()}
      </Drawer>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div style={{ flex: 1, minWidth: 160 }}>
      <Card>
        <Statistic title={title} value={value} />
      </Card>
    </div>
  );
}
