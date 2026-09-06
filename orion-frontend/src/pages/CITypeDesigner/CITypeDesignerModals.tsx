/**
 * CITypeDesigner Modals & Drawers
 */
import React from 'react';
import {Modal,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Tag, Col, Descriptions, InputNumber, Row, Switch, Typography
} from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import type { CIType, CIAttribute, CITypeVersion } from '@/api/ci-types';
import dayjs from 'dayjs';
import { colors, spacing, componentRadius } from '@/tokens';

const { TextArea } = Input;
const { Text } = Typography;

type FormInstance = ReturnType<typeof Form.useForm>[0];

interface CITypeDesignerModalsProps {
  ciTypes: CIType[];
  setCITypes: (v: CIType[]) => void;
  typesLoading: boolean;
  setTypesLoading: (v: boolean) => void;
  typeModalVisible: boolean;
  setTypeModalVisible: (v: boolean) => void;
  typeConfirmLoading: boolean;
  setTypeConfirmLoading: (v: boolean) => void;
  editingType: CIType | null;
  setEditingType: (v: CIType | null) => void;
  typeForm: FormInstance;
  handleSaveType: () => void;
  handleDeleteType: (id: string) => void;
  detailDrawerVisible: boolean;
  setDetailDrawerVisible: (v: boolean) => void;
  selectedType: CIType | null;
  setSelectedType: (v: CIType | null) => void;
  selectedTypeId: string | undefined;
  setSelectedTypeId: (v: string | undefined) => void;
  attributes: CIAttribute[];
  setAttributes: (v: CIAttribute[]) => void;
  attrsLoading: boolean;
  setAttrsLoading: (v: boolean) => void;
  attrModalVisible: boolean;
  setAttrModalVisible: (v: boolean) => void;
  editingAttr: CIAttribute | null;
  setEditingAttr: (v: CIAttribute | null) => void;
  attrForm: FormInstance;
  handleSaveAttr: () => void;
  handleDeleteAttr: (r: CIAttribute) => void;
  versions: CITypeVersion[];
  setVersions: (v: CITypeVersion[]) => void;
  versionsLoading: boolean;
  setVersionsLoading: (v: boolean) => void;
  validateModalVisible: boolean;
  setValidateModalVisible: (v: boolean) => void;
  validatingType: CIType | null;
  setValidatingType: (v: CIType | null) => void;
  validateForm: FormInstance;
  validationResult: any;
  setValidationResult: (v: any) => void;
  handleValidate: () => void;
  handleCreateVersion: () => void;
  handleRollback: (v: CITypeVersion) => void;
  activeTab: string;
  setActiveTab: (v: string) => void;
  categoryFilter: string | undefined;
  setCategoryFilter: (v: string | undefined) => void;
  versionTypeId: string | undefined;
  setVersionTypeId: (v: string | undefined) => void;
  categoryOptions: { label: string; value: string }[];
  attrTypeOptions: { label: string; value: string }[];
  categoryColorMap: Record<string, string>;
}

