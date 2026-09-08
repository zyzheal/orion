import React from 'react';
import { Card, Row, Col } from 'antd';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useVectorStoreState } from './useVectorStoreState';
import { PageHeader } from './Components/PageHeader';
import { StatsPanel } from './Components/StatsPanel';
import CollectionList from './CollectionList';
import CollectionDetail from './CollectionDetail';
import VectorSearch from './VectorSearch';
import DocumentManager from './DocumentManager';
import CreateCollectionModal from './CreateCollectionModal';

dayjs.extend(relativeTime);

const VectorStorePage: React.FC = () => {
  const s = useVectorStoreState();

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        loading={s.loading}
        onRefresh={() => { s.loadData(); s.loadStats(); }}
        onCreate={() => s.setCreateModalVisible(true)}
      />

      <StatsPanel stats={s.stats} />

      <Row gutter={16}>
        <Col span={16}>
          <Card>
            <CollectionList
              collections={s.collections}
              filteredCollections={s.filteredCollections}
              loading={s.loading}
              searchQuery={s.searchQuery}
              onSearch={s.setSearchQuery}
              onOpenDetail={s.openDetail}
              onDeleteCollection={s.handleDeleteCollection}
            />
          </Card>
        </Col>
        <Col span={8}>
          <VectorSearch
            collections={s.collections}
            searchText={s.searchText}
            searchCollection={s.searchCollection}
            searchTopK={s.searchTopK}
            searchLoading={s.searchLoading}
            searchResults={s.searchResults}
            onSearchTextChange={s.setSearchText}
            onCollectionChange={s.setSearchCollection}
            onTopKChange={s.setSearchTopK}
            onSearch={s.handleSearch}
          />
          <div style={{ marginTop: spacing.md }}>
            <DocumentManager
              collections={s.collections}
              uploadContent={s.uploadContent}
              uploadCollection={s.uploadCollection}
              uploadMetadata={s.uploadMetadata}
              uploadLoading={s.uploadLoading}
              onContentChange={s.setUploadContent}
              onCollectionChange={s.setUploadCollection}
              onMetadataChange={s.setUploadMetadata}
              onUpload={s.handleUpload}
            />
          </div>
        </Col>
      </Row>

      <CreateCollectionModal
        open={s.createModalVisible}
        onCancel={() => s.setCreateModalVisible(false)}
        onSuccess={s.handleCreateSuccess}
        collections={s.collections}
        onCollectionsChange={s.setCollections}
      />

      <CollectionDetail
        collection={s.selectedCollection}
        open={s.detailDrawerVisible}
        onClose={() => s.setDetailDrawerVisible(false)}
        documents={s.collectionDocs}
        docsLoading={s.docsLoading}
        onDeleteDoc={s.handleDeleteDoc}
      />
    </div>
  );
};

export default VectorStorePage;
