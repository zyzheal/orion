/**
 * tree.ts - Document tree builder for KnowledgeBaseV2
 * 抽取自 KnowledgeBasePage.tsx (P2-9 Phase 39)
 */
import type { ReactNode } from 'react';
import type { WikiDocument } from '@/api/pandawiki';

export interface DocTreeNode extends WikiDocument {
  key: string;
  title: string;
  isLeaf: boolean;
  children?: DocTreeNode[];
  icon?: ReactNode;
}

export function buildDocTree(documents: WikiDocument[]): DocTreeNode[] {
  const map = new Map<string, DocTreeNode>();
  const roots: DocTreeNode[] = [];

  documents.forEach((doc) => {
    map.set(doc.id, {
      ...doc,
      key: doc.id,
      title: doc.title,
      isLeaf: true,
      children: [],
    });
  });

  const attached = new Set<string>();
  documents.forEach((doc) => {
    const node = map.get(doc.id)!;
    if (doc.parentId && doc.parentId !== doc.id && map.has(doc.parentId) && !attached.has(doc.id)) {
      attached.add(doc.id);
      const parent = map.get(doc.parentId)!;
      parent.children = parent.children || [];
      parent.children.push(node);
      parent.isLeaf = false;
    }
  });

  // Attach any unattached nodes as roots (including orphans and cycle-detected nodes)
  documents.forEach((doc) => {
    if (!attached.has(doc.id)) {
      const node = map.get(doc.id)!;
      roots.push(node);
    }
  });

  return roots;
}