export const CITypeDesignerModals: React.FC<CITypeDesignerModalsProps> = (props) => (
  <>
      {/* ============ Create/Edit CI Type Modal ============ */}
      <Modal
        title={props.editingType ? '编辑 CI 类型' : '创建 CI 类型'}
        open={props.typeModalVisible}
        onOk={props.handleSaveType}
        confirmLoading={props.typeConfirmLoading}
        onCancel={() => props.setTypeModalVisible(false)}
        width={600}
        destroyOnClose
      >
        <Form form={props.typeForm} layout="vertical">
          <Form.Item
            name="name"
            label="类型名称"
            rules={[{ required: true, message: '请输入类型名称' }]}
          >
            <Input placeholder="如 server, database, router" disabled={!!props.editingType} />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称">
            <Input placeholder="如 服务器, 数据库, 路由器" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="输入类型描述" />
          </Form.Item>
          <Row gutter={spacing.md}>
            <Col span={12}>
              <Form.Item name="icon" label="图标">
                <Input placeholder="图标名称或 emoji" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="分类">
                <Select placeholder="选择分类" options={props.categoryOptions} allowClear />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ============ Detail Drawer ============ */}
      <Drawer
        title="CI 类型详情"
        open={props.detailDrawerVisible}
        onClose={() => props.setDetailDrawerVisible(false)}
        width={500}
      >
        {props.selectedType && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="类型名称">{props.selectedType.name}</Descriptions.Item>
            <Descriptions.Item label="显示名称">
              {props.selectedType.displayName ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="描述">{props.selectedType.description ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="图标">{props.selectedType.icon ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="分类">
              {props.selectedType.category ? (
                <Tag color={props.categoryColorMap[props.selectedType.category] ?? 'default'}>
                  {props.selectedType.category}
                </Tag>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="版本">
              <Tag>v{props.selectedType.version}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={props.selectedType.enabled ? 'green' : 'default'}>
                {props.selectedType.enabled ? '启用' : '禁用'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(props.selectedType.createdAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(props.selectedType.updatedAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* ============ Add/Edit Attribute Modal ============ */}
      <Modal
        title={props.editingAttr ? '编辑属性' : '添加属性'}
        open={props.attrModalVisible}
        onOk={props.handleSaveAttr}
        onCancel={() => props.setAttrModalVisible(false)}
        width={600}
        destroyOnClose
      >
        <Form form={props.attrForm} layout="vertical">
          <Row gutter={spacing.md}>
            <Col span={12}>
              <Form.Item
                name="attrKey"
                label="属性标识"
                rules={[{ required: true, message: '请输入属性标识' }]}
              >
                <Input placeholder="如 hostname, ip_address" disabled={!!props.editingAttr} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="displayName" label="显示名称">
                <Input placeholder="如 主机名, IP 地址" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={spacing.md}>
            <Col span={12}>
              <Form.Item
                name="attrType"
                label="属性类型"
                rules={[{ required: true, message: '请选择属性类型' }]}
              >
                <Select placeholder="选择类型" options={props.attrTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="required" label="必填" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="sortOrder" label="排序">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="defaultValue" label="默认值">
            <Input placeholder="默认值（可选）" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.attrType !== cur.attrType}>
            {({ getFieldValue }) => {
              const attrType = getFieldValue('attrType');
              if (attrType === 'select' || attrType === 'multiselect') {
                return (
                  <Form.Item
                    name="options"
                    label="选项列表"
                    extra="每行一个选项"
                    rules={[{ required: true, message: '请输入选项' }]}
                  >
                    <TextArea rows={3} placeholder={'选项1\n选项2\n选项3'} />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>
          <Form.Item name="validationRule" label="校验规则">
            <Input placeholder="正则表达式或校验规则（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ============ Validate Instance Modal ============ */}
      <Modal
        title={`校验实例数据 - ${props.validatingType?.displayName ?? props.validatingType?.name ?? ''}`}
        open={props.validateModalVisible}
        onOk={props.handleValidate}
        onCancel={() => props.setValidateModalVisible(false)}
        width={600}
        okText="校验"
        destroyOnClose
      >
        <Form form={props.validateForm} layout="vertical">
          <Form.Item
            name="instanceData"
            label="实例数据 (JSON)"
            rules={[{ required: true, message: '请输入 JSON 数据' }]}
            extra="输入 JSON 格式的实例数据，将根据类型 Schema 进行校验"
          >
            <TextArea
              rows={8}
              placeholder={'{\n  "hostname": "web-01",\n  "ip_address": "192.168.1.100"\n}'}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Form.Item>
        </Form>

        {props.validationResult && (
          <div style={{ marginTop: spacing.md }}>
            {props.validationResult.valid ? (
              <div
                style={{
                  padding: spacing.md,
                  background: colors.success[50],
                  border: `1px solid ${colors.success[200]}`,
                  borderRadius: componentRadius.input,
                }}
              >
                <Space>
                  <CheckCircleOutlined style={{ color: colors.success[500] }} />
                  <Text style={{ color: colors.success[500] }}>校验通过，数据格式正确</Text>
                </Space>
              </div>
            ) : (
              <div
                style={{
                  padding: spacing.md,
                  background: colors.error[50],
                  border: `1px solid ${colors.error[100]}`,
                  borderRadius: componentRadius.input,
                }}
              >
                <Text
                  strong
                  style={{ color: colors.error[500], display: 'block', marginBottom: 8 }}
                >
                  校验不通过
                </Text>
                {props.validationResult.errors.map((err: any, idx: number) => (
                  <div key={String(idx)} style={{ marginBottom: 4 }}>
                    <Tag color="error">{err.field}</Tag>
                    <Text type="danger">{err.message}</Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
  </>
);
