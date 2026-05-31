/**
 * APK Credentials Management Page
 * Manage app market upload credentials for APK upload tasks.
 *
 * Credentials are stored as encrypted secrets with naming convention:
 * - apk-huawei-credentials
 * - apk-xiaomi-credentials
 * - etc.
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tag,
  Card,
  Divider,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import Table from '@/components/Table';
import { useAuthStore } from '@/stores/authStore';
import { getSecrets, createSecret, updateSecret, deleteSecret, type Secret, type SecretScope, type CreateSecretInput } from '@/api/secrets';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { Password } = Input;

// Supported markets
const MARKET_OPTIONS = [
  { label: '华为 AppGallery', value: 'huawei', icon: '📱' },
  { label: '小米应用商店', value: 'xiaomi', icon: '📱' },
  { label: 'OPPO 软件商店', value: 'oppo', icon: '📱' },
  { label: 'VIVO 应用商店', value: 'vivo', icon: '📱' },
  { label: '荣耀应用市场', value: 'honor', icon: '📱' },
  { label: '腾讯应用宝', value: 'tencent', icon: '📱' },
  { label: 'Google Play', value: 'googleplay', icon: '🌐' },
  { label: '三星 Galaxy Store', value: 'samsung', icon: '📱' },
  { label: '蒲公英', value: 'pgyer', icon: '🌿' },
  { label: 'fir.im', value: 'fir', icon: '📦' },
];

// Market credentials fields configuration
const MARKET_CREDENTIAL_FIELDS: Record<string, Array<{ name: string; label: string; placeholder: string; required: boolean; type?: 'password' }>> = {
  huawei: [
    { name: 'clientId', label: 'Client ID', placeholder: 'Enter Huawei client ID', required: true },
    { name: 'clientSecret', label: 'Client Secret', placeholder: 'Enter Huawei client secret', required: true, type: 'password' },
    { name: 'appId', label: 'App ID', placeholder: 'Enter app ID (optional)', required: false },
  ],
  xiaomi: [
    { name: 'email', label: 'Developer Email', placeholder: 'Enter Xiaomi developer email', required: true },
    { name: 'privateKey', label: 'RSA Private Key', placeholder: 'Enter RSA private key', required: true, type: 'password' },
    { name: 'cert', label: 'Certificate', placeholder: 'Enter certificate path (optional)', required: false },
  ],
  oppo: [
    { name: 'clientId', label: 'Client ID', placeholder: 'Enter OPPO client ID', required: true },
    { name: 'clientSecret', label: 'Client Secret', placeholder: 'Enter OPPO client secret', required: true, type: 'password' },
  ],
  vivo: [
    { name: 'accessKey', label: 'Access Key', placeholder: 'Enter VIVO access key', required: true },
    { name: 'accessSecret', label: 'Access Secret', placeholder: 'Enter VIVO access secret', required: true, type: 'password' },
  ],
  honor: [
    { name: 'clientId', label: 'Client ID', placeholder: 'Enter Honor client ID', required: true },
    { name: 'clientSecret', label: 'Client Secret', placeholder: 'Enter Honor client secret', required: true, type: 'password' },
    { name: 'appId', label: 'App ID', placeholder: 'Enter app ID (optional)', required: false },
  ],
  tencent: [
    { name: 'userId', label: 'User ID', placeholder: 'Enter Tencent user ID', required: true },
    { name: 'accessSecret', label: 'Access Secret', placeholder: 'Enter access secret', required: true, type: 'password' },
    { name: 'appId', label: 'App ID', placeholder: 'Enter app ID', required: true },
  ],
  googleplay: [
    { name: 'jsonKeyFile', label: 'Service Account JSON', placeholder: 'Paste service account JSON content', required: true, type: 'password' },
    { name: 'packageName', label: 'Package Name', placeholder: 'Enter package name', required: true },
    { name: 'track', label: 'Track', placeholder: 'e.g., internal, beta, production', required: false },
  ],
  samsung: [
    { name: 'serviceAccountId', label: 'Service Account ID', placeholder: 'Enter service account ID', required: true },
    { name: 'privateKey', label: 'Private Key', placeholder: 'Enter RSA private key', required: true, type: 'password' },
    { name: 'contentId', label: 'Content ID', placeholder: 'Enter content ID', required: true },
  ],
  pgyer: [
    { name: 'apiKey', label: 'API Key', placeholder: 'Enter Pgyer API key', required: true, type: 'password' },
  ],
  fir: [
    { name: 'apiToken', label: 'API Token', placeholder: 'Enter fir.im API token', required: true, type: 'password' },
  ],
};

// Get market display name
const getMarketName = (value: string) => {
  const market = MARKET_OPTIONS.find(m => m.value === value);
  return market ? `${market.icon} ${market.label}` : value;
};

// Get secret name for a market
const getSecretName = (market: string) => `apk-${market}-credentials`;

const ApkCredentialsManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<Array<{
    id: string;
    market: string;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
  }>>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCredential, setEditingCredential] = useState<{ id: string; market: string } | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string>('huawei');
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [form] = Form.useForm();
  const tenantId = useAuthStore((state) => (state.user as any).tenantId) || 'default-tenant';

  // Load credentials on mount
  useEffect(() => {
    loadCredentials();
  }, [tenantId]);

  const loadCredentials = async () => {
    setLoading(true);
    try {
      const response = await getSecrets(tenantId);
      const data = response.data;
      const allSecrets: Secret[] = Array.isArray(data) ? data : [];

      // Filter secrets that start with 'apk-' and end with '-credentials'
      const apkSecrets = allSecrets
        .filter(s => s.name.startsWith('apk-') && s.name.endsWith('-credentials'))
        .map(s => {
          const market = s.name.replace('apk-', '').replace('-credentials', '');
          return {
            id: s.id,
            market,
            name: s.name,
            description: s.description,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          };
        });

      setCredentials(apkSecrets);
    } catch (error: unknown) {
      message.error(`加载凭证失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle create credential
  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const secretName = getSecretName(selectedMarket);
      const existing = credentials.find(c => c.market === selectedMarket);

      if (existing) {
        message.warning('该市场的凭证已存在，请使用编辑功能更新');
        setSubmitting(false);
        return;
      }

      const credentialsJson = JSON.stringify(values, null, 0);
      const input: CreateSecretInput = {
        name: secretName,
        value: credentialsJson,
        scope: 'project' as SecretScope,
        description: `${getMarketName(selectedMarket)} 上传凭证`,
      };

      await createSecret(tenantId, input);
      message.success('凭证保存成功');
      setCreateModalVisible(false);
      form.resetFields();
      loadCredentials();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      message.error(`保存失败: ${(error as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle update credential
  const handleUpdate = async () => {
    if (!editingCredential) return;

    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const credentialsJson = JSON.stringify(values, null, 0);

      await updateSecret(tenantId, editingCredential.id, {
        value: credentialsJson,
        description: `${getMarketName(editingCredential.market)} 上传凭证`,
      });

      message.success('凭证更新成功');
      setEditModalVisible(false);
      setEditingCredential(null);
      form.resetFields();
      loadCredentials();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      message.error(`保存失败: ${(error as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete credential
  const handleDelete = async (id: string, market: string) => {
    try {
      await deleteSecret(tenantId, id);
      message.success(`已删除 ${getMarketName(market)} 的凭证`);
      loadCredentials();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  // Open create modal
  const openCreateModal = (market?: string) => {
    setSelectedMarket(market || 'huawei');
    form.resetFields();
    setCreateModalVisible(true);
  };

  // Open edit modal
  const openEditModal = (record: { id: string; market: string }) => {
    setEditingCredential(record);
    setSelectedMarket(record.market);
    form.resetFields();
    // Note: Can't pre-fill values since they're encrypted - user must re-enter
    setEditModalVisible(true);
  };

  // Get unconfigured markets
  const configuredMarkets = credentials.map(c => c.market);
  const unconfiguredMarkets = MARKET_OPTIONS.filter(m => !configuredMarkets.includes(m.value));

  // Table columns
  const columns: any = [
    {
      title: '应用市场',
      dataIndex: 'market',
      key: 'market',
      render: (market: string) => <Tag color="blue">{getMarketName(market)}</Tag>,
    },
    {
      title: '凭证名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <code>{name}</code>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: string) => dayjs(date).fromNow(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: { id: string; market: string }) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id, record.market)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
            <KeyOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            APK 上传凭证管理
          </Title>
          <Text type="secondary">
            配置各大应用市场的上传凭证，支持华为、小米、OPPO、VIVO、荣耀、腾讯应用宝、Google Play、三星、蒲公英、fir.im
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateModal()}>
          添加凭证
        </Button>
      </div>

      <Alert
        message="凭证安全说明"
        description="所有凭证都以加密形式存储在后端。在 Pipeline 配置中引用时，请使用 Secret 语法：${secrets.apk-{market}-credentials}"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card>
        <Table
          columns={columns}
          dataSource={credentials}
          rowKey="id"
          loading={loading}
          locale={{ emptyText: '尚未配置任何应用市场凭证' }}
        />
      </Card>

      {unconfiguredMarkets.length > 0 && (
        <>
          <Divider>快速添加</Divider>
          <Space wrap>
            {unconfiguredMarkets.map(market => (
              <Button
                key={market.value}
                icon={<PlusOutlined />}
                onClick={() => openCreateModal(market.value)}
              >
                添加 {market.label}
              </Button>
            ))}
          </Space>
        </>
      )}

      {/* Create Modal */}
      <Modal
        title={`配置 ${getMarketName(selectedMarket)} 凭证`}
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => setCreateModalVisible(false)}
        confirmLoading={submitting}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Alert
          message="使用说明"
          description={`请填写 ${getMarketName(selectedMarket)} 的开发者凭证信息。这些信息将加密存储。`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form
          form={form}
          layout="vertical"
          requiredMark
        >
          <Form.Item
            label="应用市场"
            name="market"
            initialValue={selectedMarket}
            rules={[{ required: true }]}
          >
            <Select
              options={MARKET_OPTIONS}
              onChange={setSelectedMarket}
              disabled={!!credentials.find(c => c.market === selectedMarket)}
            />
          </Form.Item>

          <Divider orientation="left">凭证信息</Divider>

          {MARKET_CREDENTIAL_FIELDS[selectedMarket]?.map(field => (
            <Form.Item
              key={field.name}
              label={field.label}
              name={field.name}
              rules={field.required ? [{ required: true, message: `请输入${field.label}` }] : []}
            >
              {field.type === 'password' ? (
                <Password placeholder={field.placeholder} />
              ) : (
                <Input placeholder={field.placeholder} />
              )}
            </Form.Item>
          ))}

          {!MARKET_CREDENTIAL_FIELDS[selectedMarket] && (
            <Alert
              message="暂不支持此市场"
              description="请联系管理员添加此市场的凭证配置模板"
              type="warning"
              showIcon
            />
          )}
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={`编辑 ${getMarketName(editingCredential?.market || '')} 凭证`}
        open={editModalVisible}
        onOk={handleUpdate}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingCredential(null);
          form.resetFields();
        }}
        confirmLoading={submitting}
        width={600}
        okText="更新"
        cancelText="取消"
      >
        <Alert
          message="更新凭证"
          description="请重新填写凭证信息。原有凭证内容无法显示，需要重新输入。更新后原有凭证将失效。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form
          form={form}
          layout="vertical"
          requiredMark
        >
          <Form.Item
            label="应用市场"
            name="market"
            initialValue={selectedMarket}
          >
            <Select options={MARKET_OPTIONS} disabled />
          </Form.Item>

          <Divider orientation="left">凭证信息</Divider>

          {MARKET_CREDENTIAL_FIELDS[selectedMarket]?.map(field => (
            <Form.Item
              key={field.name}
              label={field.label}
              name={field.name}
              rules={field.required ? [{ required: true, message: `请输入${field.label}` }] : []}
            >
              {field.type === 'password' ? (
                <Password placeholder={field.placeholder} />
              ) : (
                <Input placeholder={field.placeholder} />
              )}
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  );
};

export default ApkCredentialsManagement;