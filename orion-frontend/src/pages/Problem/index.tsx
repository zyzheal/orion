/**
 * Problem Management Page
 * Problem lifecycle management with KEDB (Known Error Database) and incident/change linking.
 *
 * 拆分结构（P2-9 Phase 33 + Phase 233 + Phase 278）:
 * - useProblemState.tsx: 全部 state + 4 loader + 12 handler（不含 form 校验）
 * - useProblemHandlers.ts: 5 个 form 校验包装器 + 2 个 open modal 包装器
 * - ProblemListTab.tsx / ProblemDetailTab.tsx / KEDBTab.tsx: 3 tabs
 * - ProblemStatsCards.tsx / ProblemModals.tsx / columns.tsx / config.tsx
 * - Components/{PageHeader,TabItems,ModalsBundle}.tsx (Phase 278 新增)
 * - index.tsx: 组合层 181->52 行 (-71%)
 */
import React from 'react';
import { Form, Tabs } from 'antd';
import { Layout } from '@/components/Layout';
import { useProblemState } from './useProblemState';
import { useProblemHandlers } from './useProblemHandlers';
import { ProblemStatsCards } from './ProblemStatsCards';
import { PageHeader } from './Components/PageHeader';
import { buildProblemTabItems } from './Components/TabItems';
import { ProblemModalsBundle } from './Components/ModalsBundle';

const ProblemPage: React.FC = () => {
  const s = useProblemState();

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [linkForm] = Form.useForm();
  const [kedbForm] = Form.useForm();
  const [kedbEditForm] = Form.useForm();

  const h = useProblemHandlers({ state: s, createForm, editForm, linkForm, kedbForm, kedbEditForm });

  const tabItems = buildProblemTabItems({ s, h, linkForm });

  return (
    <Layout>
      <div style={{ padding: 0 }}>
        <PageHeader />
        <ProblemStatsCards stats={s.stats} />
        <Tabs activeKey={s.activeTab} onChange={s.setActiveTab} items={tabItems} size="large" />
        <ProblemModalsBundle
          s={s}
          h={h}
          createForm={createForm}
          editForm={editForm}
          linkForm={linkForm}
          kedbForm={kedbForm}
          kedbEditForm={kedbEditForm}
        />
      </div>
    </Layout>
  );
};

export default ProblemPage;
