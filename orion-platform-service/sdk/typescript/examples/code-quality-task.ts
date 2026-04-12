/**
 * Code Quality Task Plugin
 *
 * 执行代码质量检查（基于 ESLint）
 * 支持 TypeScript/JavaScript 项目
 */

import {
  TaskPlugin,
  TaskContext,
  TaskResult,
  TaskStatus,
  PluginMetadata,
  registerPlugin,
} from './plugin';

/**
 * 代码质量检查插件
 */
export class CodeQualityPlugin extends TaskPlugin {
  /**
   * 获取插件元数据
   */
  getMetadata(): PluginMetadata {
    return {
      name: 'code-quality',
      version: '1.0.0',
      description: 'Execute ESLint code quality checks for TypeScript/JavaScript projects',
      author: 'Orion Team',
      tags: ['code-quality', 'eslint', 'typescript', 'javascript'],
      configSchema: {
        eslintConfig: {
          type: 'string',
          description: 'ESLint 配置文件路径',
          default: '.eslintrc.js',
        },
        includePattern: {
          type: 'string',
          description: '要检查的文件模式',
          default: '**/*.{ts,tsx,js,jsx}',
        },
        excludePattern: {
          type: 'string',
          description: '要排除的文件模式',
          default: 'node_modules/**,dist/**',
        },
        failOnError: {
          type: 'boolean',
          description: '发现错误时是否失败',
          default: 'true',
        },
        maxWarnings: {
          type: 'number',
          description: '允许的最大警告数',
          default: '0',
        },
      },
    };
  }

  /**
   * 执行代码质量检查
   */
  async execute(ctx: TaskContext): Promise<TaskResult> {
    this.initContext(ctx);

    try {
      this.info('Starting code quality check...');

      // 读取配置
      const eslintConfig = this.getConfig('eslintConfig', '.eslintrc.js');
      const includePattern = this.getConfig('includePattern', '**/*.{ts,tsx,js,jsx}');
      const excludePattern = this.getConfig('excludePattern', 'node_modules/**,dist/**');
      const failOnError = this.getConfig('failOnError', 'true') === 'true';
      const maxWarnings = parseInt(this.getConfig('maxWarnings', '0'), 10);

      this.debug({
        eslintConfig,
        includePattern,
        excludePattern,
        failOnError,
        maxWarnings,
      });

      // 获取工作区
      const workspaceRoot = this.getWorkspaceRoot();
      this.info(`Workspace: ${workspaceRoot}`);

      // 模拟 ESLint 执行（实际实现中需要调用 ESLint API）
      const result = await this.runESLint({
        workspaceRoot,
        eslintConfig,
        includePattern,
        excludePattern,
      });

      // 检查结果
      const errorCount = result.errorCount || 0;
      const warningCount = result.warningCount || 0;

      this.info(`Found ${errorCount} errors and ${warningCount} warnings`);

      // 判断是否失败
      if (failOnError && errorCount > 0) {
        return {
          taskId: ctx.taskId,
          status: TaskStatus.FAILED,
          exitCode: 1,
          stdout: `ESLint found ${errorCount} errors`,
          stderr: result.messages?.filter(m => m.severity === 2).map(m => m.message).join('\n'),
          durationMs: Date.now() - this.startTime!,
          outputs: {
            errorCount: String(errorCount),
            warningCount: String(warningCount),
          },
        };
      }

      if (warningCount > maxWarnings) {
        return {
          taskId: ctx.taskId,
          status: TaskStatus.FAILED,
          exitCode: 1,
          stdout: `ESLint found ${warningCount} warnings (max: ${maxWarnings})`,
          durationMs: Date.now() - this.startTime!,
          outputs: {
            errorCount: String(errorCount),
            warningCount: String(warningCount),
          },
        };
      }

      // 成功
      return this.createSuccessResult({
        errorCount: String(errorCount),
        warningCount: String(warningCount),
        passed: String(errorCount === 0 && warningCount <= maxWarnings),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.error(`Code quality check failed: ${errorMessage}`);
      return this.createFailedResult(errorMessage);
    }
  }

  /**
   * 运行 ESLint（模拟实现）
   */
  private async runESLint(options: {
    workspaceRoot: string;
    eslintConfig: string;
    includePattern: string;
    excludePattern: string;
  }): Promise<{
    errorCount: number;
    warningCount: number;
    messages?: Array<{ severity: number; message: string }>;
  }> {
    // 实际实现中，这里会：
    // 1. 加载 ESLint 配置
    // 2. 扫描匹配的文件
    // 3. 执行 linting
    // 4. 收集结果

    // 模拟结果
    return {
      errorCount: 0,
      warningCount: 0,
      messages: [],
    };
  }
}

// 注册插件
const plugin = new CodeQualityPlugin();
registerPlugin(plugin);

export default plugin;
