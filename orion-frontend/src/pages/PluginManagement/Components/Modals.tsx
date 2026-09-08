import PluginCreateModal from '../PluginCreateModal';
import PluginDetailDrawer from '../PluginDetail';
import PluginLifecycleModal from '../PluginLifecycle';
import type { ApiPlugin, PluginConfig } from '../types';

interface Props {
  installModalOpen: boolean;
  setInstallModalOpen: (v: boolean) => void;
  detailDrawerOpen: boolean;
  setDetailDrawerOpen: (v: boolean) => void;
  executeModalOpen: boolean;
  setExecuteModalOpen: (v: boolean) => void;
  selectedPlugin: ApiPlugin | null;
  setSelectedPlugin: (p: ApiPlugin | null) => void;
  handleInstallSuccess: () => void;
  handleSaveConfig: (config: PluginConfig) => Promise<void>;
  handleExecuteSuccess: (result: any) => void;
}

export function Modals({
  installModalOpen,
  setInstallModalOpen,
  detailDrawerOpen,
  setDetailDrawerOpen,
  executeModalOpen,
  setExecuteModalOpen,
  selectedPlugin,
  setSelectedPlugin,
  handleInstallSuccess,
  handleSaveConfig,
  handleExecuteSuccess,
}: Props) {
  return (
    <>
      <PluginCreateModal
        open={installModalOpen}
        onCancel={() => setInstallModalOpen(false)}
        onSuccess={handleInstallSuccess}
      />
      <PluginDetailDrawer
        plugin={selectedPlugin}
        open={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false);
          setSelectedPlugin(null);
        }}
        onSaveConfig={handleSaveConfig}
      />
      <PluginLifecycleModal
        open={executeModalOpen}
        onCancel={() => {
          setExecuteModalOpen(false);
          setSelectedPlugin(null);
        }}
        onSuccess={handleExecuteSuccess}
        plugin={selectedPlugin}
      />
    </>
  );
}
