/**
 * Role create modal
 * 抽取自 index.tsx (P2-9 Phase 165)
 */
import { Checkbox, Divider, Form, Input, Modal, Typography } from 'antd';
import { PERMISSION_GROUPS } from '@/api/roles';
import { spacing } from '@/tokens';

const { Text } = Typography;

interface CreateRoleModalProps {
  open: boolean;
  form: ReturnType<typeof Form.useForm>[0];
  submitting: boolean;
  onOk: () => void | Promise<void>;
  onCancel: () => void;
}

export const CreateRoleModal = ({ open, form, submitting, onOk, onCancel }: CreateRoleModalProps) => (
  <Modal
    title="创建角色"
    open={open}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={submitting}
    width={720}
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item
        name="name"
        label="角色名称"
        rules={[{ required: true, message: '请输入角色名称' }]}
      >
        <Input placeholder="如: Developer, Viewer" />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <Input.TextArea rows={2} placeholder="角色描述..." />
      </Form.Item>
      <Divider orientation="left" style={{ margin: '16px 0' }}>
        权限分配
      </Divider>
      <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
        <Form.Item name="permissions" valuePropName={undefined} noStyle>
          {PERMISSION_GROUPS.map((group) => {
            return (
              <div key={group.group} style={{ marginBottom: spacing.md }}>
                <Text strong style={{ fontSize: 13 }}>
                  {group.group}
                </Text>
                <Checkbox.Group
                  style={{ width: '100%', marginTop: spacing.sm, marginLeft: 0 }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '4px 16px',
                    }}
                  >
                    {group.permissions.map((p) => (
                      <Checkbox key={p.value} value={p.value}>
                        {p.label}
                      </Checkbox>
                    ))}
                  </div>
                </Checkbox.Group>
              </div>
            );
          })}
        </Form.Item>
      </div>
    </Form>
  </Modal>
);
