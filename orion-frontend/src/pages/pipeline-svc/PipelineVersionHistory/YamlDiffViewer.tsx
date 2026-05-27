/**
 * YAML Diff 可视化对比组件
 *
 * 双栏行级 Diff 视图，支持新增/删除/修改行高亮。
 * 使用 Design Token 规范的色彩和间距系统。
 */
import React, { useMemo } from 'react';
import { Modal, Space, Tag } from 'antd';
import { spacing, colors, componentRadius } from '@/tokens';
import { diffLines, type Change } from 'diff';

interface YamlDiffViewerProps {
  yamlA: string;
  yamlB: string;
  versionA: string;
  versionB: string;
  visible: boolean;
  onClose: () => void;
}

const lineNumWidth = 50;

const YamlDiffViewer: React.FC<YamlDiffViewerProps> = ({
  yamlA,
  yamlB,
  versionA,
  versionB,
  visible,
  onClose,
}) => {
  const diffResult = useMemo(() => {
    return diffLines(yamlA || '', yamlB || '');
  }, [yamlA, yamlB]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    diffResult.forEach((part: Change) => {
      if (part.added) added += part.count || 0;
      if (part.removed) removed += part.count || 0;
    });
    return { added, removed };
  }, [diffResult]);

  const renderDiffLines = () => {
    let lineNumA = 1;
    let lineNumB = 1;
    const elements: React.ReactNode[] = [];

    diffResult.forEach((part: Change, idx: number) => {
      const lines = (part.value || '').split('\n').slice(0, -1);

      if (part.added) {
        lines.forEach((line: string, i: number) => {
          const currentLineNumB = lineNumB++;
          elements.push(
            <div
              key={`added-${idx}-${i}`}
              style={{
                display: 'flex',
                background: colors.success[50] || '#f6ffed',
                padding: `0 ${spacing.sm}`,
                borderLeft: `3px solid ${colors.success[500]}`,
              }}
            >
              <span
                style={{
                  width: lineNumWidth,
                  minWidth: lineNumWidth,
                  textAlign: 'right',
                  paddingRight: spacing[2],
                  color: colors.neutral[400],
                  fontSize: 12,
                  userSelect: 'none',
                }}
              >
                -
              </span>
              <span
                style={{
                  width: lineNumWidth,
                  minWidth: lineNumWidth,
                  textAlign: 'right',
                  paddingRight: spacing[2],
                  color: colors.neutral[400],
                  fontSize: 12,
                  userSelect: 'none',
                }}
              >
                {currentLineNumB}
              </span>
              <span style={{ color: colors.success[500], marginRight: spacing[2], fontWeight: 'bold' }}>
                +
              </span>
              <code style={{ fontFamily: 'monospace', fontSize: 13, flex: 1 }}>
                {line || ' '}
              </code>
            </div>
          );
        });
        return;
      }

      if (part.removed) {
        lines.forEach((line: string, i: number) => {
          const currentLineNumA = lineNumA++;
          elements.push(
            <div
              key={`removed-${idx}-${i}`}
              style={{
                display: 'flex',
                background: colors.error[50] || '#fff2f0',
                padding: `0 ${spacing.sm}`,
                borderLeft: `3px solid ${colors.error[500]}`,
              }}
            >
              <span
                style={{
                  width: lineNumWidth,
                  minWidth: lineNumWidth,
                  textAlign: 'right',
                  paddingRight: spacing[2],
                  color: colors.neutral[400],
                  fontSize: 12,
                  userSelect: 'none',
                }}
              >
                {currentLineNumA}
              </span>
              <span
                style={{
                  width: lineNumWidth,
                  minWidth: lineNumWidth,
                  textAlign: 'right',
                  paddingRight: spacing[2],
                  color: colors.neutral[400],
                  fontSize: 12,
                  userSelect: 'none',
                }}
              >
                -
              </span>
              <span style={{ color: colors.error[500], marginRight: spacing[2], fontWeight: 'bold' }}>
                -
              </span>
              <code style={{ fontFamily: 'monospace', fontSize: 13, flex: 1 }}>
                {line || ' '}
              </code>
            </div>
          );
        });
        return;
      }

      // Unchanged lines
      lines.forEach((line: string, i: number) => {
        const currentLineNumA = lineNumA++;
        const currentLineNumB = lineNumB++;
        elements.push(
          <div
            key={`unchanged-${idx}-${i}`}
            style={{
              display: 'flex',
              padding: `0 ${spacing.sm}`,
            }}
          >
            <span
              style={{
                width: lineNumWidth,
                minWidth: lineNumWidth,
                textAlign: 'right',
                paddingRight: spacing[2],
                color: colors.neutral[400],
                fontSize: 12,
                userSelect: 'none',
              }}
            >
              {currentLineNumA}
            </span>
            <span
              style={{
                width: lineNumWidth,
                minWidth: lineNumWidth,
                textAlign: 'right',
                paddingRight: spacing[2],
                color: colors.neutral[400],
                fontSize: 12,
                userSelect: 'none',
              }}
            >
              {currentLineNumB}
            </span>
            <span style={{ color: colors.neutral[300], marginRight: spacing[2] }}>

            </span>
            <code
              style={{
                fontFamily: 'monospace',
                fontSize: 13,
                flex: 1,
                color: colors.neutral[700],
              }}
            >
              {line || ' '}
            </code>
          </div>
        );
      });
    });

    return elements;
  };

  return (
    <Modal
      title={
        <Space>
          版本对比
          <Tag color="blue">
            v{versionA} → v{versionB}
          </Tag>
          <Tag color="green">+{stats.added}</Tag>
          <Tag color="red">-{stats.removed}</Tag>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={1200}
      footer={null}
      styles={{
        body: {
          maxHeight: 700,
          overflowY: 'auto',
          background: colors.neutral[50] || colors.neutral[50],
          borderRadius: componentRadius.input,
          padding: spacing[2],
          lineHeight: '1.8',
        },
      }}
    >
      {renderDiffLines()}
    </Modal>
  );
};

export default YamlDiffViewer;
