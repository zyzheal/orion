/**
 * DataSourcesTab.tsx - 数据源 Tab（卡片网格 + 编辑/新建 Modal）
 * 抽取自 DbaPage.tsx (P2-9 Phase 42)
 */
import React, { useState } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Spin,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Badge,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testConnection,
  type DataSource,
} from '@/api/dba';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { dbTypeLabelMap, dbTypeOptions } from './constants';

const { Text } = Typography;

export interface DataSourcesTabProps {
  dataSources: DataSource[];
  dsLoading: boolean;
  loadDataSources: () => Promise<void> | void;
}

const DataSourcesTab: React.FC<DataSourcesTabProps> = ({
  dataSources,
  dsLoading,
  loadDataSources,
}) => {
  const [dsModalVisible, setDsModalVisible] = useState(false);
  const [dsForm] = Form.useForm();
  const [dsSubmitting, setDsSubmitting] = useState(false);
  const [editingDs, setEditingDs] = useState<DataSource | null>(null);
  const [testingDs, setTestingDs] = useState<string | null>(null);

  const handleCreateOrUpdateDs = async () => {
    try {
      const values = await dsForm.validateFields();
      setDsSubmitting(true);
      const payload = {
        name: values.name,
        type: values.type,
        host: values.host,
        port: parseInt(values.port, 10),
        database: values.database,
      };
      if (editingDs) {
        await updateDataSource(editingDs.id, payload);
        message.success('数据源更新成功');
      } else {
        await createDataSource(payload);
        message.success('数据源创建成功');
      }
      setDsModalVisible(false);
      setEditingDs(null);
      dsForm.resetFields();
      loadDataSources();
    } catch (error: unknown) {
      message.error(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setDsSubmitting(false);
    }
  };

  const openDsEditModal = (ds: DataSource) => {
    setEditingDs(ds);
    dsForm.setFieldsValue({
      name: ds.name,
      type: ds.type,
      host: ds.host,
      port: ds.port.toString(),
      database: ds.database,
    });
    setDsModalVisible(true);
  };

  const openDsCreateModal = () => {
    setEditingDs(null);
    dsForm.resetFields();
    setDsModalVisible(true);
  };

  const handleDeleteDs = async (id: string) => {
    try {
      await deleteDataSource(id);
      message.success('数据源已删除');
      loadDataSources();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingDs(id);
    try {
      await testConnection(id);
      message.success('连接测试成功');
    } catch (error: unknown) {
      message.error(`连接测试失败: ${(error as Error).message}`);
    } finally {
      setTestingDs(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: spacing.md }}>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadDataSources()} loading={dsLoading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openDsCreateModal}>
            添加数据源
          </Button>
        </Space>
      </div>

      <Spin spinning={dsLoading}>
        {dataSources.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 40 }}>
            <DatabaseOutlined style={{ fontSize: 48, color: colors.neutral[300] }} />
            <p style={{ marginTop: spacing.md, color: colors.neutral[500] }}>暂无数据源，请添加</p>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {dataSources.map((ds) => (
              <Col xs={24} sm={12} md={8} lg={6} key={ds.id}>
                <Card
                  size="small"
                  hoverable
                  actions={[
                    <Button
                      key="test"
                      type="link"
                      size="small"
                      icon={<ThunderboltOutlined />}
                      loading={testingDs === ds.id}
                      onClick={() => handleTestConnection(ds.id)}
                    >
                      测试连接
                    </Button>,
                    <Button
                      key="edit"
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openDsEditModal(ds)}
                    >
                      编辑
                    </Button>,
                    <Popconfirm
                      key="delete"
                      title="确认删除此数据源？"
                      onConfirm={() => handleDeleteDs(ds.id)}
                    >
                      <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <div style={{ marginBottom: spacing.sm }}>
                    <Space>
                      <DatabaseOutlined style={{ color: colors.primary[500] }} />
                      <Text strong>{ds.name}</Text>
                    </Space>
                  </div>
                  <div style={{ marginBottom: spacing.sm }}>
                    <Badge
                      status={
                        ds.status === 'online'
                          ? 'success'
                          : ds.status === 'offline'
                            ? 'default'
                            : 'error'
                      }
                      text={ds.status}
                    />
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dbTypeLabelMap[ds.type]}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {ds.host}:{ds.port}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    DB: {ds.database}
                  </Text>
                  {ds.lastChecked && (
                    <Text
                      type="secondary"
                      style={{ fontSize: 11, display: 'block', marginTop: 4 }}
                    >
                      最后检测: {ds.lastChecked}
                    </Text>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      <Modal
        title={editingDs ? '编辑数据源' : '添加数据源'}
        open={dsModalVisible}
        onCancel={() => {
          setDsModalVisible(false);
          setEditingDs(null);
          dsForm.resetFields();
        }}
        onOk={handleCreateOrUpdateDs}
        confirmLoading={dsSubmitting}
        width={500}
        destroyOnClose
      >
        <Form form={dsForm} layout="vertical">
          <Form.Item
            name="name"
            label="数据源名称"
            rules={[{ required: true, message: '请输入数据源名称' }]}
          >
            <Input placeholder="如: production-mysql" />
          </Form.Item>
          <Form.Item
            name="type"
            label="数据库类型"
            rules={[{ required: true, message: '请选择数据库类型' }]}
          >
            <Select options={dbTypeOptions} />
          </Form.Item>
          <Form.Item
            name="host"
            label="主机地址"
            rules={[{ required: true, message: '请输入主机地址' }]}
          >
            <Input placeholder="如: 10.0.0.1" />
          </Form.Item>
          <Form.Item
            name="port"
            label="端口"
            rules={[{ required: true, message: '请输入端口号' }]}
          >
            <Input placeholder="如: 3306" />
          </Form.Item>
          <Form.Item
            name="database"
            label="数据库名"
            rules={[{ required: true, message: '请输入数据库名' }]}
          >
            <Input placeholder="如: orion_prod" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DataSourcesTab;
