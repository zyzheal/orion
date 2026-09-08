/**
 * TabSwitcher - 3 个 Tab 按钮切换
 * 抽取自 index.tsx (P2-9 Phase 213)
 */
import { Button } from 'antd';
import { ApiOutlined, LinkOutlined, SettingOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';

type TabKey = 'extensions' | 'plugins' | 'config';

interface Props {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
}

export const TabSwitcher = ({ activeTab, onChange }: Props) => (
  <div style={{ display: 'flex', gap: spacing[2], marginBottom: spacing[4] }}>
    <Button
      type={activeTab === 'extensions' ? 'primary' : 'default'}
      onClick={() => onChange('extensions')}
    >
      <ApiOutlined /> 扩展点列表
    </Button>
    <Button
      type={activeTab === 'plugins' ? 'primary' : 'default'}
      onClick={() => onChange('plugins')}
    >
      <LinkOutlined /> 插件注册列表
    </Button>
    <Button
      type={activeTab === 'config' ? 'primary' : 'default'}
      onClick={() => onChange('config')}
    >
      <SettingOutlined /> SPI 配置
    </Button>
  </div>
);
