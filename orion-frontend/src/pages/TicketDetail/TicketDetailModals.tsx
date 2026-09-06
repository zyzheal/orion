/**
 * TicketDetail Modals
 */
import React from 'react';
import { Modal, Form, Select, Input } from 'antd';

type FormInstance = ReturnType<typeof Form.useForm>[0];

interface TicketDetailModalsProps {
  assignModalOpen: boolean;
  setAssignModalOpen: (v: boolean) => void;
  assignForm: FormInstance;
  escalateModalOpen: boolean;
  setEscalateModalOpen: (v: boolean) => void;
  escalateForm: FormInstance;
  resolveModalOpen: boolean;
  setResolveModalOpen: (v: boolean) => void;
  resolveForm: FormInstance;
  transferModalOpen: boolean;
  setTransferModalOpen: (v: boolean) => void;
  transferForm: FormInstance;
  engineers: { id: string; name?: string; username?: string }[];
  handleAssign: () => void;
  handleEscalate: () => void;
  handleResolve: () => void;
  handleTransfer: () => void;
}

export const TicketDetailModals: React.FC<TicketDetailModalsProps> = (props) => (
  <>
      {/* ---- Modals ---- */}

      {/* Assign Modal */}
      <Modal
        title="分配工单"
        open={props.assignModalOpen}
        onCancel={() => {
          props.setAssignModalOpen(false);
          props.assignForm.resetFields();
        }}
        onOk={props.handleAssign}
        okText="确认分配"
        cancelText="取消"
      >
        <Form form={props.assignForm} layout="vertical">
          <Form.Item
            label="选择工程师"
            name="assignee"
            rules={[{ required: true, message: '请选择工程师' }]}
          >
            <Select placeholder="选择工程师">
              {props.engineers.map((e) => (
                <Select.Option key={e.id} value={e.name || e.username}>
                  {e.name || e.username}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="分配理由" name="reason">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Escalate Modal */}
      <Modal
        title="升级工单"
        open={props.escalateModalOpen}
        onCancel={() => {
          props.setEscalateModalOpen(false);
          props.escalateForm.resetFields();
        }}
        onOk={props.handleEscalate}
        okText="确认升级"
        cancelText="取消"
      >
        <Form form={props.escalateForm} layout="vertical">
          <Form.Item
            label="升级理由"
            name="reason"
            rules={[{ required: true, message: '请输入升级理由' }]}
          >
            <Input.TextArea rows={3} placeholder="请说明升级原因" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Resolve Modal */}
      <Modal
        title="解决工单"
        open={props.resolveModalOpen}
        onCancel={() => {
          props.setResolveModalOpen(false);
          props.resolveForm.resetFields();
        }}
        onOk={props.handleResolve}
        okText="确认解决"
        cancelText="取消"
      >
        <Form form={props.resolveForm} layout="vertical">
          <Form.Item label="解决方案" name="resolutionNote">
            <Input.TextArea rows={4} placeholder="请描述解决方案" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Transfer Modal */}
      <Modal
        title="转交工单"
        open={props.transferModalOpen}
        onCancel={() => {
          props.setTransferModalOpen(false);
          props.transferForm.resetFields();
        }}
        onOk={props.handleTransfer}
        okText="确认转交"
        cancelText="取消"
      >
        <Form form={props.transferForm} layout="vertical">
          <Form.Item
            label="转交给"
            name="toEngineer"
            rules={[{ required: true, message: '请选择接收人' }]}
          >
            <Select placeholder="选择工程师">
              {props.engineers.map((e) => (
                <Select.Option key={e.id} value={e.name || e.username}>
                  {e.name || e.username}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="转交理由"
            name="reason"
            rules={[{ required: true, message: '请输入转交理由' }]}
          >
            <Input.TextArea rows={2} placeholder="请说明转交原因" />
          </Form.Item>
        </Form>
      </Modal>
  </>
);
