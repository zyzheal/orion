/**
 * ScriptLibrary Modals & Drawers
 */
import React from 'react';
import {
  Modal,
  Drawer,
  Form,
  Input,
  Select,
  Button,
  Space,
  Tag,
  Table,
  Descriptions,
  Card,
  Title,
  Divider,
  message,
} from 'antd';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import { Typography } from 'antd';
import type {
  ScriptEntry,
  ScriptVersion,
  ScriptParameter,
  ScriptExecution,
  CreateParameterInput,
} from '@/api/script-library';
import {
  scriptTypeLabel,
  scriptTypeColor,
  paramTypeLabel,
  statusColor,
  statusLabel,
  cardStyle,
} from './config';

type FormInstance = ReturnType<typeof Form.useForm>[0];

interface ScriptLibraryModalsProps {
  scripts: ScriptEntry[];
  scriptModalVisible: boolean;
  setScriptModalVisible: (v: boolean) => void;
  scriptConfirmLoading: boolean;
  setScriptConfirmLoading: (v: boolean) => void;
  editingScript: ScriptEntry | null;
  setEditingScript: (v: ScriptEntry | null) => void;
  scriptForm: FormInstance;
  handleSaveScript: () => void;
  drawerVisible: boolean;
  setDrawerVisible: (v: boolean) => void;
  selectedScript: ScriptEntry | null;
  setSelectedScript: (v: ScriptEntry | null) => void;
  versions: ScriptVersion[];
  setVersions: (v: ScriptVersion[]) => void;
  versionsLoading: boolean;
  setVersionsLoading: (v: boolean) => void;
  versionModalVisible: boolean;
  setVersionModalVisible: (v: boolean) => void;
  versionForm: FormInstance;
  handleSaveVersion: () => void;
  handleCreateVersion: () => void;
  handleRollback: (v: number) => void;
  parameters: ScriptParameter[];
  setParametersList: (v: ScriptParameter[]) => void;
  paramsLoading: boolean;
  setParamsLoading: (v: boolean) => void;
  paramModalVisible: boolean;
  setParamModalVisible: (v: boolean) => void;
  paramForm: FormInstance;
  editingParam: ScriptParameter | null;
  setEditingParam: (v: ScriptParameter | null) => void;
  handleSaveParam: () => void;
  handleAddParam: () => void;
  handleEditParam: (p: ScriptParameter) => void;
  handleDeleteParam: (k: string) => void;
  executeModalVisible: boolean;
  setExecuteModalVisible: (v: boolean) => void;
  executingScript: ScriptEntry | null;
  setExecutingScript: (v: ScriptEntry | null) => void;
  executeForm: FormInstance;
  handleOpenExecute: (r: ScriptEntry) => void;
  handleExecute: () => void;
  executions: ScriptExecution[];
  setExecutions: (v: ScriptExecution[]) => void;
  executionsLoading: boolean;
  setExecutionsLoading: (v: boolean) => void;
  execDetailVisible: boolean;
  setExecDetailVisible: (v: boolean) => void;
  selectedExecution: ScriptExecution | null;
  setSelectedExecution: (v: ScriptExecution | null) => void;
}

