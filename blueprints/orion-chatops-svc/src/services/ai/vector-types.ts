/**
 * AI Vector Types - Stub
 */
export interface VectorEmbedding {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
}

export type CodeChunkType = 'function' | 'class' | 'module' | 'interface' | 'test' | 'config' | 'other';

export interface CodeChunkMetadata {
  language: string;
  filePath?: string;
  repoId?: string;
  projectName?: string;
  lineStart?: number;
  lineEnd?: number;
  [key: string]: unknown;
}

export interface CodeEmbedding {
  id: string;
  codeChunkId: string;
  vector: number[];
  metadata: CodeChunkMetadata;
  projectId?: string;
  filePath?: string;
  chunkType?: CodeChunkType;
  chunkName?: string;
  content?: string;
  embedding?: number[];
  createdAt: Date;
}

export interface CodeEmbeddingInput {
  codeChunkId?: string;
  vector?: number[];
  metadata?: CodeChunkMetadata;
  projectId?: string;
  filePath?: string;
  chunkType?: CodeChunkType;
  chunkName?: string;
  content?: string;
  embedding?: number[];
}

export interface KnowledgeMetadata {
  title?: string;
  spaceId?: string;
  tags?: string[];
  [key: string]: unknown;
}

export type KnowledgeDocType = 'document' | 'wiki' | 'note' | 'faq' | 'runbook' | 'other';

export interface KnowledgeEmbedding {
  id: string;
  docId: string;
  vector: number[];
  metadata: KnowledgeMetadata;
  docType?: KnowledgeDocType;
  title?: string;
  content?: string;
  embedding?: number[];
  createdAt: Date;
}

export interface KnowledgeEmbeddingInput {
  docId?: string;
  vector?: number[];
  metadata?: KnowledgeMetadata;
  docType?: KnowledgeDocType;
  title?: string;
  content?: string;
  embedding?: number[];
}
