/**
 * Runner Management Page
 * - 布局编排: Header + SearchFilterBar + Table + 2 RegisterRunnerModal + RunnerDetailDrawer
 * 抽取自 754 行原始文件 (P2-9 Phase 59)
 */
import React from 'react';
import { Typography, Button, Space } from 'antd';
import { PlusOutlined, ReloadOutlined, RocketOutlined } from '@ant-design/icons';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import { colors, spacing } from '@/tokens';
import { useRunnerState } from './useRunnerState';
import { useRunnerColumns } from './RunnerColumns';
import { RegisterRunnerModal } from './RegisterRunnerModal';
import { RunnerDetailDrawer } from './RunnerDetailDrawer';

const { Title, Text } = Typography;

const RunnerManagement: React.FC = () => {
  const {
    runners,
    loading,
    setSearchQuery,
    setFilters,
    registerVisible, setRegisterVisible,
    editingRunner, setEditingRunner,
    selectedRunner, setSelectedRunner,
    drawerVisible, setDrawerVisible,
    filteredRunners,
    loadRunners,
    handleDeregister,
    handleViewDetail,
    handleEditRunner,
    filterDefs,
  } = useRunnerState();

  const columns = useRunnerColumns({
    handleDeregister,
    handleViewDetail,
    handleEditRunner,
  });

  const onlineCount = runners.filter((r) => r.status === 'online').length;
  const busyCount = runners.filter((r) => r.status === 'busy').length;

  return (
    <div style={{ padding: 0 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <RocketOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            Runner 资源池
          </Title>
          <Text type="secondary">
            共 {filteredRunners.length} 个 Runner
            {onlineCount > 0 && <> · {onlineCount} 个在线</>}
            {busyCount > 0 && <> · {busyCount} 个忙碌</>}
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadRunners} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setRegisterVisible(true)}>
            注册 Runner
          </Button>
        </Space>
      </div>

      {/* Search and filter */}
      <div style={{ marginBottom: spacing.md }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索 Runner 名称、标签、OS..."
        />
      </div>

      {/* Runner Table */}
      <Table
        columns={columns}
        dataSource={filteredRunners}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />

      {/* Register Runner Modal */}
      <RegisterRunnerModal
        visible={registerVisible}
        onCancel={() => {
          setRegisterVisible(false);
          setEditingRunner(null);
        }}
        onSuccess={() => {
          setRegisterVisible(false);
          setEditingRunner(null);
          loadRunners();
        }}
      />
      {/* Edit Runner Modal */}
      <RegisterRunnerModal
        visible={!!editingRunner}
        onCancel={() => setEditingRunner(null)}
        onSuccess={() => {
          setEditingRunner(null);
          loadRunners();
        }}
        runner={editingRunner}
      />

      {/* Runner Detail Drawer */}
      <RunnerDetailDrawer
        visible={drawerVisible}
        runner={selectedRunner}
        onClose={() => {
          setDrawerVisible(false);
          setSelectedRunner(null);
        }}
      />
    </div>
  );
};

export default RunnerManagement;
