/**
 * RAGAdminConfigTab.tsx - RAG 管理页 配置 Tab
 * 抽取自 AIDocManagement/RAGAdmin.tsx (P2-9 Phase 98)
 */
import React from 'react';
import {
  Button,
  Space,
  Form,
  InputNumber,
  Empty,
  Spin,
  Popconfirm,
  Row,
  Col,
  Descriptions,
} from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { colors, spacing, componentRadius } from '@/tokens';
import { CONFIG_FIELDS, DEFAULT_CONFIG, type RAGConfig } from './RAGAdminConstants';

interface RAGAdminConfigTabProps {
  configLoading: boolean;
  configSaving: boolean;
  config: RAGConfig | null;
  configForm: ReturnType<typeof Form.useForm>[0];
  indexRebuilding: boolean;
  loadConfig: () => Promise<void>;
  handleSaveConfig: () => Promise<void>;
  handleTriggerIndex: () => Promise<void>;
}

export const RAGAdminConfigTab: React.FC<RAGAdminConfigTabProps> = ({
  configLoading,
  configSaving,
  config,
  configForm,
  indexRebuilding,
  loadConfig,
  handleSaveConfig,
  handleTriggerIndex,
}) => (
  <Spin spinning={configLoading}>
    {config === null && !configLoading ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="加载配置失败">
        <Button onClick={loadConfig}>重新加载</Button>
      </Empty>
    ) : (
      <Form form={configForm} layout="vertical" initialValues={DEFAULT_CONFIG} style={{ maxWidth: 700 }}>
        <Descriptions title="检索参数" column={1} style={{ marginBottom: spacing.md }} />
        <Row gutter={24}>
          {CONFIG_FIELDS.slice(0, 5).map((field) => (
            <Col span={12} key={field.key as string}>
              <Form.Item
                name={field.key as string}
                label={field.label}
                tooltip={field.description}
                rules={[
                  { required: true, message: `请输入${field.label}` },
                  {
                    type: 'number',
                    min: field.min,
                    max: field.max,
                    message: `${field.label} 取值范围为 ${field.min}-${field.max}`,
                  },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  placeholder={field.description}
                />
              </Form.Item>
            </Col>
          ))}
        </Row>

        <Descriptions
          title="预算控制"
          column={1}
          style={{ marginTop: spacing.md, marginBottom: spacing.md }}
        />
        <Row gutter={24}>
          {CONFIG_FIELDS.slice(5).map((field) => (
            <Col span={8} key={field.key as string}>
              <Form.Item
                name={field.key as string}
                label={field.label}
                tooltip={field.description}
                rules={[
                  { required: true, message: `请输入${field.label}` },
                  {
                    type: 'number',
                    min: field.min,
                    max: field.max,
                    message: `${field.label} 取值范围为 ${field.min}-${field.max}`,
                  },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  placeholder={field.description}
                  addonAfter="元"
                />
              </Form.Item>
            </Col>
          ))}
        </Row>

        <Form.Item style={{ marginTop: spacing.lg }}>
          <Space>
            <Button
              type="primary"
              onClick={handleSaveConfig}
              loading={configSaving}
              style={{ height: 36, borderRadius: componentRadius.button.md }}
            >
              保存配置
            </Button>
            <Button
              onClick={() => {
                if (config) {
                  configForm.setFieldsValue(config);
                } else {
                  configForm.resetFields();
                }
              }}
              style={{ height: 36, borderRadius: componentRadius.button.md }}
            >
              重置
            </Button>
            <Popconfirm
              title="确认重建索引？"
              description="重建索引可能需要较长时间，期间检索服务可能受影响。"
              onConfirm={handleTriggerIndex}
              okText="确认重建"
              cancelText="取消"
            >
              <Button
                icon={<ThunderboltOutlined />}
                loading={indexRebuilding}
                style={{
                  height: 36,
                  borderRadius: componentRadius.button.md,
                  borderColor: colors.warning[500],
                  color: colors.warning[500],
                }}
              >
                触发索引重建
              </Button>
            </Popconfirm>
          </Space>
        </Form.Item>
      </Form>
    )}
  </Spin>
);
