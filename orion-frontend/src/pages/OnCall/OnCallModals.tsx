/**
 * OnCall Modals & Drawers
 */
import React from 'react';
import {
  Modal,
  Drawer,
  Form,
  Input,
  Select,
  Typography,
} from 'antd';
import { spacing } from '@/tokens';
import type { OnCallSchedule } from '@/api/oncall';

type FormInstance = ReturnType<typeof Form.useForm>[0];
const { Text } = Typography;


// Timezone options
const timezoneOptions = [
  { label: 'Asia/Shanghai (UTC+8)', value: 'Asia/Shanghai' },
  { label: 'America/New_York (UTC-5)', value: 'America/New_York' },
  { label: 'America/Los_Angeles (UTC-8)', value: 'America/Los_Angeles' },
  { label: 'Europe/London (UTC+0)', value: 'Europe/London' },
  { label: 'Europe/Berlin (UTC+1)', value: 'Europe/Berlin' },
  { label: 'Asia/Tokyo (UTC+9)', value: 'Asia/Tokyo' },
  { label: 'UTC', value: 'UTC' },
];

interface OnCallModalsProps {
  renderDetailContent: () => React.ReactNode;
  resolveUserName: (userId: string) => string;
  createModalVisible: boolean;
  setCreateModalVisible: (v: boolean) => void;
  overrideModalVisible: boolean;
  setOverrideModalVisible: (v: boolean) => void;
  detailDrawerVisible: boolean;
  setDetailDrawerVisible: (v: boolean) => void;
  selectedSchedule: OnCallSchedule | null;
  setSelectedSchedule: (v: OnCallSchedule | null) => void;
  createForm: FormInstance;
  overrideForm: FormInstance;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  memberInput: string;
  setMemberInput: (v: string) => void;
  handleCreate: () => void;
  handleCreateOverride: () => void;
  schedules: OnCallSchedule[];
  userMap: Record<string, string>;
  usersLoading: boolean;
}

export const OnCallModals: React.FC<OnCallModalsProps> = (props) => (
  <>
          <Modal
            title="创建值班排班"
            open={props.createModalVisible}
            onCancel={() => props.setCreateModalVisible(false)}
            onOk={props.handleCreate}
            confirmLoading={props.submitting}
            width={560}
            destroyOnClose
          >
            <Form form={props.createForm} layout="vertical">
              <Form.Item
                name="name"
                label="排班名称"
                rules={[{ required: true, message: '请输入排班名称' }]}
              >
                <Input placeholder="如: 平台核心服务值班" />
              </Form.Item>
              <Form.Item
                name="timezone"
                label="时区"
                rules={[{ required: true, message: '请选择时区' }]}
                initialValue="Asia/Shanghai"
              >
                <Select options={timezoneOptions} />
              </Form.Item>
              <Form.Item
                name="rotationType"
                label="轮换方式"
                rules={[{ required: true, message: '请选择轮换方式' }]}
              >
                <Select
                  options={[
                    { label: '每日轮换', value: 'daily' },
                    { label: '每周轮换', value: 'weekly' },
                    { label: '每月轮换', value: 'monthly' },
                  ]}
                />
              </Form.Item>
              <Form.Item label="团队成员 (逗号分隔的用户ID)" required>
                <Input
                  value={props.memberInput}
                  onChange={(e) => props.setMemberInput(e.target.value)}
                  placeholder="如: dev-001, dev-002, dev-003"
                />
              </Form.Item>
              <Form.Item name="rotationStartHour" label="轮换开始时间 (小时)" initialValue={9}>
                <Select
                  options={Array.from({ length: 24 }, (_, i) => ({ label: `${i}:00`, value: i }))}
                />
              </Form.Item>
            </Form>
          </Modal>

          {/* Override Modal */}
          <Modal
            title="设置代班"
            open={props.overrideModalVisible}
            onCancel={() => props.setOverrideModalVisible(false)}
            onOk={props.handleCreateOverride}
            confirmLoading={props.submitting}
            width={480}
            destroyOnClose
          >
            {props.selectedSchedule && (
              <div style={{ marginBottom: spacing.md }}>
                <Text>
                  当前排班: <Text strong>{props.selectedSchedule.name}</Text>
                </Text>
              </div>
            )}
            <Form form={props.overrideForm} layout="vertical">
              <Form.Item
                name="originalUserId"
                label="原始值班人员"
                rules={[{ required: true, message: '请选择原始值班人员' }]}
              >
                <Select
                  options={props.selectedSchedule?.teamMembers.map((uid: string) => ({
                    label: props.resolveUserName(uid),
                    value: uid,
                  }))}
                  placeholder="选择原始值班人员"
                />
              </Form.Item>
              <Form.Item
                name="overrideUserId"
                label="代班人员"
                rules={[{ required: true, message: '请选择代班人员' }]}
              >
                <Select
                  loading={props.usersLoading}
                  options={Object.entries(props.userMap)
                    .filter(([uid]) => props.selectedSchedule?.teamMembers.includes(uid))
                    .map(([uid, name]) => ({ label: name, value: uid }))}
                  placeholder="选择代班人员"
                />
              </Form.Item>
              <Form.Item
                name="startTime"
                label="代班开始时间"
                rules={[{ required: true, message: '请选择开始时间' }]}
              >
                <Input placeholder="YYYY-MM-DD HH:mm" />
              </Form.Item>
              <Form.Item
                name="endTime"
                label="代班结束时间"
                rules={[{ required: true, message: '请选择结束时间' }]}
              >
                <Input placeholder="YYYY-MM-DD HH:mm" />
              </Form.Item>
              <Form.Item name="reason" label="代班原因">
                <Input.TextArea rows={2} placeholder="代班原因..." />
              </Form.Item>
            </Form>
          </Modal>

          {/* Detail Drawer */}
          <Drawer
            title={props.selectedSchedule ? `${props.selectedSchedule.name} - 排班详情` : '排班详情'}
            open={props.detailDrawerVisible}
            onClose={() => props.setDetailDrawerVisible(false)}
            width={720}
            destroyOnClose
          >
            {props.renderDetailContent()}
          </Drawer>
  </>
);
