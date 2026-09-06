/**
 * ArtifactDetailDrawer.tsx - 制品详情抽屉
 * 抽取自 Artifacts/index.tsx (P2-9 Phase 75)
 */
import React from 'react';
import { Drawer, Tabs } from 'antd';
import type { Artifact } from '@/api/artifacts';

interface ArtifactDetailDrawerProps {
  visible: boolean;
  selectedArtifact: Artifact | null;
  detailTabItems: unknown;
  onClose: () => void;
}

export const ArtifactDetailDrawer: React.FC<ArtifactDetailDrawerProps> = ({
  visible,
  selectedArtifact,
  detailTabItems,
  onClose,
}) => {
  return (
    <Drawer
      title={
        selectedArtifact
          ? `${selectedArtifact.displayName || selectedArtifact.name} (${selectedArtifact.version})`
          : '制品详情'
      }
      open={visible}
      onClose={onClose}
      width={800}
      destroyOnClose
    >
      <Tabs items={detailTabItems as import('antd').TabsProps['items']} />
    </Drawer>
  );
};
