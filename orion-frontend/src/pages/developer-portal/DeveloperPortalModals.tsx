/**
 * DeveloperPortal Modals & Drawers — all 12 modals/drawers extracted from DeveloperPortalPage.tsx
 */
import { Modal, Drawer, Button, Space } from 'antd';
import { EditOutlined, PlusOutlined, CopyOutlined } from '@ant-design/icons';
import type { PortalDocument, MockRule, SDKGenerationTask, APISubscription } from '@/api/developer-portal';
import { spacing, colors } from '@/tokens';
import { CloudUploadOutlined, ExperimentOutlined, CodeOutlined, KeyOutlined } from '@ant-design/icons';
import { CreateDocForm, EditDocForm, NewVersionForm } from './DocForms';
import { CreateMockForm, EditMockForm } from './MockForms';
import { CreateSdkForm, CreateSubForm, RejectSubForm } from './OtherForms';
import {
  DocDetailContent,
  SdkDetailContent,
  SubDetailContent,
  PgHistoryContent,
} from './DetailContents';

type FormInstance = ReturnType<typeof import('antd').Form.useForm>[0];

interface DeveloperPortalModalsProps {
  // Document
  createDocModal: boolean;
  createDocForm: FormInstance;
  onCreateDoc: () => void;
  onCreateDocCancel: () => void;
  editDocDrawer: boolean;
  editDocForm: FormInstance;
  selectedDoc: PortalDocument | null;
  onEditDoc: () => void;
  onEditDocCancel: () => void;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  detailDocDrawer: boolean;
  docVersions: unknown[];
  onDetailDocCancel: () => void;
  onOpenDocEdit: () => void;
  onOpenNewVersion: () => void;
  newVersionModal: boolean;
  newVersionForm: FormInstance;
  onNewVersion: () => void;
  onNewVersionCancel: () => void;
  // Mock
  createMockModal: boolean;
  createMockForm: FormInstance;
  onCreateMock: () => void;
  onCreateMockCancel: () => void;
  editMockModal: boolean;
  editMockForm: FormInstance;
  selectedMock: MockRule | null;
  onEditMock: () => void;
  onEditMockCancel: () => void;
  // SDK
  createSdkModal: boolean;
  createSdkForm: FormInstance;
  onCreateSdk: () => void;
  onCreateSdkCancel: () => void;
  sdkDetailDrawer: boolean;
  selectedSdk: SDKGenerationTask | null;
  onSdkDetailCancel: () => void;
  onCopyCode: (code: string) => void;
  // Subscription
  createSubModal: boolean;
  createSubForm: FormInstance;
  onCreateSub: () => void;
  onCreateSubCancel: () => void;
  subDetailDrawer: boolean;
  selectedSub: APISubscription | null;
  onSubDetailCancel: () => void;
  rejectSubModal: boolean;
  rejectSubForm: FormInstance;
  onRejectSub: () => void;
  onRejectSubCancel: () => void;
  // Playground
  pgHistoryDrawer: boolean;
  pgHistory: unknown[];
  onPgHistoryCancel: () => void;
  // Shared
  loading: boolean;
}

