/**
 * Script Library Page - 拆分后主页面（P2-9 Phase 34 + Phase 234 + Phase 280）
 *
 * 拆分结构:
 * - useScriptLibraryState.tsx: 全状态 + 5 loader + 15 handler（form wrapper 委托）
 * - useScriptLibraryHandlers.ts: 4 个 validateFields wrapper + 4 个 open modal wrapper + paramColumns
 * - ScriptsTab.tsx / VersionsTab.tsx / HistoryTab.tsx / ScriptLibraryModals.tsx
 * - columns.tsx / config.tsx
 * - Components/{TabItems,ModalsBundle}.tsx (Phase 280 新增)
 * - index.tsx: 组合层 171->40 行 (-77%)
 */
import { Typography, Tabs, Form } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useScriptLibraryState } from './useScriptLibraryState';
import { useScriptLibraryHandlers } from './useScriptLibraryHandlers';
import { buildScriptLibraryTabItems } from './Components/TabItems';
import { ScriptLibraryModalsBundle } from './Components/ModalsBundle';

const { Title } = Typography;

export default function ScriptLibraryPage() {
  const s = useScriptLibraryState();
  const [scriptForm] = Form.useForm();
  const [versionForm] = Form.useForm();
  const [paramForm] = Form.useForm();
  const [executeForm] = Form.useForm();

  const h = useScriptLibraryHandlers({ state: s, scriptForm, versionForm, paramForm, executeForm });
  const tabItems = buildScriptLibraryTabItems({ s, h });

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: 16 }}>
        <CodeOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        脚本库
      </Title>
      <Tabs activeKey={s.activeTab} onChange={s.setActiveTab} items={tabItems} />
      <ScriptLibraryModalsBundle
        s={s}
        h={h}
        scriptForm={scriptForm}
        versionForm={versionForm}
        paramForm={paramForm}
        executeForm={executeForm}
      />
    </div>
  );
}
