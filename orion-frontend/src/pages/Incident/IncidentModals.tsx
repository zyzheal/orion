/**
 * Incident Modals
 */
import React from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Tag,
  Divider,
  message,
} from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { Incident, TimelineEvent, Postmortem, PostmortemDraft } from '@/api/incident';
import { severityConfig, statusConfig, priorityConfig, severityOptions, incidentTypeOptions } from './config';

type FormInstance = ReturnType<typeof Form.useForm>[0];

interface IncidentModalsProps {
  selectedIncident: Incident | null;
  setSelectedIncident: (v: Incident | null) => void;
  timeline: TimelineEvent[];
  setTimeline: (v: TimelineEvent[]) => void;
  postmortem: Postmortem | null;
  setPostmortem: (v: Postmortem | null) => void;
  aiDraft: PostmortemDraft | null;
  setAiDraft: (v: PostmortemDraft | null) => void;
  createModalOpen: boolean;
  setCreateModalOpen: (v: boolean) => void;
  editModalOpen: boolean;
  setEditModalOpen: (v: boolean) => void;
  assignModalOpen: boolean;
  setAssignModalOpen: (v: boolean) => void;
  escalateModalOpen: boolean;
  setEscalateModalOpen: (v: boolean) => void;
  postmortemModalOpen: boolean;
  setPostmortemModalOpen: (v: boolean) => void;
  addEventModalOpen: boolean;
  setAddEventModalOpen: (v: boolean) => void;
  statusNoteModalOpen: boolean;
  setStatusNoteModalOpen: (v: boolean) => void;
  pendingStatusChange: string;
  setPendingStatusChange: (v: string) => void;
  createSubmitting: boolean;
  setCreateSubmitting: (v: boolean) => void;
  editSubmitting: boolean;
  setEditSubmitting: (v: boolean) => void;
  createForm: FormInstance;
  editForm: FormInstance;
  assignForm: FormInstance;
  escalateForm: FormInstance;
  postmortemForm: FormInstance;
  eventForm: FormInstance;
  statusNoteForm: FormInstance;
  handleCreate: () => void;
  handleEdit: () => void;
  handleAssign: () => void;
  handleEscalate: () => void;
  handleAddEvent: () => void;
  handleCreatePostmortem: () => void;
  handlePublishPostmortem: () => void;
  handleGenerateDraft: () => void;
  handleFillDraftToForm: () => void;
  handleConfirmStatusChange: () => void;
  handleOpenEdit: () => void;
  handleOpenAssign: () => void;
  handleOpenEscalate: () => void;
  handleStatusChange: (v: string) => void;
  handleBackToList: () => void;
  handleDelete: () => void;
  handleViewDetail: () => void;
}