export function DeveloperPortalModals(props: DeveloperPortalModalsProps) {
  const {
    createDocModal, createDocForm, onCreateDoc, onCreateDocCancel,
    editDocDrawer, editDocForm, selectedDoc, onEditDoc, onEditDocCancel,
    onPublish, onUnpublish,
    detailDocDrawer, docVersions, onDetailDocCancel, onOpenDocEdit, onOpenNewVersion,
    newVersionModal, newVersionForm, onNewVersion, onNewVersionCancel,
    createMockModal, createMockForm, onCreateMock, onCreateMockCancel,
    editMockModal, editMockForm, onEditMock, onEditMockCancel,
    createSdkModal, createSdkForm, onCreateSdk, onCreateSdkCancel,
    sdkDetailDrawer, selectedSdk, onSdkDetailCancel, onCopyCode,
    createSubModal, createSubForm, onCreateSub, onCreateSubCancel,
    subDetailDrawer, selectedSub, onSubDetailCancel,
    rejectSubModal, rejectSubForm, onRejectSub, onRejectSubCancel,
    pgHistoryDrawer, pgHistory, onPgHistoryCancel,
    loading,
  } = props;

  return (
    <>
      {/* Create Document Modal */}
      <Modal
        title={
          <>
            <CloudUploadOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
            创建文档
          </>
        }
        open={createDocModal}
        onCancel={onCreateDocCancel}
        onOk={onCreateDoc}
        confirmLoading={loading}
        width={720}
        destroyOnClose
      >
        <CreateDocForm formInstance={createDocForm} />
      </Modal>

      {/* Edit Document Drawer */}
      <Drawer
        title={
          <>
            <EditOutlined style={{ marginRight: spacing.sm }} />
            编辑文档
          </>
        }
        open={editDocDrawer}
        onClose={onEditDocCancel}
        width={720}
        destroyOnClose
        extra={
          <Space>
            {selectedDoc && (selectedDoc.published ? (
              <Button onClick={() => onUnpublish(selectedDoc.id)}>取消发布</Button>
            ) : (
              <Button type="primary" onClick={() => onPublish(selectedDoc.id)}>
                发布
              </Button>
            ))}
            <Button onClick={onEditDoc} loading={loading} type="primary">
              保存
            </Button>
          </Space>
        }
      >
        <EditDocForm formInstance={editDocForm} />
      </Drawer>

      {/* Document Detail Drawer */}
      <Drawer
        title={selectedDoc?.title || '文档详情'}
        open={detailDocDrawer}
        onClose={onDetailDocCancel}
        width={720}
        destroyOnClose
        extra={
          <Space>
            {selectedDoc && (
              <Button icon={<EditOutlined />} onClick={onOpenDocEdit}>
                编辑
              </Button>
            )}
            {selectedDoc && (
              <Button icon={<PlusOutlined />} onClick={onOpenNewVersion}>
                新建版本
              </Button>
            )}
          </Space>
        }
      >
        {selectedDoc && (
          <DocDetailContent doc={selectedDoc} docVersions={docVersions as never[]} />
        )}
      </Drawer>

      {/* New Version Modal */}
      <Modal
        title="创建新版本"
        open={newVersionModal}
        onCancel={onNewVersionCancel}
        onOk={onNewVersion}
        confirmLoading={loading}
        destroyOnClose
      >
        <NewVersionForm formInstance={newVersionForm} />
      </Modal>

      {/* Create Mock Rule Modal */}
      <Modal
        title={
          <>
            <ExperimentOutlined style={{ marginRight: spacing.sm }} />
            添加 Mock 规则
          </>
        }
        open={createMockModal}
        onCancel={onCreateMockCancel}
        onOk={onCreateMock}
        confirmLoading={loading}
        width={720}
        destroyOnClose
      >
        <CreateMockForm formInstance={createMockForm} />
      </Modal>

      {/* Edit Mock Rule Modal */}
      <Modal
        title={
          <>
            <EditOutlined style={{ marginRight: spacing.sm }} />
            编辑 Mock 规则
          </>
        }
        open={editMockModal}
        onCancel={onEditMockCancel}
        onOk={onEditMock}
        confirmLoading={loading}
        width={720}
        destroyOnClose
      >
        <EditMockForm formInstance={editMockForm} />
      </Modal>

      {/* Create SDK Task Modal */}
      <Modal
        title={
          <>
            <CodeOutlined style={{ marginRight: spacing.sm }} />
            生成 SDK
          </>
        }
        open={createSdkModal}
        onCancel={onCreateSdkCancel}
        onOk={onCreateSdk}
        confirmLoading={loading}
        width={720}
        destroyOnClose
      >
        <CreateSdkForm formInstance={createSdkForm} />
      </Modal>

      {/* SDK Detail Drawer */}
      <Drawer
        title={`SDK 代码 - ${selectedSdk?.name || ''}`}
        open={sdkDetailDrawer}
        onClose={onSdkDetailCancel}
        width={800}
        destroyOnClose
        extra={
          selectedSdk?.output && (
            <Button
              icon={<CopyOutlined />}
              onClick={() => onCopyCode(selectedSdk.output || '')}
            >
              复制代码
            </Button>
          )
        }
      >
        {selectedSdk && <SdkDetailContent sdk={selectedSdk} />}
      </Drawer>

      {/* Create Subscription Modal */}
      <Modal
        title={
          <>
            <KeyOutlined style={{ marginRight: spacing.sm }} />
            申请 API 订阅
          </>
        }
        open={createSubModal}
        onCancel={onCreateSubCancel}
        onOk={onCreateSub}
        confirmLoading={loading}
        width={600}
        destroyOnClose
      >
        <CreateSubForm formInstance={createSubForm} />
      </Modal>

      {/* Subscription Detail Drawer */}
      <Drawer
        title={`订阅详情 - ${selectedSub?.apiName || ''}`}
        open={subDetailDrawer}
        onClose={onSubDetailCancel}
        width={600}
        destroyOnClose
      >
        {selectedSub && <SubDetailContent sub={selectedSub} />}
      </Drawer>

      {/* Reject Subscription Modal */}
      <Modal
        title="拒绝订阅"
        open={rejectSubModal}
        onCancel={onRejectSubCancel}
        onOk={onRejectSub}
        destroyOnClose
      >
        <RejectSubForm formInstance={rejectSubForm} />
      </Modal>

      {/* Playground History Drawer */}
      <Drawer
        title="响应历史"
        open={pgHistoryDrawer}
        onClose={onPgHistoryCancel}
        width={500}
        destroyOnClose
      >
        <PgHistoryContent history={pgHistory as never[]} />
      </Drawer>
    </>
  );
}
