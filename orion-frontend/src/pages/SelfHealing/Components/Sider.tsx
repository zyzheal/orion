import { Layout, Menu, Typography, type SiderTheme } from 'antd';
import { colors, themeVars } from '@/tokens';
import { menuItems, LAYOUT_CONFIG } from './constants';

const { Sider } = Layout;
const { Title } = Typography;

interface Props {
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  theme: SiderTheme;
  selectedKey: string;
  onMenuClick: (key: string) => void;
}

export function SelfHealingSider({ collapsed, onCollapse, theme, selectedKey, onMenuClick }: Props) {
  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      theme={theme}
      width={LAYOUT_CONFIG.siderWidth}
      style={{
        background: themeVars.bgPrimary,
        borderRight: `1px solid ${themeVars.borderLight}`,
      }}
    >
      {!collapsed && (
        <div style={{ padding: LAYOUT_CONFIG.headerPadding }}>
          <Title
            level={LAYOUT_CONFIG.titleLevel}
            style={{ margin: 0, color: colors.primary[500] }}
          >
            Self-Healing
          </Title>
        </div>
      )}
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={({ key }) => onMenuClick(key)}
        style={{ borderRight: 'none' }}
      />
    </Sider>
  );
}
