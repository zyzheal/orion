/**
 * CITypeDesigner — CI 类型设计器
 * 对接后端 /api/v1/ci-types 完整 CRUD
 * 含属性管理、版本快照、实例验证
 *
 * 主入口 (P2-9 Phase 106 refactor: 已抽取 TypeFormModal / DetailModal
 * AttributeManagementModal / useCITypeDesignerState)
 */
import React, { useMemo } from 'react';
import { Typography, Card, Table, Button, Space, Empty } from 'antd';
import { BuildOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';
import { useCITypeDesignerState } from './useCITypeDesignerState';
import { buildCITypeColumns } from './columns';
import { TypeFormModal } from './Components/TypeFormModal';
import { DetailModal } from './Components/DetailModal';
import { AttributeManagementModal } from './Components/AttributeManagementModal';

const { Title, Text } = Typography;

const CITypeDesignerPage: React.FC = () => {
  const state = useCITypeDesignerState();

  const columns = useMemo(
    () =>
      buildCITypeColumns({
        handleViewDetail: state.handleViewDetail,
        handleEdit: state.handleEdit,
        handleDelete: state.handleDelete,
      }),
    [state.handleViewDetail, state.handleEdit, state.handleDelete]
  );

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <BuildOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        CI 类型设计器
      </Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        可视化设计 CI 类型属性与关系,管理版本快照和实例验证
      </Text>

      <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={state.handleCreate}>
            新建 CI 类型
          </Button>
          <Button icon={<ReloadOutlined />} onClick={state.loadTypes} loading={state.loading}>
            刷新
          </Button>
        </Space>
        <Table
          columns={columns}
          dataSource={state.types}
          rowKey="id"
          loading={state.loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 项`,
          }}
          locale={{ emptyText: <Empty description="暂无 CI 类型数据" /> }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 创建/编辑 Modal */}
      <TypeFormModal state={state} />

      {/* 详情 Modal */}
      <DetailModal state={state} />

      {/* 属性管理 Modal */}
      <AttributeManagementModal state={state} />
    </div>
  );
};

export default CITypeDesignerPage;
