/**
 * 审查集成服务
 *
 * 功能：
 * 1. 将审查评论发布到 GitLab MR / Gerrit Change
 * 2. 根据审查结果更新 PR 标签/状态
 * 3. 自动批准 (当评分超过阈值时)
 * 4. 生成审查摘要报告
 */

import pino from 'pino';

const logger = pino({ name: 'LReview-LIntegration-LService' });
import {
  ReviewResult,
  ReviewComment,
  ReviewSummary,
  Severity,
  ReviewConfig,
} from './types';

/** GitLab MR 评论 */
export interface GitLabComment {
  body: string;
  position?: {
    base_sha: string;
    head_sha: string;
    start_sha: string;
    new_path: string;
    new_line: number;
  };
}

/** Gerrit Review 输入 */
export interface GerritReviewInput {
  message: string;
  labels?: Record<string, number>;
  comments?: Array<{
    path: string;
    line: number;
    message: string;
  }>;
}

/** PR 更新结果 */
export interface PRUpdateResult {
  success: boolean;
  commentsPosted: number;
  labelsUpdated: boolean;
  autoApproved: boolean;
  error?: string;
}

/**
 * 审查集成服务
 */
export class ReviewIntegrationService {
  private config: ReviewConfig;

  constructor(config?: Partial<ReviewConfig>) {
    this.config = {
      rules: [],
      enabledCategories: [],
      maxCommentsPerFile: 20,
      maxTotalComments: 100,
      autoApproveThreshold: 90,
      deduplicationEnabled: true,
      similarityThreshold: 0.8,
      postCommentsToPR: true,
      ...config,
    };
  }

