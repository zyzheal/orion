/**
 * OrdersTab.tsx - SQL工单 Tab（统计卡 + 筛选 + 表格 + 新建Modal）
 * 抽取自 DbaPage.tsx (P2-9 Phase 42)
 */
import React, { useState, useMemo } from 'react';
import {
  Button,
  Space,
  Select,
  message,
  Modal,
  Form,
  Input,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import Table from '@/components/Table';
import {
  getOrder,
  createOrder,
  approveOrder,
  rejectOrder,
  executeOrder,
  type SqlOrder,
  type CreateOrderInput,
} from '@/api/dba';
import { spacing } from '@/tokens';
import { orderStatusOptions, sqlTypeOptions } from './constants';
import { OrderStatsCards } from './OrderStatsCards';
import { buildOrderColumns } from './OrderColumns';

export interface OrdersTabProps {
  orders: SqlOrder[];
  orderLoading: boolean;
  loadOrders: () => Promise<void> | void;
}

const OrdersTab: React.FC<OrdersTabProps> = ({ orders, orderLoading, loadOrders }) => {
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [orderForm] = Form.useForm();
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  const handleCreateOrder = async () => {
    try {
      const values = await orderForm.validateFields();
      setOrderSubmitting(true);
      const payload: CreateOrderInput = {
        database: values.database,
        sql: values.sql,
        comment: values.comment,
        type: values.type || 'query',
      };
      await createOrder(payload);
      message.success('SQL工单创建成功');
      setOrderModalVisible(false);
      orderForm.resetFields();
      loadOrders();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    } finally {
      setOrderSubmitting(false);
    }
  };

  const handleApproveOrder = async (id: string) => {
    try {
      await approveOrder(id);
      message.success('工单已审批通过');
      loadOrders();
    } catch (error: unknown) {
      message.error(`审批失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleRejectOrder = async (id: string) => {
    try {
      await rejectOrder(id, '工单被拒绝');
      message.success('工单已拒绝');
      loadOrders();
    } catch (error: unknown) {
      message.error(`拒绝失败: ${(error as Error).message}`);
    }
  };

  const handleExecuteOrder = async (id: string) => {
    try {
      await executeOrder(id);
      message.success('工单已开始执行');
      loadOrders();
    } catch (error: unknown) {
      message.error(`执行失败: ${(error as Error).message}`);
    }
  };

  const handleViewOrder = (id: string) => {
    getOrder(id);
  };

  const filteredOrders =
    orderStatusFilter === 'all' ? orders : orders.filter((o) => o.status === orderStatusFilter);

  const orderColumns = useMemo(
    () =>
      buildOrderColumns({
        onApprove: handleApproveOrder,
        onReject: handleRejectOrder,
        onExecute: handleExecuteOrder,
        onView: handleViewOrder,
      }),
    []
  );

  return (
    <div>
      <OrderStatsCards orders={orders} />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Space>
          <Select
            style={{ width: 140 }}
            value={orderStatusFilter}
            onChange={(v) => setOrderStatusFilter(v)}
            options={orderStatusOptions}
          />
          <Button icon={<ReloadOutlined />} onClick={() => loadOrders()} loading={orderLoading}>
            刷新
          </Button>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOrderModalVisible(true)}>
          新建工单
        </Button>
      </div>

      <Table
        columns={orderColumns}
        dataSource={filteredOrders}
        loading={orderLoading}
        rowKey="id"
        size="middle"
        striped
        locale={{
          emptyText: (
            <Empty description="暂无SQL工单">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setOrderModalVisible(true)}>
                新建工单
              </Button>
            </Empty>
          ),
        }}
      />

      <Modal
        title="新建SQL工单"
        open={orderModalVisible}
        onCancel={() => setOrderModalVisible(false)}
        onOk={handleCreateOrder}
        confirmLoading={orderSubmitting}
        width={600}
        destroyOnClose
      >
        <Form form={orderForm} layout="vertical">
          <Form.Item
            name="database"
            label="目标数据库"
            rules={[{ required: true, message: '请输入目标数据库' }]}
          >
            <Input placeholder="如: production_db" />
          </Form.Item>
          <Form.Item
            name="sql"
            label="SQL语句"
            rules={[{ required: true, message: '请输入SQL语句' }]}
          >
            <Input.TextArea rows={6} placeholder="SELECT * FROM users LIMIT 10;" />
          </Form.Item>
          <Form.Item
            name="type"
            label="SQL类型"
            rules={[{ required: true, message: '请选择SQL类型' }]}
            initialValue="query"
          >
            <Select options={sqlTypeOptions} />
          </Form.Item>
          <Form.Item name="comment" label="备注说明">
            <Input.TextArea rows={2} placeholder="说明执行该SQL的原因..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OrdersTab;
