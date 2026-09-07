/**
 * RetryRollbackModals - 重试/回滚/取消 Modal
 * 抽取自 PipelineRetryRollback.tsx (P2-9 Phase 111)
 */
import React from 'react';
import { Modal, Space, Typography, Form, Select } from 'antd';
import {
  ReloadOutlined,
  RollbackOutlined,
  StopOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import { mockRuns } from '../runRetryConstants';
import type { PipelineRetryRollbackState } from '../usePipelineRetryRollbackState';

const { Text } = Typography;
const { Option } = Select;

interface RetryRollbackModalsProps {
  state: PipelineRetryRollbackState;
}

export const RetryRollbackModals: React.FC<RetryRollbackModalsProps> = ({ state }) => {
  const {
    selectedRun,
    retryModalVisible,
    setRetryModalVisible,
    rollbackModalVisible,
    setRollbackModalVisible,
    cancelModalVisible,
    setCancelModalVisible,
    retryStage,
    setRetryStage,
    rollbackTargetRunId,
    setRollbackTargetRunId,
    retryLoading,
    rollbackLoading,
    cancelLoading,
    getFailedStages,
    handleRetryConfirm,
    handleRollbackConfirm,
    handleCancelConfirm,
  } = state;

  return (
    <>
      {/* ===== 重试 Modal ===== */}
      <Modal
        title={
          <Space>
            <ReloadOutlined style={{ color: colors.warning[500] }} />
            确认重试 Pipeline Run
          </Space>
        }
        open={retryModalVisible}
        onCancel={() => setRetryModalVisible(false)}
        destroyOnClose
        maskClosable={false}
        okText="确认重试"
        cancelText="取消"
        okButtonProps={{
          loading: retryLoading,
          icon: <ReloadOutlined />,
          style: { color: colors.warning[500] },
        }}
        onOk={handleRetryConfirm}
        confirmLoading={retryLoading}
      >
        <Space direction="vertical" size={spacing.md} style={{ width: '100%' }}>
          <div>
            <Text type="secondary">Pipeline：</Text>
            <Text strong>{selectedRun?.pipelineName}</Text>
          </div>
          <div>
            <Text type="secondary">Run ID：</Text>
            <Text code>{selectedRun?.id}</Text>
          </div>

          {selectedRun && getFailedStages(selectedRun).length > 0 && (
            <>
              <Form.Item
                label="选择重试阶段"
                name="retryStage"
                tooltip="选择从头开始还是从失败阶段开始"
                required
              >
                <Select
                  value={retryStage}
                  onChange={setRetryStage}
                  placeholder="请选择重试阶段"
                  style={{ width: '100%' }}
                >
                  <Option value="all">从头开始（全部阶段）</Option>
                  {getFailedStages(selectedRun).map((stage) => (
                    <Option key={stage.name} value={stage.name}>
                      从 "{stage.name}" 阶段开始（跳过已成功阶段）
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <div
                style={{
                  background: colors.warning[50],
                  border: `1px solid ${colors.warning[200]}`,
                  borderRadius: 4,
                  padding: spacing.sm,
                }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <ExclamationCircleOutlined
                    style={{ marginRight: 4, color: colors.warning[500] }}
                  />
                  以下阶段将重新执行：
                  {retryStage === 'all' ? ' 全部阶段' : ` "${retryStage}"`}
                </Text>
              </div>
            </>
          )}

          {selectedRun && getFailedStages(selectedRun).length === 0 && (
            <div
              style={{
                background: colors.info[50],
                border: `1px solid ${colors.info[200]}`,
                borderRadius: 4,
                padding: spacing.sm,
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                <InfoCircleOutlined style={{ marginRight: 4, color: colors.info[500] }} />
                该 Run
                已完成，将使用相同的配置从头重新执行。
              </Text>
            </div>
          )}
        </Space>
      </Modal>

      {/* ===== 回滚 Modal ===== */}
      <Modal
        title={
          <Space>
            <RollbackOutlined style={{ color: colors.error[500] }} />
            确认回滚 Pipeline
          </Space>
        }
        open={rollbackModalVisible}
        onCancel={() => setRollbackModalVisible(false)}
        destroyOnClose
        maskClosable={false}
        okText="确认回滚"
        cancelText="取消"
        okButtonProps={{
          loading: rollbackLoading,
          danger: true,
          icon: <RollbackOutlined />,
        }}
        onOk={handleRollbackConfirm}
        confirmLoading={rollbackLoading}
      >
        <Space direction="vertical" size={spacing.md} style={{ width: '100%' }}>
          <div>
            <Text type="secondary">当前 Pipeline：</Text>
            <Text strong>{selectedRun?.pipelineName}</Text>
          </div>
          <div>
            <Text type="secondary">当前 Run：</Text>
            <Text code>{selectedRun?.id}</Text>
          </div>

          <Form.Item
            label="目标版本 Run ID"
            name="targetRunId"
            tooltip="选择要回滚到的历史 Run"
            required
          >
            <Select
              value={rollbackTargetRunId}
              onChange={setRollbackTargetRunId}
              placeholder="请选择要回滚到的历史 Run"
              style={{ width: '100%' }}
              allowClear
            >
              {mockRuns
                .filter(
                  (r) => r.pipelineName === selectedRun?.pipelineName && r.status === 'success'
                )
                .map((r) => (
                  <Option key={r.id} value={r.id}>
                    {r.pipelineName} #{r.runNumber} ({dayjs(r.startTime).format('MM-DD HH:mm')})
                  </Option>
                ))}
            </Select>
          </Form.Item>

          {rollbackTargetRunId && (
            <div
              style={{
                background: colors.error[50],
                border: `1px solid ${colors.error[200]}`,
                borderRadius: 4,
                padding: spacing.sm,
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                <ExclamationCircleOutlined
                  style={{ marginRight: 4, color: colors.error[500] }}
                />
                回滚将把 Pipeline 恢复到选中 Run 的版本状态，此操作不可逆。
              </Text>
            </div>
          )}

          <div
            style={{
              background: colors.warning[50],
              border: `1px solid ${colors.warning[200]}`,
              borderRadius: 4,
              padding: spacing.sm,
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              <InfoCircleOutlined style={{ marginRight: 4, color: colors.warning[500] }} />
              回滚操作会自动创建一条新的 Run 记录，原始数据不会被覆盖。
            </Text>
          </div>
        </Space>
      </Modal>

      {/* ===== 取消 Modal ===== */}
      <Modal
        title={
          <Space>
            <StopOutlined style={{ color: colors.error[500] }} />
            确认取消 Pipeline Run
          </Space>
        }
        open={cancelModalVisible}
        onCancel={() => setCancelModalVisible(false)}
        destroyOnClose
        maskClosable={false}
        okText="确认取消"
        cancelText="继续运行"
        okButtonProps={{
          loading: cancelLoading,
          danger: true,
          icon: <StopOutlined />,
        }}
        onOk={handleCancelConfirm}
        confirmLoading={cancelLoading}
      >
        <Space direction="vertical" size={spacing.sm} style={{ width: '100%' }}>
          <div>
            <Text type="secondary">Pipeline：</Text>
            <Text strong>{selectedRun?.pipelineName}</Text>
          </div>
          <div>
            <Text type="secondary">Run ID：</Text>
            <Text code>{selectedRun?.id}</Text>
          </div>
          <div
            style={{
              background: colors.error[50],
              border: `1px solid ${colors.error[200]}`,
              borderRadius: 4,
              padding: spacing.sm,
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ExclamationCircleOutlined
                style={{ marginRight: 4, color: colors.error[500] }}
              />
              取消后将无法恢复，当前正在执行的阶段将立即终止。
            </Text>
          </div>
        </Space>
      </Modal>
    </>
  );
};
