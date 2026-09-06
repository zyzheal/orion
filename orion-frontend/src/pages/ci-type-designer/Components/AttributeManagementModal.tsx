/**
 * AttributeManagementModal - 属性管理弹窗 (Form.List 动态表单)
 * 抽取自 index.tsx (P2-9 Phase 106)
 */
import React from 'react';
import { Modal, Form, Input, Select, Switch, Card, Button, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ATTRIBUTE_TYPE_OPTIONS } from '../constants';
import type { CITypeDesignerState } from '../useCITypeDesignerState';

interface AttributeManagementModalProps {
  state: CITypeDesignerState;
}

export const AttributeManagementModal: React.FC<AttributeManagementModalProps> = ({ state }) => (
  <Modal
    title="管理属性"
    open={state.attrModalOpen}
    onOk={state.handleSaveAttributes}
    onCancel={() => state.setAttrModalOpen(false)}
    destroyOnClose
    width={700}
  >
    <Form form={state.attrForm} layout="vertical" initialValues={{ attributes: [] }}>
      <Form.List name="attributes">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <Card
                key={key}
                size="small"
                style={{ marginBottom: 8, borderRadius: 8 }}
                extra={
                  <Button type="link" danger onClick={() => remove(name)}>
                    删除
                  </Button>
                }
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <Form.Item
                      {...restField}
                      name={[name, 'attrKey']}
                      rules={[{ required: true, message: '必填' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input placeholder="属性键" style={{ width: 160 }} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'displayName']} style={{ marginBottom: 0 }}>
                      <Input placeholder="显示名称" style={{ width: 160 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'attrType']}
                      initialValue="string"
                      style={{ marginBottom: 0 }}
                    >
                      <Select style={{ width: 120 }} options={ATTRIBUTE_TYPE_OPTIONS} />
                    </Form.Item>
                  </Space>
                  <Space>
                    <Form.Item
                      {...restField}
                      name={[name, 'required']}
                      valuePropName="checked"
                      style={{ marginBottom: 0 }}
                    >
                      <Switch checkedChildren="必填" unCheckedChildren="可选" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'defaultValue']} style={{ marginBottom: 0 }}>
                      <Input placeholder="默认值" style={{ width: 160 }} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'sortOrder']} style={{ marginBottom: 0 }}>
                      <Input type="number" placeholder="排序" style={{ width: 80 }} />
                    </Form.Item>
                  </Space>
                </Space>
              </Card>
            ))}
            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
              添加属性
            </Button>
          </>
        )}
      </Form.List>
    </Form>
  </Modal>
);
