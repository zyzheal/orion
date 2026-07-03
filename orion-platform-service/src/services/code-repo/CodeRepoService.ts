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
  Comment,
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
   * 获取文件 diff
   */
  async getFileDiff(repoId: string, baseCommitSha: string, headCommitSha: string, options?: FileDiffOptions): Promise<FileDiff[]> {
    return this.adapter.getFileDiff(repoId, baseCommitSha, headCommitSha, options);
  }

  /**
   * 获取提交历史
   */
  async getCommitHistory(repoId: string, branch: string, limit = 20): Promise<{ commits: Commit[]; total: number }> {
    return this.adapter.getCommitHistory(repoId, branch, limit);
  }

  /**
   * 创建评论
   */
  async createComment(repoId: string, prId: string, input: CreateCommentInput): Promise<Comment> {
    return this.adapter.createComment(repoId, prId, input);
  }

  /**
   * 获取评论列表
   */
  async getComments(repoId: string, prId: string): Promise<Comment[]> {
    return this.adapter.getComments(repoId, prId);
  }

  /**
   * 更新评论
   */
  async updateComment(repoId: string, prId: string, commentId: string, body: string): Promise<Comment> {
    return this.adapter.updateComment(repoId, prId, commentId, body);
  }

  /**
   * 删除评论
   */
  async deleteComment(repoId: string, prId: string, commentId: string): Promise<void> {
    return this.adapter.deleteComment(repoId, prId, commentId);
  }
}
