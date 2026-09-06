/**
 * AlertDetailModal.tsx - 告警详情 Modal (含 AI 解释)
 * 抽取自 AlertList/index.tsx (P2-9 Phase 53)
 * 详情面板 + 4 组信息卡 + AI 解释 (TR-01)
 */
import React from 'react';
import {
  Modal,
  Button,
  Space,
  Tag,
  Spin,
  Alert as AntAlert,
  Typography,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Alert } from '@/types/pages';
import type { AlertExplanation } from '@/api/alerts';
import { colors, spacing } from '@/tokens';
import { severityConfig, statusConfig } from './useAlertListState';

const { Text } = Typography;

interface AlertDetailModalProps {
  detailModalVisible: boolean;
  setDetailModalVisible: (v: boolean) => void;
  selectedAlert: Alert | null;
  explaining: boolean;
  explanation: AlertExplanation | null;
  handleAcknowledge: (alertId: string) => void;
  handleResolve: (alertId: string) => void;
  handleExplain: (alertId: string) => void;
}

export const AlertDetailModal: React.FC<AlertDetailModalProps> = (props) => {
  const {
    detailModalVisible,
    setDetailModalVisible,
    selectedAlert,
    explaining,
    explanation,
    handleAcknowledge,
    handleResolve,
    handleExplain,
  } = props;

  return (
    <Modal
      title="告警详情"
      open={detailModalVisible}
      onCancel={() => setDetailModalVisible(false)}
      footer={[
        selectedAlert && selectedAlert.status === 'active' && (
          <Button
            key="acknowledge"
            icon={<CheckOutlined />}
            onClick={() => {
              handleAcknowledge(selectedAlert.id);
              setDetailModalVisible(false);
            }}
          >
            确认告警
          </Button>
        ),
        selectedAlert &&
          (selectedAlert.status === 'active' || selectedAlert.status === 'acknowledged') && (
            <Button
              key="resolve"
              type="primary"
              danger
              icon={<CloseOutlined />}
              onClick={() => {
                handleResolve(selectedAlert.id);
                setDetailModalVisible(false);
              }}
            >
              解决告警
            </Button>
          ),
        <Button key="close" onClick={() => setDetailModalVisible(false)}>
          关闭
        </Button>,
      ]}
      width={680}
    >
      {selectedAlert && (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          {/* Alert header */}
          <div
            style={
              {
                display: 'flex',
                alignItems: 'center',
                gap: spacing[3],
                padding: '12px 16px',
                background:
                  selectedAlert.severity === 'critical'
                    ? 'rgba(245, 34, 45, 0.06)'
                    : selectedAlert.severity === 'warning'
                      ? 'rgba(250, 140, 22, 0.06)'
                      : 'rgba(24, 144, 255, 0.06)',
                borderRadius: 6,
              } as React.CSSProperties
            }
          >
            <Tag
              color={severityConfig[selectedAlert.severity].color}
              style={{ fontWeight: 600 }}
            >
              {severityConfig[selectedAlert.severity].icon}{' '}
              {severityConfig[selectedAlert.severity].label}
            </Tag>
            <Tag color={statusConfig[selectedAlert.status].color}>
              {statusConfig[selectedAlert.status].label}
            </Tag>
          </div>

          {/* Detail info */}
          <div>
            <Text type="secondary" style={{ fontSize: spacing[3] }}>
              指标名称
            </Text>
            <div>
              <Text strong style={{ fontSize: spacing[4] }}>
                {selectedAlert.metric}
              </Text>
            </div>
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: spacing[3] }}>
              告警消息
            </Text>
            <div>
              <Text>{selectedAlert.message}</Text>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 32 }}>
            <div>
              <Text type="secondary" style={{ fontSize: spacing[3] }}>
                当前值
              </Text>
              <div>
                <Text strong style={{ color: colors.error[600], fontSize: spacing[5] }}>
                  {selectedAlert.value}
                </Text>
              </div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: spacing[3] }}>
                阈值
              </Text>
              <div>
                <Text>{selectedAlert.threshold}</Text>
              </div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: spacing[3] }}>
                来源
              </Text>
              <div>
                <Text code>{selectedAlert.source}</Text>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 32 }}>
            <div>
              <Text type="secondary" style={{ fontSize: spacing[3] }}>
                首次触发
              </Text>
              <div>
                <Text style={
                  { fontSize: spacing[3] } as React.CSSProperties
                }>
                  {dayjs(selectedAlert.firstTriggered).format('YYYY-MM-DD HH:mm:ss')}
                </Text>
              </div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: spacing[3] }}>
                最后更新
              </Text>
              <div>
                <Text style={
                  { fontSize: spacing[3] } as React.CSSProperties
                }>
                  {dayjs(selectedAlert.lastUpdated).format('YYYY-MM-DD HH:mm:ss')}
                </Text>
              </div>
            </div>
          </div>

          {selectedAlert.acknowledgedBy && (
            <div>
              <Text type="secondary" style={{ fontSize: spacing[3] }}>
                确认信息
              </Text>
              <div>
                <Text>
                  由 <Text code>{selectedAlert.acknowledgedBy}</Text> 于{' '}
                  {dayjs(selectedAlert.acknowledgedAt).format('YYYY-MM-DD HH:mm:ss')} 确认
                </Text>
              </div>
            </div>
          )}

          {selectedAlert.resolvedBy && (
            <div>
              <Text type="secondary" style={{ fontSize: spacing[3] }}>
                解决信息
              </Text>
              <div>
                <Text>
                  由 <Text code>{selectedAlert.resolvedBy}</Text> 于{' '}
                  {dayjs(selectedAlert.resolvedAt).format('YYYY-MM-DD HH:mm:ss')} 解决
                </Text>
              </div>
            </div>
          )}

          {/* AI explanation panel (TR-01) */}
          <div
            style={
              {
                borderTop: `1px solid ${colors.neutral[200]}`,
                paddingTop: spacing.md,
              } as React.CSSProperties
            }
          >
            <div
              style={
                {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: spacing.sm,
                } as React.CSSProperties
              }
            >
              <Text strong style={
                { fontSize: spacing[3] } as React.CSSProperties
              }>
                <BulbOutlined style={{ color: colors.primary[500], marginRight: 6 }} />
                AI 解释
              </Text>
              <Button
                size="small"
                loading={explaining}
                onClick={() => handleExplain(selectedAlert.id)}
              >
                {explanation ? '重新解释' : '生成解释'}
              </Button>
            </div>
            {explaining && (
              <div style={
                { textAlign: 'center', padding: '16px 0' } as React.CSSProperties
              }>
                <Spin size="small" />
              </div>
            )}
            {!explaining && !explanation && (
              <Text type="secondary" style={
                { fontSize: spacing[3] } as React.CSSProperties
              }>
                点击"生成解释"获取该告警的 AI 分析结论与建议动作。
              </Text>
            )}
            {!explaining && explanation && (
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                <AntAlert
                  type="info"
                  showIcon
                  message={explanation.summary}
                  description={explanation.likelyCause}
                />
                {explanation.relation && explanation.relation !== 'standalone' && (
                  <Tag color={explanation.relation === 'suppressed' ? 'green' : 'orange'}>
                    关系：{explanation.relation === 'suppressed' ? '已抑制' : '重复告警'}
                  </Tag>
                )}
                {explanation.evidence && explanation.evidence.length > 0 && (
                  <div>
                    <Text type="secondary" style={
                      { fontSize: spacing[3] } as React.CSSProperties
                    }>
                      证据链
                    </Text>
                    <ul style={
                      { margin: '4px 0 0 0', paddingLeft: 18 } as React.CSSProperties
                    }>
                      {explanation.evidence.map((ev, idx) => (
                        <li key={String(idx)}>
                          <Text style={
                            { fontSize: spacing[3] } as React.CSSProperties
                          }>{ev}</Text>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {explanation.suggestions && explanation.suggestions.length > 0 && (
                  <div>
                    <Text type="secondary" style={
                      { fontSize: spacing[3] } as React.CSSProperties
                    }>
                      建议动作
                    </Text>
                    <ul style={
                      { margin: '4px 0 0 0', paddingLeft: 18 } as React.CSSProperties
                    }>
                      {explanation.suggestions.map((s, idx) => (
                        <li key={String(idx)}>
                          <Text style={
                            { fontSize: spacing[3] } as React.CSSProperties
                          }>
                            {s.title}
                            {s.description ? ` — ${s.description}` : ''}
                          </Text>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Space>
            )}
          </div>
        </Space>
      )}
    </Modal>
  );
};
