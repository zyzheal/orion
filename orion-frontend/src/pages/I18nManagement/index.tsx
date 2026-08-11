/**
 * i18n Management Page
 *
 * Features:
 * - Locale management (create, list)
 * - Translation key-value management
 * - Bulk translation import
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
  Row,
  Col,
  Popconfirm,
  Select,
  Tabs,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  GlobalOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import {
  listLocales,
  createLocale,
  getTranslations,
  setTranslation,
  deleteTranslation,
  type I18nLocale,
} from '@/api/i18n';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function I18nManagementPage() {
  const [locales, setLocales] = useState<I18nLocale[]>([]);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState<string>('');
  const [localeModalVisible, setLocaleModalVisible] = useState(false);
  const [translationModalVisible, setTranslationModalVisible] = useState(false);
  const [editingTranslation, setEditingTranslation] = useState<{ key: string; value: string } | null>(null);
  const [activeTab, setActiveTab] = useState('locales');
  const [localeForm] = Form.useForm();
  const [translationForm] = Form.useForm();

  const fetchLocales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listLocales();
      setLocales(res.data ?? []);
      if (res.data?.length && !selectedLocale) {
        setSelectedLocale(res.data[0].code);
      }
    } catch {
      message.error('获取语言列表失败');
    } finally {
      setLoading(false);
    }
  }, [selectedLocale]);

  const fetchTranslations = useCallback(async () => {
    if (!selectedLocale) return;
    setLoading(true);
    try {
      const res = await getTranslations(selectedLocale);
      setTranslations(res.data ?? {});
    } catch {
      message.error('获取翻译失败');
    } finally {
      setLoading(false);
    }
  }, [selectedLocale]);

  useEffect(() => {
    fetchLocales();
  }, [fetchLocales]);

  useEffect(() => {
    if (selectedLocale) {
      fetchTranslations();
    }
  }, [selectedLocale, fetchTranslations]);

  const handleCreateLocale = async () => {
    try {
      const values = await localeForm.validateFields();
      await createLocale(values);
      message.success('语言创建成功');
      setLocaleModalVisible(false);
      localeForm.resetFields();
      fetchLocales();
    } catch {
      message.error('创建失败');
    }
  };

  const handleSetTranslation = async () => {
    try {
      const values = await translationForm.validateFields();
      await setTranslation({
        localeCode: selectedLocale,
        namespace: values.namespace ?? 'default',
        key: values.key,
        value: values.value,
      });
      message.success('翻译保存成功');
      setTranslationModalVisible(false);
      translationForm.resetFields();
      fetchTranslations();
    } catch {
      message.error('保存失败');
    }
  };

  const handleDeleteTranslation = async (key: string) => {
    try {
      const parts = key.split('.');
      const namespace = parts.length > 1 ? parts[0] : 'default';
      const actualKey = parts.length > 1 ? parts.slice(1).join('.') : key;
      await deleteTranslation(selectedLocale, namespace, actualKey);
      message.success('删除成功');
      fetchTranslations();
    } catch {
      message.error('删除失败');
    }
  };

  const handleEditTranslation = (key: string, value: string) => {
    setEditingTranslation({ key, value });
    translationForm.setFieldsValue({
      namespace: key.split('.').length > 1 ? key.split('.')[0] : 'default',
      key: key.split('.').length > 1 ? key.split('.').slice(1).join('.') : key,
      value,
    });
    setTranslationModalVisible(true);
  };

  const localeColumns: ColumnsType<I18nLocale> = [
    {
      title: '语言代码',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
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
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const translationEntries = Object.entries(translations).map(([key, value]) => ({
    key,
    value,
  }));

  const translationColumns: ColumnsType<{ key: string; value: string }> = [
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditTranslation(record.key, record.value)}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDeleteTranslation(record.key)}>
            <Button type="link" danger icon={<DeleteOutlined />} size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <GlobalOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        国际化管理
      </Title>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        {
          key: 'locales',
          label: '语言管理',
          children: (
            <Card>
              <Row justify="space-between" style={{ marginBottom: spacing.md }}>
                <Col>
                  <Button icon={<ReloadOutlined />} onClick={fetchLocales}>刷新</Button>
                </Col>
                <Col>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setLocaleModalVisible(true)}>
                    添加语言
                  </Button>
                </Col>
              </Row>
              <Table
                columns={localeColumns}
                dataSource={locales}
                rowKey="id"
                loading={loading}
                pagination={false}
                onRow={(record) => ({
                  onClick: () => {
                    setSelectedLocale(record.code);
                    setActiveTab('translations');
                  },
                  style: { cursor: 'pointer' },
                })}
              />
            </Card>
          ),
        },
        {
          key: 'translations',
          label: '翻译管理',
          children: (
            <Card>
              <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
                <Col>
                  <Space>
                    <Text>当前语言:</Text>
                    <Select
                      value={selectedLocale}
                      onChange={setSelectedLocale}
                      style={{ width: 200 }}
                      placeholder="选择语言"
                    >
                      {locales.map((loc) => (
                        <Select.Option key={loc.code} value={loc.code}>
                          {loc.name} ({loc.code})
                        </Select.Option>
                      ))}
                    </Select>
                    <Button icon={<ReloadOutlined />} onClick={fetchTranslations}>刷新</Button>
                  </Space>
                </Col>
                <Col>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setTranslationModalVisible(true)}
                    disabled={!selectedLocale}
                  >
                    添加翻译
                  </Button>
                </Col>
              </Row>
              {selectedLocale ? (
                <Table
                  columns={translationColumns}
                  dataSource={translationEntries}
                  rowKey="key"
                  loading={loading}
                  pagination={{ pageSize: 50 }}
                />
              ) : (
                <Empty description="请先选择语言" />
              )}
            </Card>
          ),
        },
      ]} />

      {/* Add Locale Modal */}
      <Modal
        title="添加语言"
        open={localeModalVisible}
        onOk={handleCreateLocale}
        onCancel={() => setLocaleModalVisible(false)}
      >
        <Form form={localeForm} layout="vertical">
          <Form.Item name="code" label="语言代码" rules={[{ required: true, message: '请输入语言代码' }]}>
            <Input placeholder="如 zh-CN, en-US, ja-JP" />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如 简体中文, English" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Translation Modal */}
      <Modal
        title="添加翻译"
        open={translationModalVisible}
        onOk={handleSetTranslation}
        onCancel={() => setTranslationModalVisible(false)}
      >
        <Form form={translationForm} layout="vertical">
          <Form.Item name="namespace" label="命名空间" initialValue="default">
            <Input placeholder="默认为 default" />
          </Form.Item>
          <Form.Item name="key" label="Key" rules={[{ required: true, message: '请输入 Key' }]}>
            <Input placeholder="如 common.button.submit" />
          </Form.Item>
          <Form.Item name="value" label="Value" rules={[{ required: true, message: '请输入翻译值' }]}>
            <TextArea rows={3} placeholder="翻译内容" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
