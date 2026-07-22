/**
 * Code Repository Service
 *
 * 提供代码仓库高级抽象：Diff、评论、提交历史等。
 * 封装底层 ICodeRepoAdapter 调用，提供统一业务接口。
 */

import {
  ICodeRepoAdapter,
  RepoType,
  Repository,
  FileDiff,
  PRComment,
  Commit,
} from './types';

export interface FileDiffOptions {
  path?: string;
}

export interface CommitHistoryOptions {
  branch?: string;
  limit?: number;
}

export interface CreateCommentInput {
  body: string;
  path?: string;
  line?: number;
}

export class CodeRepoService {
  private adapter: ICodeRepoAdapter;

  constructor(adapter: ICodeRepoAdapter) {
    this.adapter = adapter;
  }

  /**
   * 获取适配器类型
   */
  getAdapterType(): RepoType {
    return this.adapter.type;
  }

  /**
   * 获取仓库信息
   */
  async getRepository(repoId: string): Promise<Repository> {
    return this.adapter.getRepository(repoId);
  }

  /**
   * 获取文件 diff（Task 5.6）
   */
  async getFileDiff(repoId: string, fromRef: string, toRef: string, options?: FileDiffOptions): Promise<FileDiff[]> {
    return this.adapter.getFileDiff(repoId, fromRef, toRef, options);
  }

  /**
   * 获取提交历史（Task 5.6）
   */
  async listCommits(repoId: string, options?: { branch?: string; page?: number; limit?: number }): Promise<{ commits: Commit[]; total: number }> {
    return this.adapter.listCommits(repoId, options);
  }

  /**
   * 获取单个提交（Task 5.6）
   */
  async getCommit(repoId: string, sha: string): Promise<Commit> {
    return this.adapter.getCommit(repoId, sha);
  }

  /**
   * 添加 PR 评论（Task 5.6）
   */
  async addComment(repoId: string, prId: string, input: CreateCommentInput): Promise<PRComment> {
    return this.adapter.addComment(repoId, prId, input);
  }

  /**
   * 列出 PR 评论（Task 5.6）
   */
  async listComments(repoId: string, prId: string): Promise<PRComment[]> {
    return this.adapter.listComments(repoId, prId);
  }
}
