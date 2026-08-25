/**
 * VersionHistoryPanel — Document version history with diff view and restore
 *
 * Features:
 *  - Collapsible version history section
 *  - Timeline view of all document versions with metadata
 *  - Side-by-side diff between two versions (react-diff-viewer-continued)
 *  - One-click restore to any version with confirmation
 *  - Pagination for large version histories
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Collapse,
  Timeline,
  Space,
  Tag,
  Modal,
  message,
  Button,
  Card,
  Spin,
  Empty,
  Popconfirm,
  Tooltip,
  Input,
} from 'antd';
import type { CollapseProps } from 'antd/es/collapse';
import {
  HistoryOutlined,
  UserOutlined,
  ClockCircleOutlined,
  RollbackOutlined,
  DiffOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import {
  listDocumentVersions,
  getDocumentVersion,
  restoreDocumentVersion,
  type DocumentVersion,
} from '@/api/pandawiki';
import { htmlToMarkdown } from '@/components/MarkdownEditor';
import { SimpleDiffViewer } from './SimpleDiffViewer';

interface VersionHistoryPanelProps {
  spaceId: string;
  docId: string;
  onVersionRestored?: () => void;
}

const PAGE_SIZE = 10;

const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  spaceId,
  docId,
  onVersionRestored,
}) => {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // Diff view state
  const [diffModalVisible, setDiffModalVisible] = useState(false);
  const [diffVersionA, setDiffVersionA] = useState<DocumentVersion | null>(null);
  const [diffVersionB, setDiffVersionB] = useState<DocumentVersion | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffContentA, setDiffContentA] = useState('');
  const [diffContentB, setDiffContentB] = useState('');
  const loadCounterRef = useRef(0);

  // Restore state
  const [restoring, setRestoring] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<DocumentVersion | null>(null);
  const [changeSummary, setChangeSummary] = useState('');

  const loadVersions = useCallback(
    async (pageNum: number) => {
      const counter = ++loadCounterRef.current;
      setLoading(true);
      try {
        const res = await listDocumentVersions(spaceId, docId, {
          limit: PAGE_SIZE,
          offset: (pageNum - 1) * PAGE_SIZE,
        });
        // Stale response — a newer request has been fired
        if (counter !== loadCounterRef.current) return;
        // Handle both PaginatedResponse and raw array shapes
        const data = res.data as
          | DocumentVersion[]
          | { items?: DocumentVersion[]; total?: number; hasMore?: boolean };
        const items = Array.isArray(data) ? data : (data.items ?? []) as DocumentVersion[];
        const totalCount = Array.isArray(data) ? items.length : (data.total ?? items.length);
        const more = Array.isArray(data) ? false : (data.hasMore ?? pageNum * PAGE_SIZE < totalCount);

        // Use functional updater to avoid stale closure and re-trigger
        setVersions((prev) => (pageNum === 1 ? items : [...prev, ...items]));
        setTotal(totalCount ?? items.length);
        setHasMore(more);
      } catch (error: unknown) {
        if (counter === loadCounterRef.current) {
          console.error('[VersionHistory] Failed to load versions:', error);
          message.error('加载版本历史失败');
        }
      } finally {
        if (counter === loadCounterRef.current) setLoading(false);
      }
    },
    [spaceId, docId]
  );

  useEffect(() => {
    setPage(1);
    loadVersions(1);
  }, [docId, loadVersions]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadVersions(nextPage);
  };

  const handleShowDiff = async (version: DocumentVersion) => {
    const idx = versions.findIndex((v) => v.id === version.id);
    const compareWith = idx > 0 ? versions[idx - 1] : null;

    setDiffModalVisible(true);
    setDiffVersionB(version);
    setDiffVersionA(compareWith || null);
    setDiffLoading(true);
    setDiffContentA('');
    setDiffContentB('');

    try {
      const currentMd = htmlToMarkdown(version.content);
      setDiffContentB(currentMd);

      if (compareWith) {
        try {
          const res = await getDocumentVersion(spaceId, docId, compareWith.id);
          const data = res.data as DocumentVersion | { items?: DocumentVersion[] };
          const version = Array.isArray(data) ? data[0] : ('items' in data && data.items ? data.items[0] : data);
          setDiffContentA(htmlToMarkdown((version as DocumentVersion).content));
        } catch {
          setDiffContentA(htmlToMarkdown(compareWith.content));
        }
      } else {
        setDiffContentA('');
      }
    } catch {
      setDiffContentB(htmlToMarkdown(version.content));
      if (compareWith) setDiffContentA(htmlToMarkdown(compareWith.content));
    } finally {
      setDiffLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      await restoreDocumentVersion(spaceId, docId, restoreTarget.id, {
        changeSummary: changeSummary.trim() || `回滚到版本 v${restoreTarget.version}`,
      });
      message.success(`已回滚到版本 v${restoreTarget.version}`);
      setRestoreTarget(null);
      setChangeSummary('');
      onVersionRestored?.();
      loadVersions(1);
    } catch (error: unknown) {
      message.error(`回滚失败: ${(error as Error).message}`);
    } finally {
      setRestoring(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const items: CollapseProps['items'] = [
    {
      key: 'history',
      label: (
        <Space>
          <HistoryOutlined style={{ color: colors.primary[500] }} />
          <span>版本历史</span>
          <Tag color="blue">{total} 个版本</Tag>
        </Space>
      ),
      children: (
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          {versions.length === 0 && !loading ? (
            <Empty
              description="暂无版本历史"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <Timeline
              mode="left"
              items={versions.map((v) => ({
                color: v === versions[0] ? colors.primary[500] : '#d9d9d9',
                children: (
                  <Card size="small" style={{ marginBottom: 8 }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        <Tag color="blue">v{v.version}</Tag>
                        <UserOutlined style={{ color: '#8c8c8c' }} />
                        <span>{v.createdByName || v.createdBy}</span>
                        <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
                        <span style={{ fontSize: 12, color: '#8c8c8c' }}>{formatDate(v.createdAt)}</span>
                      </Space>
                      <Space>
                        <Tooltip title="查看变更">
                          <Button
                            size="small"
                            icon={<DiffOutlined />}
                            onClick={() => handleShowDiff(v)}
                          />
                        </Tooltip>
                        <Popconfirm
                          title={`确认回滚到版本 v${v.version}？`}
                          description="回滚后将创建一个新的版本快照"
                          onConfirm={() => setRestoreTarget(v)}
                        >
                          <Button
                            size="small"
                            type="primary"
                            ghost
                            icon={<RollbackOutlined />}
                          >
                            回滚
                          </Button>
                        </Popconfirm>
                      </Space>
                    </Space>
                    {v.changeSummary && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
                        <strong>变更说明:</strong> {v.changeSummary}
                      </div>
                    )}
                  </Card>
                ),
              }))}
            />
          )}

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <Button size="small" onClick={handleLoadMore} loading={loading} disabled={loading}>
                加载更多
              </Button>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <Collapse items={items} defaultActiveKey={['history']} />

      <Modal
        title={
          <Space>
            <DiffOutlined style={{ color: colors.primary[500] }} />
            版本对比
            {diffVersionA && <Tag>v{diffVersionA.version}</Tag>}
            <span>→</span>
            {diffVersionB && <Tag color="blue">v{diffVersionB.version}</Tag>}
          </Space>
        }
        open={diffModalVisible}
        onCancel={() => setDiffModalVisible(false)}
        width={900}
        footer={null}
      >
        {diffLoading ? (
          <Spin size="large" />
        ) : (
          <div
            style={{
              maxHeight: 500,
              overflow: 'auto',
              border: '1px solid #f0f0f0',
              borderRadius: 4,
            }}
          >
            <SimpleDiffViewer
              oldValue={diffContentA}
              newValue={diffContentB}
              oldLabel={`v${diffVersionA?.version || 'empty'}`}
              newLabel={`v${diffVersionB?.version || 'current'}`}
              showDiffOnly={false}
              maxHeight={500}
            />
          </div>
        )}
      </Modal>

      <Modal
        title={
          <Space>
            <RollbackOutlined style={{ color: '#fa8c16' }} />
            确认回滚
          </Space>
        }
        open={!!restoreTarget}
        onCancel={() => setRestoreTarget(null)}
        onOk={handleRestore}
        confirmLoading={restoring}
        okText="确认回滚"
        cancelText="取消"
      >
        {restoreTarget && (
          <div>
            <p>将回滚到 <strong>版本 v{restoreTarget.version}</strong></p>
            <p style={{ color: '#8c8c8c', fontSize: 12 }}>
              作者: {restoreTarget.createdByName} | 时间: {formatDate(restoreTarget.createdAt)}
            </p>
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
                变更说明（可选）
              </label>
              <Input
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder={`回滚到 v${restoreTarget.version}`}
                allowClear
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default VersionHistoryPanel;