export const IncidentModals: React.FC<IncidentModalsProps> = (props) => (
  <>
        {/* Create Incident Modal */}
        <Modal
          title="创建事件"
          open={props.createModalOpen}
          onOk={props.handleCreate}
          onCancel={() => { props.setCreateModalOpen(false); props.createForm.resetFields(); }}
          confirmLoading={props.createSubmitting}
          width={640}
          okText="创建"
          cancelText="取消"
        >
          <Form form={props.createForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item name="title" label="事件标题" rules={[{ required: true, message: '请输入事件标题' }]}>
              <Input placeholder="简要描述事件" />
            </Form.Item>
            <Row gutter={spacing.md}>
              <Col span={8}>
                <Form.Item name="severity" label="严重程度" rules={[{ required: true, message: '请选择严重程度' }]}>
                  <Select placeholder="选择严重程度">
                    {severityOptions.map((o) => (
                      <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="type" label="事件类型" initialValue="incident">
                  <Select>
                    {incidentTypeOptions.map((o) => (
                      <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="urgency" label="紧急度">
                  <Select placeholder="选择紧急度" allowClear>
                    {urgencyOptions.map((o) => (
                      <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="description" label="描述">
              <TextArea rows={3} placeholder="详细描述事件情况" />
            </Form.Item>
            <Form.Item name="impact" label="影响范围">
              <TextArea rows={2} placeholder="描述事件影响的范围和用户" />
            </Form.Item>
            <Row gutter={spacing.md}>
              <Col span={12}>
                <Form.Item name="assigned_to" label="负责人">
                  <Input placeholder="负责人用户名" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="detected_by" label="检测来源">
                  <Input placeholder="如: monitoring, alert, manual" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="affected_services" label="受影响服务" help="多个服务用逗号分隔">
              <Input placeholder="service-a, service-b" />
            </Form.Item>
            <Form.Item name="tags" label="标签" help="多个标签用逗号分隔">
              <Input placeholder="tag1, tag2" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Edit Incident Modal */}
        <Modal
          title="编辑事件"
          open={props.editModalOpen}
          onOk={props.handleEdit}
          onCancel={() => { props.setEditModalOpen(false); props.editForm.resetFields(); }}
          confirmLoading={props.editSubmitting}
          width={640}
          okText="保存"
          cancelText="取消"
        >
          <Form form={props.editForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item name="title" label="事件标题" rules={[{ required: true, message: '请输入事件标题' }]}>
              <Input placeholder="简要描述事件" />
            </Form.Item>
            <Row gutter={spacing.md}>
              <Col span={8}>
                <Form.Item name="severity" label="严重程度" rules={[{ required: true, message: '请选择严重程度' }]}>
                  <Select placeholder="选择严重程度">
                    {severityOptions.map((o) => (
                      <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="priority" label="优先级">
                  <Select placeholder="选择优先级" allowClear>
                    {priorityOptions.map((o) => (
                      <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="urgency" label="紧急度">
                  <Select placeholder="选择紧急度" allowClear>
                    {urgencyOptions.map((o) => (
                      <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="description" label="描述">
              <TextArea rows={3} placeholder="详细描述事件情况" />
            </Form.Item>
            <Form.Item name="impact" label="影响范围">
              <TextArea rows={2} placeholder="描述事件影响的范围和用户" />
            </Form.Item>
            <Row gutter={spacing.md}>
              <Col span={12}>
                <Form.Item name="assigned_to" label="负责人">
                  <Input placeholder="负责人用户名" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="detected_by" label="检测来源">
                  <Input placeholder="如: monitoring, alert, manual" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="affected_services" label="受影响服务" help="多个服务用逗号分隔">
              <Input placeholder="service-a, service-b" />
            </Form.Item>
            <Form.Item name="tags" label="标签" help="多个标签用逗号分隔">
              <Input placeholder="tag1, tag2" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Assign Commander Modal */}
        <Modal
          title="分配指挥官"
          open={props.assignModalOpen}
          onOk={props.handleAssign}
          onCancel={() => { props.setAssignModalOpen(false); props.assignForm.resetFields(); }}
          width={400}
          okText="分配"
          cancelText="取消"
        >
          <Form form={props.assignForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item name="commander_id" label="指挥官" rules={[{ required: true, message: '请输入指挥官ID' }]}>
              <Input placeholder="输入指挥官用户名或ID" prefix={<UserOutlined />} />
            </Form.Item>
          </Form>
        </Modal>

        {/* Escalate Modal */}
        <Modal
          title="升级事件"
          open={props.escalateModalOpen}
          onOk={props.handleEscalate}
          onCancel={() => { props.setEscalateModalOpen(false); props.escalateForm.resetFields(); }}
          width={480}
          okText="升级"
          cancelText="取消"
        >
          <Form form={props.escalateForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item name="to_level" label="升级到层级" rules={[{ required: true, message: '请选择升级层级' }]}>
              <Select placeholder="选择目标层级">
                {escalationLevelOptions.map((o) => (
                  <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="reason" label="升级原因" rules={[{ required: true, message: '请输入升级原因' }]}>
              <TextArea rows={3} placeholder="说明升级原因" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Add Timeline Event Modal */}
        <Modal
          title="添加事件记录"
          open={props.addEventModalOpen}
          onOk={props.handleAddEvent}
          onCancel={() => { props.setAddEventModalOpen(false); props.eventForm.resetFields(); }}
          width={480}
          okText="添加"
          cancelText="取消"
        >
          <Form form={props.eventForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item name="event_type" label="事件类型" rules={[{ required: true, message: '请选择事件类型' }]}>
              <Select placeholder="选择事件类型">
                {Object.entries(eventTypeConfig).map(([key, cfg]) => (
                  <Select.Option key={key} value={key}>{cfg.label}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="description" label="事件描述" rules={[{ required: true, message: '请输入事件描述' }]}>
              <TextArea rows={4} placeholder="详细描述此事件记录" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Status Change Note Modal */}
        <Modal
          title={`状态变更: ${statusConfig[props.pendingStatusChange]?.label || props.pendingStatusChange}`}
          open={props.statusNoteModalOpen}
          onOk={props.handleConfirmStatusChange}
          onCancel={() => { props.setStatusNoteModalOpen(false); props.statusNoteForm.resetFields(); }}
          width={480}
          okText="确认变更"
          cancelText="取消"
        >
          <Form form={props.statusNoteForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item name="note" label="备注（可选）">
              <TextArea rows={3} placeholder="添加状态变更备注" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Create Postmortem Modal */}
        <Modal
          title="创建复盘文档"
          open={props.postmortemModalOpen}
          onOk={props.handleCreatePostmortem}
          onCancel={() => { props.setPostmortemModalOpen(false); props.postmortemForm.resetFields(); }}
          width={640}
          okText="创建"
          cancelText="取消"
        >
          <Form form={props.postmortemForm} layout="vertical" style={{ marginTop: spacing.md }}>
            <Form.Item name="title" label="复盘标题" rules={[{ required: true, message: '请输入标题' }]}>
              <Input placeholder="事件复盘标题" />
            </Form.Item>
            <Form.Item name="summary" label="摘要" rules={[{ required: true, message: '请输入摘要' }]}>
              <TextArea rows={3} placeholder="事件概要描述" />
            </Form.Item>
            <Form.Item name="root_cause" label="根因分析" rules={[{ required: true, message: '请输入根因分析' }]}>
              <TextArea rows={3} placeholder="深入分析事件根因" />
            </Form.Item>
            <Form.Item name="impact_description" label="影响描述">
              <TextArea rows={2} placeholder="描述事件影响范围和程度" />
            </Form.Item>
            <Form.Item name="timeline_summary" label="时间线摘要">
              <TextArea rows={2} placeholder="关键时间节点概述" />
            </Form.Item>
            <Form.Item name="action_items" label="行动项" help="每行一个行动项">
              <TextArea
                rows={3}
                placeholder={'修复监控告警阈值\n增加自动化巡检\n优化容灾切换流程'}
              />
            </Form.Item>
            <Form.Item name="lessons_learned" label="经验教训">
              <TextArea rows={3} placeholder="总结经验教训" />
            </Form.Item>
          </Form>
        </Modal>
  </>
);
