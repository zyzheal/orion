/**
 * DetailModal - CI 类型详情弹窗 (含 Tabs)
 * 抽取自 index.tsx (P2-9 Phase 106)
 */
import React, { useMemo } from 'react';
import { Modal, Descriptions, Tag, Space, Button, Table, Empty, Tabs } from 'antd';
import { PlusOutlined, HistoryOutlined } from '@ant-design/icons';
import { STATUS_COLORS } from '../constants';
import { buildAttributeColumns, buildVersionColumns } from '../columns';
import type { CITypeDesignerState } from '../useCITypeDesignerState';

interface DetailModalProps {
  state: CITypeDesignerState;
}

export const DetailModal: React.FC<DetailModalProps> = ({ state }) => {
  const attrColumns = useMemo(() => buildAttributeColumns(), []);
  const versionColumns = useMemo(
    () => buildVersionColumns({ handleRollback: state.handleRollback }),
    [state.handleRollback]
  );

  const items = useMemo(() => {
    if (!state.selectedType) return [];
    return [
      {
        key: 'attributes',
        label: '属性',
        children: (
          <div>
            <Space style={{ marginBottom: 12 }}>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => {
                  state.attrForm.resetFields();
                  state.setAttrModalOpen(true);
                }}
              >
                管理属性
              </Button>
            </Space>
            <Table
              columns={attrColumns}
              dataSource={state.attributes}
              rowKey="id"
              pagination={false}
              locale={{ emptyText: <Empty description="暂无属性定义" /> }}
            />
          </div>
        ),
      },
      {
        key: 'versions',
        label: '版本快照',
        children: (
          <div>
            <Space style={{ marginBottom: 12 }}>
              <Button
                type="primary"
                size="small"
                icon={<HistoryOutlined />}
                onClick={state.handleCreateVersion}
              >
                创建版本快照
              </Button>
            </Space>
            <Table
              columns={versionColumns}
              dataSource={state.versions}
              rowKey="id"
              pagination={false}
              locale={{ emptyText: <Empty description="暂无版本快照" /> }}
            />
          </div>
        ),
      },
    ];
  }, [
    state.selectedType,
    state.attributes,
    state.versions,
    state.attrForm,
    state.setAttrModalOpen,
    state.handleCreateVersion,
    attrColumns,
    versionColumns,
  ]);

  return (
    <Modal
      title={state.selectedType ? state.selectedType.name : 'CI 类型详情'}
      open={state.detailOpen}
      onCancel={() => state.setDetailOpen(false)}
      footer={null}
      width={800}
      destroyOnClose
    >
      {state.selectedType && (
        <>
          <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="名称">{state.selectedType.name}</Descriptions.Item>
            <Descriptions.Item label="显示名称">
              {state.selectedType.displayName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="分类">{state.selectedType.category || '-'}</Descriptions.Item>
            <Descriptions.Item label="版本">{state.selectedType.version}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={STATUS_COLORS[state.selectedType.status] || 'default'}>
                {state.selectedType.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="启用">
              {state.selectedType.enabled ? '是' : '否'}
            </Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {state.selectedType.description || '-'}
            </Descriptions.Item>
          </Descriptions>

          <Tabs activeKey={state.detailTab} onChange={state.setDetailTab} items={items} />
        </>
      )}
    </Modal>
  );
};
