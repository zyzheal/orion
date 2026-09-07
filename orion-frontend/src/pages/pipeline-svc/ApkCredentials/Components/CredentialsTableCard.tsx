/**
 * ApkCredentials table card
 * 抽取自 index.tsx (P2-9 Phase 137)
 */
import React from 'react';
import { Card } from 'antd';
import Table from '@/components/Table';
import type { CredentialRecord, EditingCredential } from '../types';
import { buildCredentialColumns } from '../credentialColumns';

interface CredentialsTableCardProps {
  credentials: CredentialRecord[];
  loading: boolean;
  openEditModal: (record: EditingCredential) => void;
  handleDelete: (id: string, market: string) => void;
}

export const CredentialsTableCard: React.FC<CredentialsTableCardProps> = ({
  credentials,
  loading,
  openEditModal,
  handleDelete,
}) => (
  <Card>
    <Table
      columns={buildCredentialColumns({ openEditModal, handleDelete })}
      dataSource={credentials}
      rowKey="id"
      loading={loading}
      locale={{ emptyText: '尚未配置任何应用市场凭证' }}
    />
  </Card>
);
