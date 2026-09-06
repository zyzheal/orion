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
  Form,
  Select,
  Row,
  Col,
  Tabs,
  Popconfirm,
  Empty,
} from 'antd';
import {PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  CodeOutlined,
  PlayCircleOutlined,
  HistoryOutlined, RollbackOutlined
} from '@ant-design/icons';
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

import {
  scriptTypeLabel,
  scriptTypeColor,
  paramTypeLabel,
  statusColor,
  statusLabel,
} from './config';
import { ScriptLibraryModals } from './ScriptLibraryModals';
import type { ColumnsType } from 'antd/es/table';


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
  const categoryOptions = Array.from(
    new Set(scripts.map((s) => s.category).filter(Boolean))
  ) as string[];

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
    } catch (err: unknown) {
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
      message.error('加载版本列表失败');
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
      message.error('加载参数列表失败');
      setParametersList([]);
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
            : {
                paramKey: p.paramKey,
                paramType: p.paramType,
                required: p.required,
                defaultValue: p.defaultValue ?? undefined,
                description: p.description ?? undefined,
              }
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
          defaults[p.paramKey] =
            p.paramType === 'number'
              ? Number(p.defaultValue)
              : p.paramType === 'boolean'
                ? p.defaultValue === 'true'
                : p.defaultValue;
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
      render: (text: string, record) => <a onClick={() => handleViewDetail(record)}>{text}</a>,
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

      <ScriptLibraryModals
        scripts={scripts}
        scriptModalVisible={scriptModalVisible}
        setScriptModalVisible={setScriptModalVisible}
        scriptConfirmLoading={scriptConfirmLoading}
        setScriptConfirmLoading={setScriptConfirmLoading}
        editingScript={editingScript}
        setEditingScript={setEditingScript}
        scriptForm={scriptForm}
        handleSaveScript={handleSaveScript}
        drawerVisible={drawerVisible}
        setDrawerVisible={setDrawerVisible}
        selectedScript={selectedScript}
        setSelectedScript={setSelectedScript}
        versions={versions}
        setVersions={setVersions}
        versionsLoading={versionsLoading}
        setVersionsLoading={setVersionsLoading}
        versionModalVisible={versionModalVisible}
        setVersionModalVisible={setVersionModalVisible}
        versionForm={versionForm}
        handleSaveVersion={handleSaveVersion}
        handleCreateVersion={handleCreateVersion}
        handleRollback={handleRollback}
        parameters={parameters}
        setParametersList={setParametersList}
        paramsLoading={paramsLoading}
        setParamsLoading={setParamsLoading}
        paramModalVisible={paramModalVisible}
        setParamModalVisible={setParamModalVisible}
        paramForm={paramForm}
        editingParam={editingParam}
        setEditingParam={setEditingParam}
        handleSaveParam={handleSaveParam}
        handleAddParam={handleAddParam}
        handleEditParam={handleEditParam}
        handleDeleteParam={handleDeleteParam}
        executeModalVisible={executeModalVisible}
        setExecuteModalVisible={setExecuteModalVisible}
        executingScript={executingScript}
        setExecutingScript={setExecutingScript}
        executeForm={executeForm}
        handleOpenExecute={handleOpenExecute}
        handleExecute={handleExecute}
        executions={executions}
        setExecutions={setExecutions}
        executionsLoading={executionsLoading}
        setExecutionsLoading={setExecutionsLoading}
        execDetailVisible={execDetailVisible}
        setExecDetailVisible={setExecDetailVisible}
        selectedExecution={selectedExecution}
        setSelectedExecution={setSelectedExecution}
        categoryOptions={categoryOptions}
        paramColumns={paramColumns}
      />
    </div>
  );
}
