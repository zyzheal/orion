/**
 * CI Type Designer Page
 *
 * Features:
 * - CI Type list with category filter and CRUD
 * - Attribute management for selected type
 * - Version history with rollback capability
 * - Instance data validation against type schema
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Form,
  Select,
  Row,
  Col,
  Tabs,
  Popconfirm,
  Empty,
  message,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  HistoryOutlined,
  RollbackOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import {
  listCITypes,
  getCIType,
  createCIType,
  updateCIType,
  deleteCIType,
  getCITypeAttributes,
  setCITypeAttributes,
  validateCIInstance,
  createCITypeVersion,
  getCITypeVersions,
  rollbackCIType,
  type CIType,
  type CIAttribute,
  type CITypeVersion,
  type CreateCITypeInput,
  type UpdateCITypeInput,
  type CreateCIAttributeInput,
} from '@/api/ci-types';
import { CITypeDesignerModals } from './CITypeDesignerModals';

const { Title, Text } = Typography;

const categoryOptions = [
  { label: '服务器', value: 'server' },
  { label: '网络设备', value: 'network' },
  { label: '数据库', value: 'database' },
  { label: '中间件', value: 'middleware' },
  { label: '应用', value: 'application' },
  { label: '存储', value: 'storage' },
  { label: '其他', value: 'other' },
];

const categoryColorMap: Record<string, string> = {
  server: 'blue',
  network: 'cyan',
  database: 'purple',
  middleware: 'orange',
  application: 'green',
  storage: 'gold',
  other: 'default',
};

const attrTypeOptions = [
  { label: '字符串 (string)', value: 'string' },
  { label: '数字 (number)', value: 'number' },
  { label: '布尔 (boolean)', value: 'boolean' },
  { label: '日期 (date)', value: 'date' },
  { label: '单选 (select)', value: 'select' },
  { label: '多选 (multiselect)', value: 'multiselect' },
  { label: 'JSON', value: 'json' },
];

export default function CITypeDesignerPage() {
  // ============ State ============
  const [activeTab, setActiveTab] = useState('types');
  const [ciTypes, setCITypes] = useState<CIType[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);

  // Type modal
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [typeConfirmLoading, setTypeConfirmLoading] = useState(false);
  const [editingType, setEditingType] = useState<CIType | null>(null);
  const [typeForm] = Form.useForm();

  // Detail drawer
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<CIType | null>(null);

  // Attributes
  const [selectedTypeId, setSelectedTypeId] = useState<string | undefined>(undefined);
  const [attributes, setAttributes] = useState<CIAttribute[]>([]);
  const [attrsLoading, setAttrsLoading] = useState(false);
  const [attrModalVisible, setAttrModalVisible] = useState(false);
  const [editingAttr, setEditingAttr] = useState<CIAttribute | null>(null);
  const [attrForm] = Form.useForm();

  // Versions
  const [versionTypeId, setVersionTypeId] = useState<string | undefined>(undefined);
  const [versions, setVersions] = useState<CITypeVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // Validation
  const [validateModalVisible, setValidateModalVisible] = useState(false);
  const [validatingType, setValidatingType] = useState<CIType | null>(null);
  const [validateForm] = Form.useForm();
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: { field: string; message: string }[];
  } | null>(null);

  // ============ Fetch Data ============
  const fetchCITypes = useCallback(async () => {
    setTypesLoading(true);
    try {
      const res = await listCITypes({ category: categoryFilter });
      setCITypes(res.data ?? []);
    } catch {
      message.error('获取 CI 类型列表失败');
    } finally {
      setTypesLoading(false);
    }
  }, [categoryFilter]);

  const fetchAttributes = useCallback(async (typeId: string) => {
    setAttrsLoading(true);
    try {
      const res = await getCITypeAttributes(typeId);
      setAttributes(res.data ?? []);
    } catch {
      message.error('获取属性列表失败');
    } finally {
      setAttrsLoading(false);
    }
  }, []);

  const fetchVersions = useCallback(async (typeId: string) => {
    setVersionsLoading(true);
    try {
      const res = await getCITypeVersions(typeId);
      setVersions(res.data ?? []);
    } catch {
      message.error('获取版本历史失败');
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCITypes();
  }, [fetchCITypes]);

  useEffect(() => {
    if (selectedTypeId) {
      fetchAttributes(selectedTypeId);
    }
  }, [selectedTypeId, fetchAttributes]);

  useEffect(() => {
    if (versionTypeId) {
      fetchVersions(versionTypeId);
    }
  }, [versionTypeId, fetchVersions]);

  // ============ Type CRUD ============
  const handleCreateType = () => {
    setEditingType(null);
    typeForm.resetFields();
    setTypeModalVisible(true);
  };

  const handleEditType = (record: CIType) => {
    setEditingType(record);
    typeForm.setFieldsValue({
      name: record.name,
      displayName: record.displayName,
      description: record.description,
      icon: record.icon,
      category: record.category,
    });
    setTypeModalVisible(true);
  };

  const handleSaveType = async () => {
    try {
      const values = await typeForm.validateFields();
      setTypeConfirmLoading(true);
      if (editingType) {
        const input: UpdateCITypeInput = {
          displayName: values.displayName,
          description: values.description,
          icon: values.icon,
          category: values.category,
        };
        await updateCIType(editingType.id, input);
        message.success('CI 类型更新成功');
      } else {
        const input: CreateCITypeInput = {
          name: values.name,
          displayName: values.displayName,
          description: values.description,
          icon: values.icon,
          category: values.category,
        };
        await createCIType(input);
        message.success('CI 类型创建成功');
      }
      setTypeModalVisible(false);
      fetchCITypes();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('保存失败');
    } finally {
      setTypeConfirmLoading(false);
    }
  };

  const handleDeleteType = async (id: string) => {
    try {
      await deleteCIType(id);
      message.success('删除成功');
      fetchCITypes();
      if (selectedTypeId === id) {
        setSelectedTypeId(undefined);
        setAttributes([]);
      }
    } catch {
      message.error('删除失败');
    }
  };

  const handleViewDetail = async (record: CIType) => {
    try {
      const res = await getCIType(record.id);
      setSelectedType(res.data);
      setDetailDrawerVisible(true);
    } catch {
      message.error('获取详情失败');
    }
  };

  // ============ Attribute CRUD ============
  const handleCreateAttr = () => {
    setEditingAttr(null);
    attrForm.resetFields();
    attrForm.setFieldsValue({ attrType: 'string', required: false, sortOrder: 0 });
    setAttrModalVisible(true);
  };

  const handleEditAttr = (record: CIAttribute) => {
    setEditingAttr(record);
    attrForm.setFieldsValue({
      attrKey: record.attrKey,
      displayName: record.displayName,
      attrType: record.attrType,
      required: record.required,
      defaultValue: record.defaultValue,
      options: (() => {
        try {
          return JSON.parse(record.options || '[]').join('\n');
        } catch {
          return '';
        }
      })(),
      validationRule: record.validationRule,
      sortOrder: record.sortOrder,
    });
    setAttrModalVisible(true);
  };

  const handleSaveAttr = async () => {
    if (!selectedTypeId) return;
    try {
      const values = await attrForm.validateFields();
      const options = values.options
        ? (values.options as string)
            .split('\n')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : undefined;

      const newAttr: CreateCIAttributeInput = {
        attrKey: values.attrKey,
        displayName: values.displayName,
        attrType: values.attrType,
        required: values.required ?? false,
        defaultValue: values.defaultValue,
        options,
        validationRule: values.validationRule,
        sortOrder: values.sortOrder ?? 0,
      };

      // Merge with existing attributes
      const toInput = (a: CIAttribute): CreateCIAttributeInput => ({
        attrKey: a.attrKey,
        displayName: a.displayName ?? undefined,
        attrType: a.attrType ?? undefined,
        required: a.required,
        defaultValue: a.defaultValue ?? undefined,
        options: (() => {
          try {
            return JSON.parse(a.options || '[]');
          } catch {
            return [];
          }
        })(),
        validationRule: a.validationRule ?? undefined,
        sortOrder: a.sortOrder,
      });

      let updatedAttrs: CreateCIAttributeInput[];
      if (editingAttr) {
        updatedAttrs = attributes.map((a) => (a.id === editingAttr.id ? newAttr : toInput(a)));
      } else {
        updatedAttrs = [...attributes.map(toInput), newAttr];
      }

      await setCITypeAttributes(selectedTypeId, updatedAttrs);
      message.success(editingAttr ? '属性更新成功' : '属性添加成功');
      setAttrModalVisible(false);
      fetchAttributes(selectedTypeId);
    } catch {
      message.error('保存失败');
    }
  };

  const handleDeleteAttr = async (record: CIAttribute) => {
    if (!selectedTypeId) return;
    try {
      const remaining = attributes
        .filter((a) => a.id !== record.id)
        .map((a) => ({
          attrKey: a.attrKey,
          displayName: a.displayName ?? undefined,
          attrType: a.attrType,
          required: a.required,
          defaultValue: a.defaultValue ?? undefined,
          options: (() => {
            try {
              return JSON.parse(a.options || '[]');
            } catch {
              return [];
            }
          })(),
          validationRule: a.validationRule ?? undefined,
          sortOrder: a.sortOrder,
        }));
      await setCITypeAttributes(selectedTypeId, remaining);
      message.success('属性删除成功');
      fetchAttributes(selectedTypeId);
    } catch {
      message.error('删除失败');
    }
  };

  // ============ Version ============
  const handleCreateVersion = async () => {
    if (!versionTypeId) return;
    try {
      await createCITypeVersion(versionTypeId);
      message.success('版本快照创建成功');
      fetchVersions(versionTypeId);
    } catch {
      message.error('创建版本失败');
    }
  };

  const handleRollback = async (version: CITypeVersion) => {
    if (!versionTypeId) return;
    try {
      await rollbackCIType(versionTypeId, version.id);
      message.success(`已回滚到版本 ${version.version}`);
      fetchVersions(versionTypeId);
      fetchCITypes();
    } catch {
      message.error('回滚失败');
    }
  };

  // ============ Validation ============
  const handleOpenValidate = (record: CIType) => {
    setValidatingType(record);
    setValidationResult(null);
    validateForm.resetFields();
    setValidateModalVisible(true);
  };

  const handleValidate = async () => {
    if (!validatingType) return;
    try {
      const values = await validateForm.validateFields();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(values.instanceData);
      } catch {
        message.error('JSON 格式不正确');
        return;
      }
      const res = await validateCIInstance(validatingType.id, data);
      setValidationResult(res.data);
    } catch {
      message.error('校验请求失败');
    }
  };

  // ============ Type Table Columns ============
  const typeColumns: ColumnsType<CIType> = [
    {
      title: '类型名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record) => <a onClick={() => handleViewDetail(record)}>{text}</a>,
    },
    {
      title: '显示名称',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (text: string | null) => text ?? '-',
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (cat: string | null) =>
        cat ? <Tag color={categoryColorMap[cat] ?? 'default'}>{cat}</Tag> : '-',
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: number) => <Tag>v{v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditType(record)}>
            编辑
          </Button>
          <Button
            type="link"
            icon={<CheckCircleOutlined />}
            onClick={() => handleOpenValidate(record)}
          >
            校验
          </Button>
          <Popconfirm title="确认删除此 CI 类型？" onConfirm={() => handleDeleteType(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ============ Attribute Table Columns ============
  const attrColumns: ColumnsType<CIAttribute> = [
    {
      title: '属性标识',
      dataIndex: 'attrKey',
      key: 'attrKey',
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: '显示名称',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (text: string | null) => text ?? '-',
    },
    {
      title: '类型',
      dataIndex: 'attrType',
      key: 'attrType',
      render: (t: string) => <Tag>{t}</Tag>,
    },
    {
      title: '必填',
      dataIndex: 'required',
      key: 'required',
      width: 80,
      render: (v: boolean) => (v ? <Tag color="red">必填</Tag> : <Tag>可选</Tag>),
    },
    {
      title: '默认值',
      dataIndex: 'defaultValue',
      key: 'defaultValue',
      render: (text: string | null) => text ?? '-',
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 70,
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditAttr(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除此属性？" onConfirm={() => handleDeleteAttr(record)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ============ Version Table Columns ============
  const versionColumns: ColumnsType<CITypeVersion> = [
    {
      title: '版本号',
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '快照内容',
      dataIndex: 'attributesSnapshot',
      key: 'attributesSnapshot',
      render: (snapshot: string) => {
        let parsed = snapshot;
        try {
          parsed = JSON.stringify(JSON.parse(snapshot || '[]'), null, 1);
        } catch {
          /* ignore */
        }
        return (
          <Text ellipsis style={{ maxWidth: 400, fontFamily: 'monospace', fontSize: 12 }}>
            {parsed}
          </Text>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Popconfirm
          title={`确认回滚到版本 ${record.version}？`}
          onConfirm={() => handleRollback(record)}
        >
          <Button type="link" icon={<RollbackOutlined />}>
            回滚
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // ============ CI Type Select Options ============
  const typeSelectOptions = ciTypes.map((t) => ({
    label: t.displayName ? `${t.displayName} (${t.name})` : t.name,
    value: t.id,
  }));

  // ============ Render ============
  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <DatabaseOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        CI 类型管理
      </Title>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          // ============ Tab 1: 类型列表 ============
          {
            key: 'types',
            label: '类型列表',
            children: (
              <Card
                style={{
                  borderRadius: componentRadius.card,
                  boxShadow: shadows.card as string,
                }}
              >
                <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
                  <Col>
                    <Space>
                      <Select
                        placeholder="按分类筛选"
                        allowClear
                        style={{ width: 160 }}
                        options={categoryOptions}
                        value={categoryFilter}
                        onChange={setCategoryFilter}
                      />
                      <Button icon={<ReloadOutlined />} onClick={fetchCITypes}>
                        刷新
                      </Button>
                    </Space>
                  </Col>
                  <Col>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateType}>
                      创建 CI 类型
                    </Button>
                  </Col>
                </Row>
                <Table
                  columns={typeColumns}
                  dataSource={ciTypes}
                  rowKey="id"
                  loading={typesLoading}
                  pagination={{ pageSize: 20 }}
                />
              </Card>
            ),
          },

          // ============ Tab 2: 属性管理 ============
          {
            key: 'attributes',
            label: '属性管理',
            children: (
              <Card
                style={{
                  borderRadius: componentRadius.card,
                  boxShadow: shadows.card as string,
                }}
              >
                <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
                  <Col>
                    <Space>
                      <Select
                        placeholder="选择 CI 类型"
                        style={{ width: 280 }}
                        options={typeSelectOptions}
                        value={selectedTypeId}
                        onChange={setSelectedTypeId}
                        showSearch
                        filterOption={(input, option) =>
                          (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ??
                          false
                        }
                      />
                      {selectedTypeId && (
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={() => fetchAttributes(selectedTypeId)}
                        >
                          刷新
                        </Button>
                      )}
                    </Space>
                  </Col>
                  <Col>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleCreateAttr}
                      disabled={!selectedTypeId}
                    >
                      添加属性
                    </Button>
                  </Col>
                </Row>

                {!selectedTypeId ? (
                  <Empty description="请先选择一个 CI 类型" />
                ) : (
                  <Table
                    columns={attrColumns}
                    dataSource={attributes}
                    rowKey="id"
                    loading={attrsLoading}
                    pagination={false}
                  />
                )}
              </Card>
            ),
          },

          // ============ Tab 3: 版本历史 ============
          {
            key: 'versions',
            label: '版本历史',
            children: (
              <Card
                style={{
                  borderRadius: componentRadius.card,
                  boxShadow: shadows.card as string,
                }}
              >
                <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
                  <Col>
                    <Space>
                      <Select
                        placeholder="选择 CI 类型"
                        style={{ width: 280 }}
                        options={typeSelectOptions}
                        value={versionTypeId}
                        onChange={setVersionTypeId}
                        showSearch
                        filterOption={(input, option) =>
                          (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ??
                          false
                        }
                      />
                      {versionTypeId && (
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={() => fetchVersions(versionTypeId)}
                        >
                          刷新
                        </Button>
                      )}
                    </Space>
                  </Col>
                  <Col>
                    <Button
                      type="primary"
                      icon={<HistoryOutlined />}
                      onClick={handleCreateVersion}
                      disabled={!versionTypeId}
                    >
                      创建版本快照
                    </Button>
                  </Col>
                </Row>

                {!versionTypeId ? (
                  <Empty description="请先选择一个 CI 类型" />
                ) : (
                  <Table
                    columns={versionColumns}
                    dataSource={versions}
                    rowKey="id"
                    loading={versionsLoading}
                    pagination={{ pageSize: 20 }}
                  />
                )}
              </Card>
            ),
          },
        ]}
      />

      <CITypeDesignerModals
        ciTypes={ciTypes}
        setCITypes={setCITypes}
        typesLoading={typesLoading}
        setTypesLoading={setTypesLoading}
        typeModalVisible={typeModalVisible}
        setTypeModalVisible={setTypeModalVisible}
        typeConfirmLoading={typeConfirmLoading}
        setTypeConfirmLoading={setTypeConfirmLoading}
        editingType={editingType}
        setEditingType={setEditingType}
        typeForm={typeForm}
        handleSaveType={handleSaveType}
        handleDeleteType={handleDeleteType}
        detailDrawerVisible={detailDrawerVisible}
        setDetailDrawerVisible={setDetailDrawerVisible}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        selectedTypeId={selectedTypeId}
        setSelectedTypeId={setSelectedTypeId}
        attributes={attributes}
        setAttributes={setAttributes}
        attrsLoading={attrsLoading}
        setAttrsLoading={setAttrsLoading}
        attrModalVisible={attrModalVisible}
        setAttrModalVisible={setAttrModalVisible}
        editingAttr={editingAttr}
        setEditingAttr={setEditingAttr}
        attrForm={attrForm}
        handleSaveAttr={handleSaveAttr}
        handleDeleteAttr={handleDeleteAttr}
        versions={versions}
        setVersions={setVersions}
        versionsLoading={versionsLoading}
        setVersionsLoading={setVersionsLoading}
        validateModalVisible={validateModalVisible}
        setValidateModalVisible={setValidateModalVisible}
        validatingType={validatingType}
        setValidatingType={setValidatingType}
        validateForm={validateForm}
        validationResult={validationResult}
        setValidationResult={setValidationResult}
        handleValidate={handleValidate}
        handleCreateVersion={handleCreateVersion}
        handleRollback={handleRollback}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        versionTypeId={versionTypeId}
        setVersionTypeId={setVersionTypeId}
        categoryOptions={categoryOptions}
        attrTypeOptions={attrTypeOptions}
        categoryColorMap={categoryColorMap}
      />
    </div>
  );
}
