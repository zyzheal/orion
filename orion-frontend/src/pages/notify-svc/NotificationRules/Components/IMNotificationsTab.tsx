/**
 * IMNotificationsTab
 * 抽取自 notify-svc/NotificationRules/index.tsx (P2-9 Phase 177)
 */
import { Button, Modal, Form, Input, Select, Switch } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import Table from '@/components/Table';
import DataState from '@/components/DataState';
import { spacing } from '@/tokens';
import { PLATFORM_OPTIONS, IM_EVENT_OPTIONS } from '../constants';
import { buildIMColumns } from '../imColumns';
import { useIMNotificationsState } from '../useIMNotificationsState';

export const IMNotificationsTab = () => {
  const {
    loading,
    error,
    rules,
    modalVisible,
    editingRule,
    form,
    loadRules,
    openCreate,
    openEdit,
    handleModalClose,
    handleSubmit,
    handleDelete,
    handleToggle,
    handleTest,
  } = useIMNotificationsState();

  const columns = buildIMColumns({ handleTest, handleDelete, handleToggle, openEdit });

  return (
    <div>
      <div style={{ marginBottom: spacing.md, textAlign: 'right' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建 IM 通知
        </Button>
      </div>

      <DataState
        loading={loading && rules.length === 0}
        error={error}
        empty={rules.length === 0 && !loading}
        emptyText="暂无 IM 通知规则"
        loadingText="加载 IM 通知规则..."
        retry={loadRules}
      >
        <Table
          columns={columns}
          dataSource={rules}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </DataState>

      <Modal
        title={editingRule ? '编辑 IM 通知规则' : '新建 IM 通知规则'}
        open={modalVisible}
        onCancel={handleModalClose}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="platform"
            label="IM 平台"
            rules={[{ required: true, message: '请选择 IM 平台' }]}
          >
            <Select options={PLATFORM_OPTIONS} placeholder="选择 IM 平台" />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：研发群通知" />
          </Form.Item>
          <Form.Item
            name="webhookUrl"
            label="Webhook URL"
            rules={[{ required: true, message: '请输入 Webhook URL' }, { type: 'url' }]}
          >
            <Input placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." />
          </Form.Item>
          <Form.Item
            name="events"
            label="订阅事件"
            rules={[{ required: true, message: '请选择至少一个事件' }]}
          >
            <Select
              mode="multiple"
              options={IM_EVENT_OPTIONS.map((e) => ({ label: e, value: e }))}
              placeholder="选择订阅事件"
            />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
