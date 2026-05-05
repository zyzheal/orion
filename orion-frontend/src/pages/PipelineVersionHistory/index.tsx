/**
 * Pipeline Version History Page
 * Phase 1 - Version control and rollback UI
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { pipelineVersionsApi, PipelineVersion, VersionDiff } from '../../api/pipeline-versions';
import { Card, Table, Button, Modal, Tag, Space, Tooltip, message } from 'antd';
import { HistoryOutlined, RollbackOutlined, TagOutlined, CheckCircleOutlined } from '@ant-design/icons';

const PipelineVersionHistory: React.FC = () => {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const [versions, setVersions] = useState<PipelineVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [diffModal, setDiffModal] = useState<{ visible: boolean; diff?: VersionDiff }>({ visible: false });
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);

  useEffect(() => {
    loadVersions();
  }, [pipelineId]);

  const loadVersions = async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const response = await pipelineVersionsApi.list(pipelineId);
      setVersions(response.data || []);
    } catch (error) {
      message.error('Failed to load versions');
    }
    setLoading(false);
  };

  const handleRollback = async (versionId: string) => {
    try {
      await pipelineVersionsApi.rollback(pipelineId!, versionId);
      message.success('Rollback successful');
      loadVersions();
    } catch (error) {
      message.error('Rollback failed');
    }
  };

  const handleSetBaseline = async (versionId: string, isBaseline: boolean) => {
    try {
      await pipelineVersionsApi.setBaseline(pipelineId!, versionId, isBaseline);
      message.success(isBaseline ? 'Baseline set' : 'Baseline removed');
      loadVersions();
    } catch (error) {
      message.error('Operation failed');
    }
  };

  const handleDiff = async () => {
    if (selectedVersions.length !== 2) {
      message.warning('Select exactly 2 versions to compare');
      return;
    }
    try {
      const diff = await pipelineVersionsApi.diff(pipelineId!, selectedVersions[0], selectedVersions[1]);
      setDiffModal({ visible: true, diff });
    } catch (error) {
      message.error('Failed to get diff');
    }
  };

  const columns = [
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      render: (v: number) => <Tag color="blue">v{v}</Tag>,
    },
    {
      title: 'Change Summary',
      dataIndex: 'change_summary',
      key: 'change_summary',
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => tags.map(t => <Tag key={t}>{t}</Tag>),
    },
    {
      title: 'Baseline',
      dataIndex: 'is_baseline',
      key: 'is_baseline',
      render: (isBaseline: boolean) => isBaseline ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : null,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: PipelineVersion) => (
        <Space>
          <Tooltip title="Rollback">
            <Button icon={<RollbackOutlined />} onClick={() => handleRollback(record.id)} />
          </Tooltip>
          <Tooltip title="Set Baseline">
            <Button icon={<CheckCircleOutlined />} onClick={() => handleSetBaseline(record.id, !record.is_baseline)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title={<><HistoryOutlined /> Version History</>} extra={
        <Space>
          <Button onClick={handleDiff} disabled={selectedVersions.length !== 2}>Compare</Button>
          <Button onClick={loadVersions}>Refresh</Button>
        </Space>
      }>
        <Table
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedVersions,
            onChange: (keys) => setSelectedVersions(keys as string[]),
          }}
          columns={columns}
          dataSource={versions}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title="Version Comparison"
        open={diffModal.visible}
        onCancel={() => setDiffModal({ visible: false })}
        width={800}
        footer={null}
      >
        {diffModal.diff && (
          <div>
            <p><strong>Summary:</strong> {diffModal.diff.summary}</p>
            <h4>Additions ({diffModal.diff.additions.length})</h4>
            <pre>{JSON.stringify(diffModal.diff.additions, null, 2)}</pre>
            <h4>Deletions ({diffModal.diff.deletions.length})</h4>
            <pre>{JSON.stringify(diffModal.diff.deletions, null, 2)}</pre>
            <h4>Modifications ({diffModal.diff.modifications.length})</h4>
            <pre>{JSON.stringify(diffModal.diff.modifications, null, 2)}</pre>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PipelineVersionHistory;