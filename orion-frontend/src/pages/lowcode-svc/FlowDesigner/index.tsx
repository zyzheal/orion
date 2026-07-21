/**
 * FlowDesigner - 低代码流程设计器页面
 *
 * 功能：流程列表展示、新建流程、执行流程、查看流程详情
 * API: /api/v1/lowcode/flows
 */

import { useState, useEffect } from 'react';
import { Button, Card, Form, Input, Select, Space, message, Modal, Descriptions, Empty, Typography } from 'antd';
import { PlusOutlined, PlayCircleOutlined, SaveOutlined, EyeOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import { lowcodeApi, type LowcodeFlow } from '@/api/lowcode';

export default function FlowDesigner() {
  const [flows, setFlows] = useState<LowcodeFlow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<LowcodeFlow | null>(null);
  const [loading, setLoading] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [executeVisible, setExecuteVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = async () => {
    setLoading(true);
    try {
      const result = await lowcodeApi.listFlows();
      setFlows(result.flows || []);
    } catch (e: any) {
      message.error(e?.message || '加载流程列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: { name: string; description?: string; type?: string }) => {
    try {
      await lowcodeApi.createFlow({
        name: values.name,
        description: values.description,
        type: values.type,
      });
      message.success('流程创建成功');
      setCreateVisible(false);
      form.resetFields();
      loadFlows();
    } catch (e: any) {
      message.error(e?.message || '创建失败');
    }
  };

  const handleExecute = async (values: { input?: string }) => {
    if (!selectedFlow) return;
    try {
      let input: Record<string, unknown> = {};
      if (values.input && values.input.trim()) {
        try {
          input = JSON.parse(values.input);
        } catch {
          message.error('输入参数 JSON 格式错误');
          return;
        }
      }
      const result = await lowcodeApi.executeFlow(selectedFlow.id, input);
      message.success(`流程执行成功，实例ID: ${(result.result as Record<string, unknown>).instanceId}`);
      setExecuteVisible(false);
    } catch (e: any) {
      message.error(e?.message || '执行失败');
    }
  };

  const handleDelete = async (flow: LowcodeFlow) => {
    try {
      await lowcodeApi.deleteFlow(flow.id);
      message.success('流程删除成功');
      loadFlows();
    } catch (e: any) {
      message.error(e?.message || '删除失败');
    }
  };

  const handlePublish = async (flow: LowcodeFlow) => {
    try {
      await lowcodeApi.publishFlow(flow.id);
      message.success(`流程已发布 (${flow.version})`);
      loadFlows();
    } catch (e: any) {
      message.error(e?.message || '发布失败');
    }
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <Typography.Title level={2} style={{ marginBottom: spacing.md }}>
        <PlayCircleOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        流程设计器
      </Typography.Title>

      <Card>
        <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'space-between' }}>
          <Input.Search
            placeholder="搜索流程..."
            style={{ width: 300 }}
            onSearch={loadFlows}
            disabled={loading}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
            新建流程
          </Button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: colors.neutral[500] }}>
            加载中...
          </div>
        ) : flows.length === 0 ? (
          <Empty description="暂无流程，点击右上角新建流程">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
              新建流程
            </Button>
          </Empty>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: spacing.md }}>
            {flows.map((flow) => (
              <Card
                key={flow.id}
                hoverable
                size="small"
                style={{ borderRadius: 8 }}
                title={flow.name}
                extra={
                  <Space>
                    <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelectedFlow(flow); setDetailVisible(true); }}>
                      查看
                    </Button>
                    <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => { setSelectedFlow(flow); setExecuteVisible(true); }}>
                      执行
                    </Button>
                  </Space>
                }
                actions={[
                  <Button type="link" size="small" onClick={() => handlePublish(flow)}>
                    发布
                  </Button>,
                  <Button type="link" size="small" danger onClick={() => handleDelete(flow)}>
                    删除
                  </Button>,
                ]}
              >
                <p style={{ color: colors.neutral[500], fontSize: 14 }}>{flow.description || '无描述'}</p>
                <p style={{ fontSize: 12, color: colors.neutral[400] }}>
                  节点数: {flow.nodeCount || 0} | 版本: {flow.version} | 状态: {flow.status}
                </p>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Create Flow Modal */}
      <Modal
        title="新建流程"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="流程名称" rules={[{ required: true, message: '请输入流程名称' }]}>
            <Input placeholder="输入流程名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="流程描述" rows={3} />
          </Form.Item>
          <Form.Item name="type" label="流程类型" initialValue="sequential">
            <Select>
              <Select.Option value="sequential">顺序执行</Select.Option>
              <Select.Option value="parallel">并行执行</Select.Option>
              <Select.Option value="conditional">条件分支</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block icon={<SaveOutlined />}>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Execute Flow Modal */}
      <Modal
        title={`执行流程: ${selectedFlow?.name}`}
        open={executeVisible}
        onCancel={() => setExecuteVisible(false)}
        footer={null}
      >
        <Form layout="vertical" onFinish={handleExecute}>
          <Form.Item name="input" label="输入参数 (JSON)">
            <Input.TextArea placeholder='{"key": "value"}' rows={4} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block icon={<PlayCircleOutlined />}>
              执行
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Flow Detail Modal */}
      <Modal
        title={`流程详情: ${selectedFlow?.name}`}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
          <Button key="execute" type="primary" icon={<PlayCircleOutlined />} onClick={() => { setDetailVisible(false); setExecuteVisible(true); }}>
            执行流程
          </Button>,
        ]}
        width={700}
      >
        {selectedFlow && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="流程ID">{selectedFlow.id}</Descriptions.Item>
            <Descriptions.Item label="流程名称">{selectedFlow.name}</Descriptions.Item>
            <Descriptions.Item label="描述">{selectedFlow.description || '无'}</Descriptions.Item>
            <Descriptions.Item label="版本">{selectedFlow.version}</Descriptions.Item>
            <Descriptions.Item label="状态">{selectedFlow.status}</Descriptions.Item>
            <Descriptions.Item label="节点数">{selectedFlow.nodeCount || 0}</Descriptions.Item>
            <Descriptions.Item label="创建人">{selectedFlow.createdBy || 'system'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{selectedFlow.createdAt}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{selectedFlow.updatedAt}</Descriptions.Item>
            <Descriptions.Item label="节点定义">
              <pre style={{ maxHeight: 200, overflow: 'auto', background: colors.light.bg.tertiary, padding: 8, borderRadius: 4 }}>
                {JSON.stringify(selectedFlow.nodes, null, 2)}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label="连线定义">
              <pre style={{ maxHeight: 200, overflow: 'auto', background: colors.light.bg.tertiary, padding: 8, borderRadius: 4 }}>
                {JSON.stringify(selectedFlow.edges, null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