export const ScriptLibraryModals: React.FC<ScriptLibraryModalsProps> = (props) => (
  <>
      {/* ==================== Create/Edit Script Modal ==================== */}
      <Modal
        title={props.editingScript ? '编辑脚本' : '创建脚本'}
        open={props.scriptModalVisible}
        onOk={props.handleSaveScript}
        confirmLoading={props.scriptConfirmLoading}
        onCancel={() => props.setScriptModalVisible(false)}
        width={600}
      >
        <Form form={props.scriptForm} layout="vertical">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入脚本名称' }]}
          >
            <Input placeholder="输入脚本名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="输入脚本描述" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="scriptType"
                label="脚本类型"
                rules={[{ required: true, message: '请选择脚本类型' }]}
              >
                <Select placeholder="选择脚本类型">
                  {Object.entries(scriptTypeLabel).map(([val, label]) => (
                    <Select.Option key={val} value={val}>
                      {label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="分类">
                <Select placeholder="选择或输入分类" allowClear showSearch>
                  {categoryOptions.map((cat) => (
                    <Select.Option key={cat} value={cat}>
                      {cat}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签后回车" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== Detail Drawer ==================== */}
      <Drawer
        title={props.selectedScript?.name ?? '脚本详情'}
        open={props.drawerVisible}
        onClose={() => props.setDrawerVisible(false)}
        width={700}
      >
        {props.selectedScript && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: spacing.lg }}>
              <Descriptions.Item label="类型">
                <Tag color={scriptTypeColor[props.selectedScript.scriptType]}>
                  {scriptTypeLabel[props.selectedScript.scriptType]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="分类">{props.selectedScript.category ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {props.selectedScript.description ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="标签" span={2}>
                {props.selectedScript.tags?.length ? (
                  <Space size={4} wrap>
                    {props.selectedScript.tags.map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </Space>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={props.selectedScript.enabled ? 'green' : 'default'}>
                  {props.selectedScript.enabled ? '启用' : '禁用'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(props.selectedScript.createdAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            {/* Version History */}
            <div style={{ marginBottom: spacing.lg }}>
              <Row justify="space-between" align="middle" style={{ marginBottom: spacing.sm }}>
                <Title level={4} style={{ margin: 0 }}>
                  版本历史
                </Title>
                <Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    size="small"
                    onClick={props.handleCreateVersion}
                  >
                    新建版本
                  </Button>
                </Space>
              </Row>
              {props.versions.length === 0 ? (
                <Empty description="暂无版本" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Timeline
                  items={props.versions.map((v) => ({
                    color: colors.primary[500],
                    children: (
                      <div>
                        <Space>
                          <Tag color="blue">v{v.version}</Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(v.createdAt).format('YYYY-MM-DD HH:mm')}
                          </Text>
                          <Popconfirm
                            title={`确认回滚到 v${v.version}？`}
                            onConfirm={() => props.handleRollback(v.version)}
                          >
                            <Button type="link" size="small" icon={<RollbackOutlined />}>
                              回滚
                            </Button>
                          </Popconfirm>
                        </Space>
                        {v.changelog && (
                          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                            {v.changelog}
                          </Text>
                        )}
                      </div>
                    ),
                  }))}
                />
              )}
            </div>

            {/* Parameters */}
            <div>
              <Row justify="space-between" align="middle" style={{ marginBottom: spacing.sm }}>
                <Title level={4} style={{ margin: 0 }}>
                  <SettingOutlined style={{ marginRight: 8 }} />
                  参数配置
                </Title>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={props.handleAddParam}
                >
                  添加参数
                </Button>
              </Row>
              {props.parameters.length === 0 ? (
                <Empty description="暂无参数配置" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Table
                  columns={paramColumns}
                  dataSource={props.parameters}
                  rowKey="paramKey"
                  loading={props.paramsLoading}
                  size="small"
                  pagination={false}
                />
              )}
            </div>
          </>
        )}
      </Drawer>

      {/* ==================== Create Version Modal ==================== */}
      <Modal
        title="创建新版本"
        open={props.versionModalVisible}
        onOk={props.handleSaveVersion}
        onCancel={() => props.setVersionModalVisible(false)}
        width={600}
      >
        <Form form={props.versionForm} layout="vertical">
          <Form.Item
            name="content"
            label="脚本内容"
            rules={[{ required: true, message: '请输入脚本内容' }]}
          >
            <TextArea
              rows={12}
              placeholder="输入脚本代码..."
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Form.Item>
          <Form.Item name="changelog" label="变更说明">
            <Input placeholder="描述本次变更内容" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== Parameter Modal ==================== */}
      <Modal
        title={props.editingParam ? '编辑参数' : '添加参数'}
        open={props.paramModalVisible}
        onOk={props.handleSaveParam}
        onCancel={() => props.setParamModalVisible(false)}
        width={500}
      >
        <Form form={props.paramForm} layout="vertical">
          <Form.Item
            name="paramKey"
            label="参数名"
            rules={[{ required: true, message: '请输入参数名' }]}
          >
            <Input placeholder="例如: target_host" disabled={!!props.editingParam} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="paramType"
                label="参数类型"
                rules={[{ required: true, message: '请选择参数类型' }]}
              >
                <Select>
                  {Object.entries(paramTypeLabel).map(([val, label]) => (
                    <Select.Option key={val} value={val}>
                      {label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="required" label="是否必填" valuePropName="checked">
                <Select>
                  <Select.Option value={true}>是</Select.Option>
                  <Select.Option value={false}>否</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="defaultValue" label="默认值">
            <Input placeholder="输入默认值" />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input placeholder="参数用途说明" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== Execute Script Modal ==================== */}
      <Modal
        title={`执行脚本: ${props.executingScript?.name ?? ''}`}
        open={props.executeModalVisible}
        onOk={props.handleExecute}
        onCancel={() => props.setExecuteModalVisible(false)}
        width={600}
        okText="执行"
        okButtonProps={{ icon: <PlayCircleOutlined /> }}
      >
        <Form form={props.executeForm} layout="vertical">
          {props.parameters.length > 0 && (
            <>
              <Title level={5} style={{ marginBottom: spacing.sm }}>
                参数设置
              </Title>
              {props.parameters.map((param) => (
                <Form.Item
                  key={param.paramKey}
                  name={['params', param.paramKey]}
                  label={
                    <Space>
                      <Text code>{param.paramKey}</Text>
                      <Tag style={{ borderRadius: 4 }}>{paramTypeLabel[param.paramType]}</Tag>
                      {param.required && <Tag color="red">必填</Tag>}
                    </Space>
                  }
                  rules={
                    param.required
                      ? [{ required: true, message: `请输入 ${param.paramKey}` }]
                      : undefined
                  }
                  extra={param.description}
                >
                  {param.paramType === 'number' ? (
                    <InputNumber style={{ width: '100%' }} placeholder="输入数字" />
                  ) : param.paramType === 'boolean' ? (
                    <Select placeholder="选择">
                      <Select.Option value="true">true</Select.Option>
                      <Select.Option value="false">false</Select.Option>
                    </Select>
                  ) : param.paramType === 'secret' ? (
                    <Input.Password placeholder="输入密钥值" />
                  ) : (
                    <Input placeholder={`输入 ${param.paramKey}`} />
                  )}
                </Form.Item>
              ))}
            </>
          )}
          <Form.Item name="targets" label="执行目标" extra="可选，指定执行主机或目标">
            <Input placeholder="例如: 192.168.1.10 或 host-group-name" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== Execution Detail Drawer ==================== */}
      <Drawer
        title="执行详情"
        open={props.execDetailVisible}
        onClose={() => props.setExecDetailVisible(false)}
        width={500}
      >
        {props.selectedExecution && (
          <>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: spacing.md }}>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[props.selectedExecution.status]}>
                  {statusLabel[props.selectedExecution.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="版本">v{props.selectedExecution.version}</Descriptions.Item>
              <Descriptions.Item label="执行者">
                {props.selectedExecution.executedBy ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="耗时">
                {props.selectedExecution.durationMs != null ? `${props.selectedExecution.durationMs}ms` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="执行时间">
                {dayjs(props.selectedExecution.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>

            {props.selectedExecution.params && Object.keys(props.selectedExecution.params).length > 0 && (
              <div style={{ marginBottom: spacing.md }}>
                <Title level={5}>执行参数</Title>
                <Card size="small" style={{ background: colors.neutral[50] }}>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      fontSize: 12,
                    }}
                  >
                    {JSON.stringify(props.selectedExecution.params, null, 2)}
                  </pre>
                </Card>
              </div>
            )}

            {props.selectedExecution.output && (
              <div style={{ marginBottom: spacing.md }}>
                <Title level={5}>输出</Title>
                <Card size="small" style={{ background: colors.neutral[50] }}>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      maxHeight: 300,
                      overflow: 'auto',
                    }}
                  >
                    {props.selectedExecution.output}
                  </pre>
                </Card>
              </div>
            )}

            {props.selectedExecution.error && (
              <div>
                <Title level={5} style={{ color: colors.error[500] }}>
                  错误信息
                </Title>
                <Card size="small" style={{ background: colors.error[50] }}>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: colors.error[600],
                    }}
                  >
                    {props.selectedExecution.error}
                  </pre>
                </Card>
              </div>
            )}
          </>
        )}
      </Drawer>
  </>
);
