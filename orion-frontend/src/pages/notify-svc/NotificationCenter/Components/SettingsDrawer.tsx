/**
 * NotificationCenter settings drawer
 * 抽取自 index.tsx (P2-9 Phase 159)
 */
import { Divider, Drawer, Empty, Space, Spin, Switch, Typography } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

export interface NotificationSettings {
  emailEnabled: boolean;
  soundEnabled: boolean;
  desktopEnabled: boolean;
  ticketAssigned: boolean;
  ticketEscalated: boolean;
  slaWarning: boolean;
  slaBreached: boolean;
  pipelineCompleted: boolean;
  systemAlert: boolean;
  commentMention: boolean;
  transferRequest: boolean;
}

type SettingsKey = keyof NotificationSettings;

interface SettingsDrawerProps {
  open: boolean;
  loading: boolean;
  settings: NotificationSettings | null;
  saving: boolean;
  onClose: () => void;
  onToggle: (key: SettingsKey) => void;
}

const CHANNEL_SETTINGS: Array<{ key: SettingsKey; label: string }> = [
  { key: 'emailEnabled', label: '邮件通知' },
  { key: 'soundEnabled', label: '声音提醒' },
  { key: 'desktopEnabled', label: '桌面推送' },
];

const EVENT_SETTINGS: Array<{ key: SettingsKey; label: string }> = [
  { key: 'ticketAssigned', label: '工单分配' },
  { key: 'ticketEscalated', label: '工单升级' },
  { key: 'slaWarning', label: 'SLA 警告' },
  { key: 'slaBreached', label: 'SLA 违约' },
  { key: 'pipelineCompleted', label: 'Pipeline 完成' },
  { key: 'systemAlert', label: '系统告警' },
  { key: 'commentMention', label: '评论提及' },
  { key: 'transferRequest', label: '转派请求' },
];

const SwitchRow = ({
  label,
  checked,
  saving,
  onToggle,
}: {
  label: string;
  checked: boolean;
  saving: boolean;
  onToggle: () => void;
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing[3],
    }}
  >
    <Text>{label}</Text>
    <Switch checked={checked} onChange={onToggle} loading={saving} />
  </div>
);

export const SettingsDrawer = ({
  open,
  loading,
  settings,
  saving,
  onClose,
  onToggle,
}: SettingsDrawerProps) => (
  <Drawer
    title={
      <Space>
        <SettingOutlined /> 通知设置
      </Space>
    }
    open={open}
    onClose={onClose}
    width={480}
    destroyOnClose
  >
    {loading ? (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Spin size="large" />
      </div>
    ) : settings ? (
      <div>
        <Title level={5}>通知渠道</Title>
        <div style={{ marginBottom: spacing.md }}>
          {CHANNEL_SETTINGS.map((item) => (
            <SwitchRow
              key={item.key}
              label={item.label}
              checked={settings[item.key]}
              saving={saving}
              onToggle={() => onToggle(item.key)}
            />
          ))}
        </div>

        <Divider />

        <Title level={5}>通知类型</Title>
        <div>
          {EVENT_SETTINGS.map((item) => (
            <SwitchRow
              key={item.key}
              label={item.label}
              checked={settings[item.key]}
              saving={saving}
              onToggle={() => onToggle(item.key)}
            />
          ))}
        </div>
      </div>
    ) : (
      <Empty description="无法加载通知设置" />
    )}
  </Drawer>
);
