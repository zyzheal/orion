/**
 * DetailDrawer - 审计日志详情抽屉
 * 抽取自 index.tsx (P2-9 Phase 208)
 */
import { Drawer, Descriptions, Typography } from 'antd';
import type { AuditLogEntry } from '@/api/audit';
import dayjs from 'dayjs';

const { Text } = Typography;

interface Props {
  open: boolean;
  selectedLog: AuditLogEntry | null;
  onClose: () => void;
}

export const DetailDrawer = ({ open, selectedLog, onClose }: Props) => (
  <Drawer
    title="审计日志详情"
    placement="right"
    width={700}
    open={open}
    onClose={onClose}
  >
    {selectedLog && (
      <Descriptions column={1} bordered>
        <Descriptions.Item label="ID">{selectedLog.id}</Descriptions.Item>
        <Descriptions.Item label="序列号">{selectedLog.sequenceNumber}</Descriptions.Item>
        <Descriptions.Item label="操作">{selectedLog.action}</Descriptions.Item>
        <Descriptions.Item label="用户 ID">{selectedLog.userId}</Descriptions.Item>
        <Descriptions.Item label="租户 ID">{selectedLog.tenantId || '-'}</Descriptions.Item>
        <Descriptions.Item label="资源类型">
          {selectedLog.resourceType || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="资源 ID">
          {selectedLog.resourceId || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="IP 地址">
          {selectedLog.ipAddress || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="时间戳">
          {dayjs(selectedLog.timestamp).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
        <Descriptions.Item label="内容 Hash">
          <Text code copyable>
            {selectedLog.contentHash}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="链 Hash">
          <Text code copyable>
            {selectedLog.chainHash}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="前 Hash">
          <Text code copyable>
            {selectedLog.prevHash}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="签名">
          {selectedLog.signature || '未签名'}
        </Descriptions.Item>
        <Descriptions.Item label="详情">
          <pre style={{ maxHeight: 200, overflow: 'auto' }}>
            {JSON.stringify(selectedLog.details, null, 2)}
          </pre>
        </Descriptions.Item>
      </Descriptions>
    )}
  </Drawer>
);
