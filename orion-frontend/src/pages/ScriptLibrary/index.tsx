/**
 * Script Library Page
 *
 * Features:
 * - Script CRUD with category/type filter and tags
 * - Version management: create new version, rollback
 * - Parameter management: add/edit/delete parameters
 * - Execute script with parameter input form
 * - Execution history with output/error display
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  message,
  Modal,
  Form,
  Input,
  Select,
  Row,
  Col,
  Tabs,
  Drawer,
  Descriptions,
  Popconfirm,
  Empty,
  Timeline,
  InputNumber,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  CodeOutlined,
  PlayCircleOutlined,
  HistoryOutlined,
  RollbackOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import {
  listScripts,
  createScript,
  updateScript,
  deleteScript,
  listVersions,
  createVersion,
  rollbackVersion,
  listParameters,
  setParameters,
  executeScript,
  getExecutionHistory,
  type ScriptEntry,
  type ScriptVersion,
  type ScriptParameter,
  type ScriptExecution,
  type CreateScriptInput,
  type CreateVersionInput,
  type CreateParameterInput,
} from '@/api/script-library';

const { Title, Text } = Typography;
const { TextArea } = Input;

const scriptTypeLabel: Record<string, string> = {
  shell: 'Shell',
  python: 'Python',
  powershell: 'PowerShell',
  ansible: 'Ansible',
};

const scriptTypeColor: Record<string, string> = {
  shell: 'green',
  python: 'blue',
  powershell: 'purple',
  ansible: 'orange',
};

const paramTypeLabel: Record<string, string> = {
  string: '字符串',
  number: '数字',
  boolean: '布尔',
  secret: '密钥',
};

const statusColor: Record<string, string> = {
  pending: colors.neutral[400],
  running: colors.primary[500],
  completed: colors.success[500],
  failed: colors.error[500],
};

const statusLabel: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
};

export default function ScriptLibraryPage() {
  // Script list state
  const [scripts, setScripts] = useState<ScriptEntry[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | undefined>();
  const [filterType, setFilterType] = useState<string | undefined>();

  // Script modal state
  const [scriptModalVisible, setScriptModalVisible] = useState(false);
  const [scriptConfirmLoading, setScriptConfirmLoading] = useState(false);
  const [editingScript, setEditingScript] = useState<ScriptEntry | null>(null);
  const [scriptForm] = Form.useForm();

  // Detail drawer state
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedScript, setSelectedScript] = useState<ScriptEntry | null>(null);

  // Version state
  const [versions, setVersions] = useState<ScriptVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [versionForm] = Form.useForm();

  // Parameter state
  const [parameters, setParametersList] = useState<ScriptParameter[]>([]);
  const [paramsLoading, setParamsLoading] = useState(false);
  const [paramModalVisible, setParamModalVisible] = useState(false);
  const [paramForm] = Form.useForm();
  const [editingParam, setEditingParam] = useState<ScriptParameter | null>(null);

  // Execute state
  const [executeModalVisible, setExecuteModalVisible] = useState(false);
  const [executingScript, setExecutingScript] = useState<ScriptEntry | null>(null);
  const [executeForm] = Form.useForm();

  // Execution history state
  const [executions, setExecutions] = useState<ScriptExecution[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  const [historyScriptId, setHistoryScriptId] = useState<string | undefined>();
  const [execDetailVisible, setExecDetailVisible] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<ScriptExecution | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState('scripts');

  // Category options (derived from scripts)
  const categoryOptions = Array.from(new Set(scripts.map((s) => s.category).filter(Boolean))) as string[];

  // ==================== Script CRUD ====================

  const fetchScripts = useCallback(async () => {
    setScriptsLoading(true);
    try {
      const res = await listScripts({
        category: filterCategory,
        scriptType: filterType,
      });
      setScripts(res.data ?? []);
    } catch {
      message.error('获取脚本列表失败');
    } finally {
      setScriptsLoading(false);
    }
  }, [filterCategory, filterType]);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  const handleCreateScript = () => {
    setEditingScript(null);
    scriptForm.resetFields();
    setScriptModalVisible(true);
  };

  const handleEditScript = (record: ScriptEntry) => {
    setEditingScript(record);
    scriptForm.setFieldsValue({
      name: record.name,
      description: record.description,
      scriptType: record.scriptType,
      category: record.category,
      tags: record.tags,
    });
    setScriptModalVisible(true);
  };

  const handleSaveScript = async () => {
    try {
      const values = await scriptForm.validateFields();
      setScriptConfirmLoading(true);
      const input: CreateScriptInput = {
        name: values.name,
        description: values.description,
        scriptType: values.scriptType,
        category: values.category,
        tags: values.tags ?? [],
      };
      if (editingScript) {
        await updateScript(editingScript.id, input);
        message.success('脚本更新成功');
      } else {
        await createScript(input);
        message.success('脚本创建成功');
      }
      setScriptModalVisible(false);
      fetchScripts();
    } catch (err: any) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('保存失败');
    } finally {
      setScriptConfirmLoading(false);
    }
  };

  const handleDeleteScript = async (id: string) => {
    try {
      await deleteScript(id);
      message.success('删除成功');
      fetchScripts();
    } catch {
      message.error('删除失败');
    }
  };

  // ==================== Detail Drawer ====================

  const handleViewDetail = async (record: ScriptEntry) => {
    setSelectedScript(record);
    setDrawerVisible(true);
    await Promise.all([fetchVersions(record.id), fetchParameters(record.id)]);
  };

  // ==================== Version Management ====================

  const fetchVersions = async (scriptId: string) => {
    setVersionsLoading(true);
    try {
      const res = await listVersions(scriptId);
      setVersions(res.data ?? []);
    } catch {
      // ignore
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleCreateVersion = () => {
    versionForm.resetFields();
    setVersionModalVisible(true);
  };

  const handleSaveVersion = async () => {
    if (!selectedScript) return;
    try {
      const values = await versionForm.validateFields();
      const input: CreateVersionInput = {
        content: values.content,
        changelog: values.changelog,
      };
      await createVersion(selectedScript.id, input);
      message.success('版本创建成功');
      setVersionModalVisible(false);
      fetchVersions(selectedScript.id);
    } catch {
      message.error('版本创建失败');
    }
  };

  const handleRollback = async (version: number) => {
    if (!selectedScript) return;
    try {
      await rollbackVersion(selectedScript.id, version);
      message.success(`已回滚到版本 ${version}`);
      fetchVersions(selectedScript.id);
    } catch {
      message.error('回滚失败');
    }
  };

  // ==================== Parameter Management ====================

  const fetchParameters = async (scriptId: string) => {
    setParamsLoading(true);
    try {
      const res = await listParameters(scriptId);
      setParametersList(res.data ?? []);
    } catch {
      // ignore
    } finally {
      setParamsLoading(false);
    }
  };

  const handleAddParam = () => {
    setEditingParam(null);
    paramForm.resetFields();
    paramForm.setFieldsValue({ paramType: 'string', required: false });
    setParamModalVisible(true);
  };

  const handleEditParam = (param: ScriptParameter) => {
    setEditingParam(param);
    paramForm.setFieldsValue({
      paramKey: param.paramKey,
      paramType: param.paramType,
      required: param.required,
      defaultValue: param.defaultValue,
      description: param.description,
    });
    setParamModalVisible(true);
  };

  const handleSaveParam = async () => {
    if (!selectedScript) return;
    try {
      const values = await paramForm.validateFields();
      const newParam: CreateParameterInput = {
        paramKey: values.paramKey,
        paramType: values.paramType,
        required: values.required,
        defaultValue: values.defaultValue,
        description: values.description,
      };

      let updatedParams: CreateParameterInput[];
      if (editingParam) {
        updatedParams = parameters.map((p) =>
          p.paramKey === editingParam.paramKey
            ? newParam
            : { paramKey: p.paramKey, paramType: p.paramType, required: p.required, defaultValue: p.defaultValue ?? undefined, description: p.description ?? undefined },
        );
      } else {
        updatedParams = [
          ...parameters.map((p) => ({
            paramKey: p.paramKey,
            paramType: p.paramType,
            required: p.required,
            defaultValue: p.defaultValue ?? undefined,
            description: p.description ?? undefined,
          })),
          newParam,
        ];
      }

      await setParameters(selectedScript.id, updatedParams);
      message.success(editingParam ? '参数更新成功' : '参数添加成功');
      setParamModalVisible(false);
      fetchParameters(selectedScript.id);
    } catch {
      message.error('保存参数失败');
    }
  };

  const handleDeleteParam = async (paramKey: string) => {
    if (!selectedScript) return;
    try {
      const remaining = parameters
        .filter((p) => p.paramKey !== paramKey)
        .map((p) => ({
          paramKey: p.paramKey,
          paramType: p.paramType,
          required: p.required,
          defaultValue: p.defaultValue ?? undefined,
          description: p.description ?? undefined,
        }));
      await setParameters(selectedScript.id, remaining);
      message.success('参数删除成功');
      fetchParameters(selectedScript.id);
    } catch {
      message.error('删除参数失败');
    }
  };

  // ==================== Execute Script ====================

  const handleOpenExecute = async (record: ScriptEntry) => {
    setExecutingScript(record);
    executeForm.resetFields();
    setExecuteModalVisible(true);
    // Load parameters for form generation
    try {
      const res = await listParameters(record.id);
      const params = res.data ?? [];
      setParametersList(params);
      // Pre-fill default values
      const defaults: Record<string, unknown> = {};
      params.forEach((p) => {
        if (p.defaultValue) {
          defaults[p.paramKey] = p.paramType === 'number' ? Number(p.defaultValue) : p.paramType === 'boolean' ? p.defaultValue === 'true' : p.defaultValue;
        }
      });
      executeForm.setFieldsValue({ params: defaults });
    } catch {
      // ignore
    }
  };

  const handleExecute = async () => {
    if (!executingScript) return;
    try {
      const values = await executeForm.validateFields();
      await executeScript(executingScript.id, {
        params: values.params ?? {},
        targets: values.targets ? { host: values.targets } : undefined,
      });
      message.success('脚本执行已启动');
      setExecuteModalVisible(false);
    } catch {
      message.error('执行失败');
    }
  };

  // ==================== Execution History ====================

  const fetchExecutions = useCallback(async () => {
    setExecutionsLoading(true);
    try {
      if (historyScriptId) {
        const res = await getExecutionHistory(historyScriptId);
        setExecutions(res.data ?? []);
      }
    } catch {
      message.error('获取执行历史失败');
    } finally {
      setExecutionsLoading(false);
    }
  }, [historyScriptId]);

  useEffect(() => {
    if (activeTab === 'history' && historyScriptId) {
      fetchExecutions();
    }
  }, [activeTab, historyScriptId, fetchExecutions]);

  // ==================== Columns ====================

  const scriptColumns: ColumnsType<ScriptEntry> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record) => (
        <a onClick={() => handleViewDetail(record)}>{text}</a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'scriptType',
      key: 'scriptType',
      render: (type: string) => (
        <Tag color={scriptTypeColor[type]}>{scriptTypeLabel[type] ?? type}</Tag>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (cat: string | null) => (cat ? <Tag>{cat}</Tag> : '-'),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) =>
        tags?.length ? (
          <Space size={4} wrap>
            {tags.map((t) => (
              <Tag key={t} color="default" style={{ borderRadius: 4 }}>
                {t}
              </Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={() => handleOpenExecute(record)}
            disabled={!record.enabled}
          >
            执行
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditScript(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除此脚本？" onConfirm={() => handleDeleteScript(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const versionColumns: ColumnsType<ScriptVersion> = [
    {
      title: '版本号',
      dataIndex: 'version',
      key: 'version',
      render: (v: number) => <Tag color="blue">v{v}</Tag>,
    },
    {
      title: '变更说明',
      dataIndex: 'changelog',
      key: 'changelog',
      render: (text: string | null) => text ?? '-',
    },
    {
      title: '校验和',
      dataIndex: 'checksum',
      key: 'checksum',
      render: (text: string) => (
        <Text code style={{ fontSize: 12 }}>
          {text.substring(0, 12)}...
        </Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title={`确认回滚到版本 v${record.version}？`}
          onConfirm={() => handleRollback(record.version)}
        >
          <Button type="link" icon={<RollbackOutlined />}>
            回滚
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const paramColumns: ColumnsType<ScriptParameter> = [
    {
      title: '参数名',
      dataIndex: 'paramKey',
      key: 'paramKey',
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'paramType',
      key: 'paramType',
      render: (type: string) => <Tag>{paramTypeLabel[type] ?? type}</Tag>,
    },
    {
      title: '必填',
      dataIndex: 'required',
      key: 'required',
      render: (required: boolean) => (
        <Tag color={required ? 'red' : 'default'}>{required ? '是' : '否'}</Tag>
      ),
    },
    {
      title: '默认值',
      dataIndex: 'defaultValue',
      key: 'defaultValue',
      render: (val: string | null) => (val ? <Text code>{val}</Text> : '-'),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      render: (text: string | null) => text ?? '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditParam(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除此参数？" onConfirm={() => handleDeleteParam(record.paramKey)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const executionColumns: ColumnsType<ScriptExecution> = [
    {
      title: '脚本',
      dataIndex: 'scriptId',
      key: 'scriptId',
      render: (id: string) => {
        const script = scripts.find((s) => s.id === id);
        return script?.name ?? id.substring(0, 8);
      },
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (v: number) => <Tag>v{v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColor[status]}>{statusLabel[status] ?? status}</Tag>
      ),
    },
    {
      title: '耗时',
      dataIndex: 'durationMs',
      key: 'durationMs',
      render: (ms: number | null) => (ms != null ? `${ms}ms` : '-'),
    },
    {
      title: '执行者',
      dataIndex: 'executedBy',
      key: 'executedBy',
      render: (text: string | null) => text ?? '-',
    },
    {
      title: '执行时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Button
          type="link"
          icon={<HistoryOutlined />}
          onClick={() => {
            setSelectedExecution(record);
            setExecDetailVisible(true);
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  // ==================== Render ====================

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: 16 }}>
        <CodeOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        脚本库
      </Title>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'scripts',
            label: '脚本列表',
            children: (
              <Card
                style={{
                  borderRadius: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
                  <Col>
                    <Space>
                      <Select
                        placeholder="按分类筛选"
                        allowClear
                        style={{ width: 160 }}
                        value={filterCategory}
                        onChange={setFilterCategory}
                      >
                        {categoryOptions.map((cat) => (
                          <Select.Option key={cat} value={cat}>
                            {cat}
                          </Select.Option>
                        ))}
                      </Select>
                      <Select
                        placeholder="按类型筛选"
                        allowClear
                        style={{ width: 160 }}
                        value={filterType}
                        onChange={setFilterType}
                      >
                        {Object.entries(scriptTypeLabel).map(([val, label]) => (
                          <Select.Option key={val} value={val}>
                            {label}
                          </Select.Option>
                        ))}
                      </Select>
                      <Button icon={<ReloadOutlined />} onClick={fetchScripts}>
                        刷新
                      </Button>
                    </Space>
                  </Col>
                  <Col>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateScript}>
                      创建脚本
                    </Button>
                  </Col>
                </Row>
                <Table
                  columns={scriptColumns}
                  dataSource={scripts}
                  rowKey="id"
                  loading={scriptsLoading}
                  pagination={{ pageSize: 20 }}
                />
              </Card>
            ),
          },
          {
            key: 'versions',
            label: '版本管理',
            children: (
              <Card
                style={{
                  borderRadius: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
                  <Col>
                    <Select
                      placeholder="选择脚本查看版本"
                      style={{ width: 300 }}
                      showSearch
                      optionFilterProp="children"
                      onChange={(val) => {
                        const script = scripts.find((s) => s.id === val) ?? null;
                        setSelectedScript(script);
                        fetchVersions(val);
                      }}
                    >
                      {scripts.map((s) => (
                        <Select.Option key={s.id} value={s.id}>
                          {s.name}
                        </Select.Option>
                      ))}
                    </Select>
                  </Col>
                  <Col>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleCreateVersion}
                      disabled={!selectedScript}
                    >
                      创建版本
                    </Button>
                  </Col>
                </Row>
                {selectedScript ? (
                  <Table
                    columns={versionColumns}
                    dataSource={versions}
                    rowKey="id"
                    loading={versionsLoading}
                    pagination={false}
                  />
                ) : (
                  <Empty description="请先选择一个脚本" />
                )}
              </Card>
            ),
          },
          {
            key: 'history',
            label: '执行历史',
            children: (
              <Card
                style={{
                  borderRadius: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
                  <Col>
                    <Space>
                      <Select
                        placeholder="选择脚本查看执行历史"
                        style={{ width: 300 }}
                        showSearch
                        optionFilterProp="children"
                        value={historyScriptId}
                        onChange={(val) => setHistoryScriptId(val)}
                      >
                        {scripts.map((s) => (
                          <Select.Option key={s.id} value={s.id}>
                            {s.name}
                          </Select.Option>
                        ))}
                      </Select>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={fetchExecutions}
                        disabled={!historyScriptId}
                      >
                        刷新
                      </Button>
                    </Space>
                  </Col>
                </Row>
                {historyScriptId ? (
                  <Table
                    columns={executionColumns}
                    dataSource={executions}
                    rowKey="id"
                    loading={executionsLoading}
                    pagination={{ pageSize: 20 }}
                  />
                ) : (
                  <Empty description="请先选择一个脚本查看执行历史" />
                )}
              </Card>
            ),
          },
        ]}
      />

      {/* ==================== Create/Edit Script Modal ==================== */}
      <Modal
        title={editingScript ? '编辑脚本' : '创建脚本'}
        open={scriptModalVisible}
        onOk={handleSaveScript}
        confirmLoading={scriptConfirmLoading}
        onCancel={() => setScriptModalVisible(false)}
        width={600}
      >
        <Form form={scriptForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入脚本名称' }]}>
            <Input placeholder="输入脚本名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="输入脚本描述" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="scriptType"
                label="脚本类型"
                rules={[{ required: true, message: '请选择脚本类型' }]}
              >
                <Select placeholder="选择脚本类型">
                  {Object.entries(scriptTypeLabel).map(([val, label]) => (
                    <Select.Option key={val} value={val}>
                      {label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="分类">
                <Select placeholder="选择或输入分类" allowClear showSearch>
                  {categoryOptions.map((cat) => (
                    <Select.Option key={cat} value={cat}>
                      {cat}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签后回车" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== Detail Drawer ==================== */}
      <Drawer
        title={selectedScript?.name ?? '脚本详情'}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={700}
      >
        {selectedScript && (
          <>
            <Descriptions
              column={2}
              bordered
              size="small"
              style={{ marginBottom: spacing.lg }}
            >
              <Descriptions.Item label="类型">
                <Tag color={scriptTypeColor[selectedScript.scriptType]}>
                  {scriptTypeLabel[selectedScript.scriptType]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="分类">{selectedScript.category ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {selectedScript.description ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="标签" span={2}>
                {selectedScript.tags?.length ? (
                  <Space size={4} wrap>
                    {selectedScript.tags.map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </Space>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={selectedScript.enabled ? 'green' : 'default'}>
                  {selectedScript.enabled ? '启用' : '禁用'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(selectedScript.createdAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            {/* Version History */}
            <div style={{ marginBottom: spacing.lg }}>
              <Row justify="space-between" align="middle" style={{ marginBottom: spacing.sm }}>
                <Title level={4} style={{ margin: 0 }}>
                  版本历史
                </Title>
                <Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    size="small"
                    onClick={handleCreateVersion}
                  >
                    新建版本
                  </Button>
                </Space>
              </Row>
              {versions.length === 0 ? (
                <Empty description="暂无版本" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Timeline
                  items={versions.map((v) => ({
                    color: colors.primary[500],
                    children: (
                      <div>
                        <Space>
                          <Tag color="blue">v{v.version}</Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(v.createdAt).format('YYYY-MM-DD HH:mm')}
                          </Text>
                          <Popconfirm
                            title={`确认回滚到 v${v.version}？`}
                            onConfirm={() => handleRollback(v.version)}
                          >
                            <Button type="link" size="small" icon={<RollbackOutlined />}>
                              回滚
                            </Button>
                          </Popconfirm>
                        </Space>
                        {v.changelog && (
                          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                            {v.changelog}
                          </Text>
                        )}
                      </div>
                    ),
                  }))}
                />
              )}
            </div>

            {/* Parameters */}
            <div>
              <Row justify="space-between" align="middle" style={{ marginBottom: spacing.sm }}>
                <Title level={4} style={{ margin: 0 }}>
                  <SettingOutlined style={{ marginRight: 8 }} />
                  参数配置
                </Title>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={handleAddParam}
                >
                  添加参数
                </Button>
              </Row>
              {parameters.length === 0 ? (
                <Empty description="暂无参数配置" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Table
                  columns={paramColumns}
                  dataSource={parameters}
                  rowKey="paramKey"
                  loading={paramsLoading}
                  size="small"
                  pagination={false}
                />
              )}
            </div>
          </>
        )}
      </Drawer>

      {/* ==================== Create Version Modal ==================== */}
      <Modal
        title="创建新版本"
        open={versionModalVisible}
        onOk={handleSaveVersion}
        onCancel={() => setVersionModalVisible(false)}
        width={600}
      >
        <Form form={versionForm} layout="vertical">
          <Form.Item
            name="content"
            label="脚本内容"
            rules={[{ required: true, message: '请输入脚本内容' }]}
          >
            <TextArea
              rows={12}
              placeholder="输入脚本代码..."
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Form.Item>
          <Form.Item name="changelog" label="变更说明">
            <Input placeholder="描述本次变更内容" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== Parameter Modal ==================== */}
      <Modal
        title={editingParam ? '编辑参数' : '添加参数'}
        open={paramModalVisible}
        onOk={handleSaveParam}
        onCancel={() => setParamModalVisible(false)}
        width={500}
      >
        <Form form={paramForm} layout="vertical">
          <Form.Item
            name="paramKey"
            label="参数名"
            rules={[{ required: true, message: '请输入参数名' }]}
          >
            <Input placeholder="例如: target_host" disabled={!!editingParam} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="paramType"
                label="参数类型"
                rules={[{ required: true, message: '请选择参数类型' }]}
              >
                <Select>
                  {Object.entries(paramTypeLabel).map(([val, label]) => (
                    <Select.Option key={val} value={val}>
                      {label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="required" label="是否必填" valuePropName="checked">
                <Select>
                  <Select.Option value={true}>是</Select.Option>
                  <Select.Option value={false}>否</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="defaultValue" label="默认值">
            <Input placeholder="输入默认值" />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input placeholder="参数用途说明" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== Execute Script Modal ==================== */}
      <Modal
        title={`执行脚本: ${executingScript?.name ?? ''}`}
        open={executeModalVisible}
        onOk={handleExecute}
        onCancel={() => setExecuteModalVisible(false)}
        width={600}
        okText="执行"
        okButtonProps={{ icon: <PlayCircleOutlined /> }}
      >
        <Form form={executeForm} layout="vertical">
          {parameters.length > 0 && (
            <>
              <Title level={5} style={{ marginBottom: spacing.sm }}>
                参数设置
              </Title>
              {parameters.map((param) => (
                <Form.Item
                  key={param.paramKey}
                  name={['params', param.paramKey]}
                  label={
                    <Space>
                      <Text code>{param.paramKey}</Text>
                      <Tag style={{ borderRadius: 4 }}>{paramTypeLabel[param.paramType]}</Tag>
                      {param.required && <Tag color="red">必填</Tag>}
                    </Space>
                  }
                  rules={
                    param.required
                      ? [{ required: true, message: `请输入 ${param.paramKey}` }]
                      : undefined
                  }
                  extra={param.description}
                >
                  {param.paramType === 'number' ? (
                    <InputNumber style={{ width: '100%' }} placeholder="输入数字" />
                  ) : param.paramType === 'boolean' ? (
                    <Select placeholder="选择">
                      <Select.Option value="true">true</Select.Option>
                      <Select.Option value="false">false</Select.Option>
                    </Select>
                  ) : param.paramType === 'secret' ? (
                    <Input.Password placeholder="输入密钥值" />
                  ) : (
                    <Input placeholder={`输入 ${param.paramKey}`} />
                  )}
                </Form.Item>
              ))}
            </>
          )}
          <Form.Item name="targets" label="执行目标" extra="可选，指定执行主机或目标">
            <Input placeholder="例如: 192.168.1.10 或 host-group-name" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== Execution Detail Drawer ==================== */}
      <Drawer
        title="执行详情"
        open={execDetailVisible}
        onClose={() => setExecDetailVisible(false)}
        width={500}
      >
        {selectedExecution && (
          <>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: spacing.md }}>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[selectedExecution.status]}>
                  {statusLabel[selectedExecution.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="版本">v{selectedExecution.version}</Descriptions.Item>
              <Descriptions.Item label="执行者">{selectedExecution.executedBy ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="耗时">
                {selectedExecution.durationMs != null ? `${selectedExecution.durationMs}ms` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="执行时间">
                {dayjs(selectedExecution.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>

            {selectedExecution.params && Object.keys(selectedExecution.params).length > 0 && (
              <div style={{ marginBottom: spacing.md }}>
                <Title level={5}>执行参数</Title>
                <Card size="small" style={{ background: colors.neutral[50] }}>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      fontSize: 12,
                    }}
                  >
                    {JSON.stringify(selectedExecution.params, null, 2)}
                  </pre>
                </Card>
              </div>
            )}

            {selectedExecution.output && (
              <div style={{ marginBottom: spacing.md }}>
                <Title level={5}>输出</Title>
                <Card
                  size="small"
                  style={{ background: colors.neutral[50] }}
                >
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      maxHeight: 300,
                      overflow: 'auto',
                    }}
                  >
                    {selectedExecution.output}
                  </pre>
                </Card>
              </div>
            )}

            {selectedExecution.error && (
              <div>
                <Title level={5} style={{ color: colors.error[500] }}>
                  错误信息
                </Title>
                <Card
                  size="small"
                  style={{ background: colors.error[50] }}
                >
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: colors.error[600],
                    }}
                  >
                    {selectedExecution.error}
                  </pre>
                </Card>
              </div>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
