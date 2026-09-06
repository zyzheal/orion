/**
 * MLOps Model Registry Tab - model versioning and deployment
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import {
  CloudUploadOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  deployModel,
  listModels,
  registerModel,
  updateModelStatus,
  type MLModel,
} from '@/api/mlops';
import { colors, spacing } from '@/tokens';
import { MODEL_STATUS_OPTIONS, filterRowStyle, headerRowStyle, sectionTitleStyle } from './config';
import { buildModelColumns } from './columns';
import { ModelRegistryModals } from './MLOpsModals';

const { Title, Text } = Typography;

export const ModelRegistryTab: React.FC = () => {
  const [models, setModels] = useState<MLModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerForm] = Form.useForm();
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [modelStatusFilter, setModelStatusFilter] = useState<string | undefined>();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listModels();
      setModels((res.data as { data?: MLModel[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载模型失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegister = async (values: any) => {
    setRegistering(true);
    try {
      await registerModel({
        name: values.name,
        artifactPath: values.artifactPath,
        experimentId: values.experimentId,
        description: values.description,
      });
      message.success('模型注册成功');
      setRegisterModalOpen(false);
      registerForm.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '注册失败');
    } finally {
      setRegistering(false);
    }
  };

  const handleDeploy = async (id: string) => {
    try {
      await deployModel(id);
      message.success('模型部署成功');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '部署失败');
    }
  };

  const handleStatusChange = async (id: string, status: MLModel['status']) => {
    try {
      await updateModelStatus(id, status);
      message.success(`模型状态已更新为 ${status}`);
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '状态更新失败');
    }
  };

  const columns = useMemo(() => buildModelColumns({ handleDeploy, handleStatusChange }), []);

  // Filtered models
  const filteredModels = useMemo(() => {
    let result = models;
    if (modelSearchQuery) {
      const q = modelSearchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.artifactPath || '').toLowerCase().includes(q) ||
          (m.description || '').toLowerCase().includes(q),
      );
    }
    if (modelStatusFilter) {
      result = result.filter((m) => m.status === modelStatusFilter);
    }
    return result;
  }, [models, modelSearchQuery, modelStatusFilter]);

  return (
    <div>
      <div style={headerRowStyle}>
        <div>
          <Title level={3} style={sectionTitleStyle}>
            <CloudUploadOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            模型注册
          </Title>
          <Text type="secondary">管理 ML 模型版本和生命周期</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setRegisterModalOpen(true)}>
            注册模型
          </Button>
        </Space>
      </div>

      <div style={filterRowStyle}>
        <Input
          placeholder="搜索模型名称、Artifact..."
          prefix={<SearchOutlined style={{ color: colors.neutral[400] }} />}
          value={modelSearchQuery}
          onChange={(e) => setModelSearchQuery(e.target.value)}
          style={{ width: 260 }}
          allowClear
        />
        <Select
          placeholder="状态筛选"
          value={modelStatusFilter}
          onChange={setModelStatusFilter}
          allowClear
          style={{ width: 120 }}
          options={MODEL_STATUS_OPTIONS}
        />
      </div>

      {filteredModels.length === 0 && !loading ? (
        <Empty description="暂无模型数据">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setRegisterModalOpen(true)}>
            注册第一个模型
          </Button>
        </Empty>
      ) : (
        <Table
          columns={columns}
          dataSource={filteredModels}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      )}

      <ModelRegistryModals
        registerModalOpen={registerModalOpen}
        setRegisterModalOpen={setRegisterModalOpen}
        registering={registering}
        registerForm={registerForm}
        handleRegister={handleRegister}
      />
    </div>
  );
};
