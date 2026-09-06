/**
 * KEDBTab - 已知错误数据库 Tab
 * 抽取自 index.tsx
 */
import React from 'react';
import { Space, Button } from 'antd';
import Table from '@/components/Table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import SearchFilterBar from '@/components/SearchFilterBar';
import { spacing } from '@/tokens';
import type { KnownError } from '@/api/problem';
import { knownErrorStatusOptions } from './config';
import { buildKedbColumns } from './columns';

const kedbFilterDefs = [
  { key: 'kedbStatus', label: '状态', options: knownErrorStatusOptions },
];

export interface KEDBTabProps {
  knownErrors: KnownError[];
  kedbLoading: boolean;
  kedbTotal: number;
  kedbPage: number;
  setKedbPage: (p: number) => void;
  kedbPageSize: number;
  setKedbPageSize: (ps: number) => void;
  kedbFilters: Record<string, string | string[] | undefined>;
  setKedbFilters: (f: Record<string, string | string[] | undefined> | ((prev: Record<string, string | string[] | undefined>) => Record<string, string | string[] | undefined>)) => void;
  setKedbModalVisible: (v: boolean) => void;
  loadKnownErrors: () => void;
  handleOpenKedbEditModal: (ke: KnownError) => void;
  handleDeleteKnownError: (id: string) => void;
}

export const KEDBTab: React.FC<KEDBTabProps> = ({
  knownErrors,
  kedbLoading,
  kedbTotal,
  kedbPage,
  setKedbPage,
  kedbPageSize,
  setKedbPageSize,
  kedbFilters,
  setKedbFilters,
  setKedbModalVisible,
  loadKnownErrors,
  handleOpenKedbEditModal,
  handleDeleteKnownError,
}) => {
  const kedbColumns = buildKedbColumns({
    handleOpenKedbEditModal,
    handleDeleteKnownError,
  });

  return (
    <div>
      <SearchFilterBar
        onSearch={(q) => setKedbFilters((prev) => ({ ...prev, kedbSearch: q }))}
        onFilter={setKedbFilters}
        filters={kedbFilterDefs}
        searchPlaceholder="搜索已知错误..."
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadKnownErrors}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setKedbModalVisible(true)}
            >
              新建已知错误
            </Button>
          </Space>
        }
      />
      <div style={{ marginTop: spacing.md }}>
        <Table<KnownError>
          columns={kedbColumns}
          dataSource={knownErrors}
          rowKey="id"
          loading={kedbLoading}
          pagination={{ current: kedbPage, pageSize: kedbPageSize, total: kedbTotal }}
          showTotal
          pageSizeOptions={[10, 20, 50]}
          onPaginationChange={(p: number, ps: number) => {
            setKedbPage(p);
            setKedbPageSize(ps);
          }}
        />
      </div>
    </div>
  );
};