  /**
   * 发布审查评论到 PR/MR
   * @param repoType 仓库类型
   * @param repoId 仓库 ID
   * @param prId PR/MR ID
   * @param result 审查结果
   * @returns 发布结果
   */
  async postReviewComments(
    repoType: 'gitlab' | 'gerrit' | 'github',
    repoId: string,
    prId: string,
    result: ReviewResult
  ): Promise<PRUpdateResult> {
    if (!this.config.postCommentsToPR) {
      return {
        success: true,
        commentsPosted: 0,
        labelsUpdated: false,
        autoApproved: false,
      };
    }

    try {
      let postedCount = 0;

      switch (repoType) {
        case 'gitlab':
          postedCount = await this.postToGitLab(repoId, prId, result);
          break;
        case 'gerrit':
          postedCount = await this.postToGerrit(repoId, prId, result);
          break;
        case 'github':
          postedCount = await this.postToGitHub(repoId, prId, result);
          break;
      }

      // 更新 PR 标签
      await this.updatePRLabels(repoType, repoId, prId, result);

      // 检查是否自动批准
      const autoApproved = await this.checkAutoApprove(repoType, repoId, prId, result);

      return {
        success: true,
        commentsPosted: postedCount,
        labelsUpdated: true,
        autoApproved,
      };
    } catch (error) {
      return {
        success: false,
        commentsPosted: 0,
        labelsUpdated: false,
        autoApproved: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 更新 PR 标签/状态
   */
  async updatePRLabels(
    repoType: 'gitlab' | 'gerrit' | 'github',
    repoId: string,
    prId: string,
    result: ReviewResult
  ): Promise<boolean> {
    const labels = this.generateLabels(result);

    // 在实际实现中，这里会调用 GitLab/Gerrit/GitHub API 更新标签
    // 当前作为抽象实现，记录标签信息
    logger.info(
      `[ReviewIntegration] Updating labels for ${repoType} PR ${prId}:`,
      labels
    );

    return true;
  }

  /**
   * 检查并执行自动批准
   */
  async checkAutoApprove(
    repoType: 'gitlab' | 'gerrit' | 'github',
    repoId: string,
    prId: string,
    result: ReviewResult
  ): Promise<boolean> {
    if (!result.autoApproved) {
      return false;
    }

    logger.info(`[ReviewIntegration] Auto-approving ${repoType} PR ${prId}`);

    // 在实际实现中，这里会调用 API 批准 PR
    // GitLab: POST /projects/:id/merge_requests/:iid/merge
    // Gerrit: POST /changes/:id/revisions/:id/review (Code-Review: +2)
    // GitHub: PUT /repos/:owner/:repo/pulls/:number/merge

    return true;
  }

  /**
   * 生成审查摘要报告 (Markdown 格式)
   */
  generateReviewReport(result: ReviewResult): string {
    const { summary, score, comments, duration } = result;

    const verdictEmoji =
      summary.verdict === 'approved'
        ? '✅'
        : summary.verdict === 'changes_requested'
          ? '❌'
          : '⚠️';

    const severityEmoji: Record<Severity, string> = {
      [Severity.CRITICAL]: '🔴',
      [Severity.WARNING]: '🟡',
      [Severity.INFO]: '🔵',
      [Severity.SUGGESTION]: '💡',
    };

    let report = `# AI Code Review Report ${verdictEmoji}\n\n`;

    // 评分
    report += `## Score: ${score}/100\n\n`;

    // 摘要
    report += '## Summary\n\n';
    report += `| Metric | Count |\n`;
    report += `|--------|-------|\n`;
    report += `| Total Issues | ${summary.totalIssues} |\n`;
    report += `| Critical | ${summary.criticalCount} |\n`;
    report += `| Warning | ${summary.warningCount} |\n`;
    report += `| Info | ${summary.infoCount} |\n`;
    report += `| Suggestion | ${summary.suggestionCount} |\n`;
    report += `| Affected Files | ${summary.affectedFiles} |\n`;
    report += `| Duration | ${duration}ms |\n\n`;

    // 结论
    report += `## Verdict: ${summary.verdict.toUpperCase()}\n\n`;
    report += `${summary.verdictReason}\n\n`;

    // 按严重程度分类的评论
    const severities: Severity[] = [
      Severity.CRITICAL,
      Severity.WARNING,
      Severity.INFO,
      Severity.SUGGESTION,
    ];

    for (const severity of severities) {
      const severityComments = comments.filter((c) => c.severity === severity);
      if (severityComments.length === 0) continue;

      report += `## ${severityEmoji[severity]} ${severity.toUpperCase()} (${severityComments.length})\n\n`;

      // 按文件分组
      const byFile = new Map<string, ReviewComment[]>();
      for (const comment of severityComments) {
        const list = byFile.get(comment.filePath) || [];
        list.push(comment);
        byFile.set(comment.filePath, list);
      }

      for (const [filePath, fileComments] of byFile) {
        report += `### \`${filePath}\`\n\n`;
        for (const comment of fileComments) {
          report += `- **Line ${comment.lineNumber}**: ${comment.message}\n`;
          if (comment.suggestion) {
            report += `  - Suggestion: ${comment.suggestion}\n`;
          }
          if (comment.codeSnippet) {
            report += `  - \`${comment.codeSnippet}\`\n`;
          }
        }
        report += '\n';
      }
    }

    // 如果自动批准
    if (result.autoApproved) {
      report += '---\n\n';
      report += `> This PR has been automatically approved by AI Code Review (score: ${score}/100)\n`;
    }

    return report;
  }

  // ==================== 内部方法 ====================

  /**
   * 发布评论到 GitLab
   */
  private async postToGitLab(
    repoId: string,
    prId: string,
    result: ReviewResult
  ): Promise<number> {
    // 实际实现会调用 GitLab API:
    // POST /projects/:id/merge_requests/:iid/notes (总体评论)
    // POST /projects/:id/merge_requests/:iid/discussions (行级评论)

    // 1. 发布总体审查报告
    const report = this.generateReviewReport(result);
    logger.info(
      `[GitLab] Posting review report to MR ${prId} in repo ${repoId}`
    );

    // 2. 发布行级评论
    let postedCount = 0;
    for (const comment of result.comments) {
      const gitlabComment: GitLabComment = {
        body: this.formatCommentForPR(comment),
        position: {
          base_sha: 'HEAD',
          head_sha: 'HEAD',
          start_sha: 'HEAD',
          new_path: comment.filePath,
          new_line: comment.lineNumber,
        },
      };

      logger.info(
        `[GitLab] Posting comment on ${comment.filePath}:${comment.lineNumber}`
      );
      postedCount++;
    }

    return postedCount;
  }

  /**
   * 发布评论到 Gerrit
   */
  private async postToGerrit(
    repoId: string,
    prId: string,
    result: ReviewResult
  ): Promise<number> {
    // 实际实现会调用 Gerrit REST API:
    // POST /changes/:id/revisions/:id/review

    const reviewInput: GerritReviewInput = {
      message: this.generateReviewReport(result),
      labels: {},
      comments: [],
    };

    // 设置 Code-Review 标签
    if (result.autoApproved) {
      reviewInput.labels = { 'Code-Review': 2 };
    } else if (result.summary.criticalCount > 0) {
      reviewInput.labels = { 'Code-Review': -2 };
    } else if (result.score >= 70) {
      reviewInput.labels = { 'Code-Review': 1 };
    }

    // 添加行级评论
    for (const comment of result.comments) {
      reviewInput.comments!.push({
        path: comment.filePath,
        line: comment.lineNumber,
        message: this.formatCommentForPR(comment),
      });
    }

    logger.info(
      `[Gerrit] Posting review to Change ${prId} in repo ${repoId}`
    );

    return reviewInput.comments!.length;
  }

  /**
   * 发布评论到 GitHub
   */
  private async postToGitHub(
    repoId: string,
    prId: string,
    result: ReviewResult
  ): Promise<number> {
    // 实际实现会调用 GitHub API:
    // POST /repos/:owner/:repo/pulls/:number/reviews (总体审查)
    // POST /repos/:owner/:repo/pulls/:number/comments (行级评论)

    const report = this.generateReviewReport(result);
    logger.info(
      `[GitHub] Posting review report to PR ${prId} in repo ${repoId}`
    );

    let postedCount = 0;
    for (const comment of result.comments) {
      logger.info(
        `[GitHub] Posting comment on ${comment.filePath}:${comment.lineNumber}`
      );
      postedCount++;
    }

    return postedCount;
  }

  /**
   * 生成标签列表
   */
  private generateLabels(result: ReviewResult): string[] {
    const labels: string[] = ['ai-reviewed'];

    if (result.autoApproved) {
      labels.push('ai-approved');
    }

    if (result.summary.criticalCount > 0) {
      labels.push('ai-critical-issues');
    }

    if (result.summary.warningCount > 0) {
      labels.push('ai-warnings');
    }

    // 添加评分标签
    if (result.score >= 90) {
      labels.push('ai-score-a');
    } else if (result.score >= 70) {
      labels.push('ai-score-b');
    } else if (result.score >= 50) {
      labels.push('ai-score-c');
    } else {
      labels.push('ai-score-d');
    }

    return labels;
  }

  /**
   * 格式化单条评论为 PR 友好格式
   */
  private formatCommentForPR(comment: ReviewComment): string {
    let text = `**[${comment.severity.toUpperCase()}]** ${comment.message}`;

    if (comment.suggestion) {
      text += `\n\n💡 **Suggestion**: ${comment.suggestion}`;
    }

    if (comment.codeSnippet) {
      text += `\n\n\`\`\`\n${comment.codeSnippet}\n\`\`\``;
    }

    return text;
  }
}
