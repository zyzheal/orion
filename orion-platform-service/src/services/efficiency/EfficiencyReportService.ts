/**
 * 效能前端面板数据服务
 *
 * 提供效能报告生成、团队指标、项目指标、时间段对比等功能
 * 使用 Map 内存存储
 */

import { v4 as uuidv4 } from 'uuid';
import {
  TimeWindow,
  DeploymentRecord,
  PipelineCompletionRecord,
  IncidentRecord,
  DoraMetricsReport,
} from '../efficiency/types';
import { DoraMetricsService } from '../efficiency/DoraMetricsService';
import {
  EfficiencyTeamDataRepository,
  EfficiencyProjectDataRepository,
  EfficiencyReportHistoryRepository,
  EfficiencyGlobalDeploymentRepository,
  EfficiencyGlobalPipelineRepository,
} from '../../repositories/EfficiencyReportRepository';

/**
 * 效能报告
 */
export interface EfficiencyReport {
  /** 报告 ID */
  reportId: string;
  /** 租户 ID */
  tenantId: string;
  /** 时间窗口 */
  timeWindow: TimeWindow;
  /** 窗口大小 */
  windowSize: number;
  /** DORA 指标 */
  doraMetrics: DoraMetricsReport | null;
  /** 总 Pipeline 执行次数 */
  totalPipelineRuns: number;
  /** 成功率 */
  pipelineSuccessRate: number;
  /** 平均构建时间（毫秒） */
  averageBuildTimeMs: number;
  /** 总部署次数 */
  totalDeployments: number;
  /** 报告生成时间 */
  generatedAt: Date;
}

/**
 * 团队指标
 */
export interface TeamMetrics {
  /** 团队 ID */
  teamId: string;
  /** 团队名称 */
  teamName: string;
  /** 租户 ID */
  tenantId: string;
  /** 活跃成员数 */
  activeMembers: number;
  /** 完成 Pipeline 数 */
  completedPipelines: number;
  /** 成功率 */
  successRate: number;
  /** 平均执行时间（毫秒） */
  averageExecutionTimeMs: number;
  /** 部署次数 */
  deploymentCount: number;
  /** 变更失败率 */
  changeFailureRate: number;
}

/**
 * 项目指标
 */
export interface ProjectMetrics {
  /** 项目 ID */
  projectId: string;
  /** 项目名称 */
  projectName: string;
  /** 租户 ID */
  tenantId: string;
  /** Pipeline 总数 */
  totalPipelines: number;
  /** 最近 7 天 Pipeline 数 */
  recentPipelineCount: number;
  /** 成功率 */
  successRate: number;
  /** 平均构建时间（毫秒） */
  averageBuildTimeMs: number;
  /** 部署次数 */
  deploymentCount: number;
  /** 代码提交数 */
  commitCount: number;
}

/**
 * 时间段对比结果
 */
export interface PeriodComparison {
  /** 时间段 A */
  periodA: {
    label: string;
    start: Date;
    end: Date;
    pipelineRuns: number;
    successRate: number;
    averageBuildTimeMs: number;
    deployments: number;
    changeFailureRate: number;
  };
  /** 时间段 B */
  periodB: {
    label: string;
    start: Date;
    end: Date;
    pipelineRuns: number;
    successRate: number;
    averageBuildTimeMs: number;
    deployments: number;
    changeFailureRate: number;
  };
  /** 变化百分比（B 相对 A） */
  changes: {
    pipelineRuns: number;
    successRate: number;
    averageBuildTime: number;
    deployments: number;
    changeFailureRate: number;
  };
}

/**
 * 效能报告数据服务
 */
interface DeveloperProfile {
  id: string;
  name: string;
  team: string;
  role: string;
  commits: number;
  prs: number;
  reviews: number;
  bugsFixed: number;
  avgReviewTime: number;
  avgPRSize: number;
  codeQuality: number;
  activeDays: number;
  specialty: string[];
}

export class EfficiencyReportService {
  private doraService: DoraMetricsService;

  /** 团队数据存储（内存缓存） */
  private teamData: Map<string, {
    name: string;
    members: number;
    pipelines: PipelineCompletionRecord[];
    deployments: DeploymentRecord[];
  }> = new Map();

  /** 项目数据存储（内存缓存） */
  private projectData: Map<string, {
    name: string;
    pipelines: PipelineCompletionRecord[];
    deployments: DeploymentRecord[];
    commits: number;
  }> = new Map();

  /** 历史报告存储（内存缓存） */
  private reportHistory: Map<string, EfficiencyReport[]> = new Map();

  /** 模拟的部署和 Pipeline 数据（内存缓存） */
  private globalDeployments: Map<string, DeploymentRecord[]> = new Map();
  private globalPipelineRecords: Map<string, PipelineCompletionRecord[]> = new Map();

  /** PostgreSQL 持久化（可选） */
  private teamDataRepo: EfficiencyTeamDataRepository | null = null;
  private projectDataRepo: EfficiencyProjectDataRepository | null = null;
  private reportHistoryRepo: EfficiencyReportHistoryRepository | null = null;
  private globalDeploymentsRepo: EfficiencyGlobalDeploymentRepository | null = null;
  private globalPipelinesRepo: EfficiencyGlobalPipelineRepository | null = null;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.doraService = new DoraMetricsService();
    if (db) {
      this.teamDataRepo = new EfficiencyTeamDataRepository(db);
      this.projectDataRepo = new EfficiencyProjectDataRepository(db);
      this.reportHistoryRepo = new EfficiencyReportHistoryRepository(db);
      this.globalDeploymentsRepo = new EfficiencyGlobalDeploymentRepository(db);
      this.globalPipelinesRepo = new EfficiencyGlobalPipelineRepository(db);
    }
  }

  /**
   * 生成效能报告
   */
  generateReport(
    tenantId: string,
    timeWindow: TimeWindow = 'week',
    windowSize: number = 1
  ): EfficiencyReport {
    const windowConfig = this.doraService.buildTimeWindow(timeWindow, windowSize);

    const deployments = this.globalDeployments.get(tenantId) ?? [];
    const pipelineRecords = this.globalPipelineRecords.get(tenantId) ?? [];

    // 计算 DORA 指标
    const doraMetrics = (deployments.length > 0 || pipelineRecords.length > 0)
      ? this.doraService.generateReport(tenantId, pipelineRecords, deployments, windowConfig)
      : null;

    // 计算 Pipeline 指标
    const windowPipelines = pipelineRecords.filter(
      (r) => r.completedAt >= windowConfig.start && r.completedAt <= windowConfig.end
    );
    const successfulPipelines = windowPipelines.filter((r) => r.status === 'success').length;
    const successRate = windowPipelines.length > 0
      ? (successfulPipelines / windowPipelines.length) * 100
      : 0;
    const averageBuildTimeMs = windowPipelines.length > 0
      ? windowPipelines.reduce((sum, r) => sum + r.durationMs, 0) / windowPipelines.length
      : 0;

    // 计算部署指标
    const windowDeployments = deployments.filter(
      (d) => d.deployedAt >= windowConfig.start && d.deployedAt <= windowConfig.end
    );

    const report: EfficiencyReport = {
      reportId: uuidv4(),
      tenantId,
      timeWindow,
      windowSize,
      doraMetrics,
      totalPipelineRuns: windowPipelines.length,
      pipelineSuccessRate: Math.round(successRate * 100) / 100,
      averageBuildTimeMs: Math.round(averageBuildTimeMs),
      totalDeployments: windowDeployments.length,
      generatedAt: new Date(),
    };

    // 保存报告历史
    const history = this.reportHistory.get(tenantId) ?? [];
    history.push(report);
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
    this.reportHistory.set(tenantId, history);

    // PostgreSQL 持久化（异步）
    if (this.reportHistoryRepo) {
      this.reportHistoryRepo.create({
        id: report.reportId,
        tenantId,
        reportData: report as unknown as Record<string, unknown>,
        generatedAt: report.generatedAt,
      }).catch(() => { /* 持久化失败不阻塞 */ });
    }

    return report;
  }

  /**
   * 获取团队指标
   */
  getTeamMetrics(tenantId: string, teamId: string): TeamMetrics {
    const team = this.teamData.get(teamId);

    if (!team) {
      // 返回默认值
      return {
        teamId,
        teamName: `Team ${teamId}`,
        tenantId,
        activeMembers: 0,
        completedPipelines: 0,
        successRate: 0,
        averageExecutionTimeMs: 0,
        deploymentCount: 0,
        changeFailureRate: 0,
      };
    }

    const completed = team.pipelines.length;
    const successful = team.pipelines.filter((p) => p.status === 'success').length;
    const successRate = completed > 0 ? (successful / completed) * 100 : 0;
    const avgTime = completed > 0
      ? team.pipelines.reduce((sum, p) => sum + p.durationMs, 0) / completed
      : 0;

    const failedDeployments = team.deployments.filter(
      (d) => d.status === 'failed' || d.status === 'rolled_back'
    ).length;
    const changeFailureRate = team.deployments.length > 0
      ? (failedDeployments / team.deployments.length) * 100
      : 0;

    return {
      teamId,
      teamName: team.name,
      tenantId,
      activeMembers: team.members,
      completedPipelines: completed,
      successRate: Math.round(successRate * 100) / 100,
      averageExecutionTimeMs: Math.round(avgTime),
      deploymentCount: team.deployments.length,
      changeFailureRate: Math.round(changeFailureRate * 100) / 100,
    };
  }

  /**
   * 获取项目指标
   */
  getProjectMetrics(tenantId: string, projectId: string): ProjectMetrics {
    const project = this.projectData.get(projectId);

    if (!project) {
      return {
        projectId,
        projectName: `Project ${projectId}`,
        tenantId,
        totalPipelines: 0,
        recentPipelineCount: 0,
        successRate: 0,
        averageBuildTimeMs: 0,
        deploymentCount: 0,
        commitCount: 0,
      };
    }

    const total = project.pipelines.length;
    const successful = project.pipelines.filter((p) => p.status === 'success').length;
    const successRate = total > 0 ? (successful / total) * 100 : 0;
    const avgBuildTime = total > 0
      ? project.pipelines.reduce((sum, p) => sum + p.durationMs, 0) / total
      : 0;

    // 最近 7 天的 Pipeline
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentCount = project.pipelines.filter(
      (p) => p.completedAt >= sevenDaysAgo
    ).length;

    return {
      projectId,
      projectName: project.name,
      tenantId,
      totalPipelines: total,
      recentPipelineCount: recentCount,
      successRate: Math.round(successRate * 100) / 100,
      averageBuildTimeMs: Math.round(avgBuildTime),
      deploymentCount: project.deployments.length,
      commitCount: project.commits,
    };
  }

  /**
   * 对比两个时间段
   */
  comparePeriods(
    tenantId: string,
    periodA: { label: string; start: Date; end: Date },
    periodB: { label: string; start: Date; end: Date }
  ): PeriodComparison {
    const deployments = this.globalDeployments.get(tenantId) ?? [];
    const pipelineRecords = this.globalPipelineRecords.get(tenantId) ?? [];

    const metricsA = this.computePeriodMetrics(pipelineRecords, deployments, periodA);
    const metricsB = this.computePeriodMetrics(pipelineRecords, deployments, periodB);

    return {
      periodA: { ...periodA, ...metricsA },
      periodB: { ...periodB, ...metricsB },
      changes: {
        pipelineRuns: this.computeChangePercent(metricsA.pipelineRuns, metricsB.pipelineRuns),
        successRate: this.computeChangePercent(metricsA.successRate, metricsB.successRate),
        averageBuildTime: this.computeChangePercent(metricsA.averageBuildTimeMs, metricsB.averageBuildTimeMs),
        deployments: this.computeChangePercent(metricsA.deployments, metricsB.deployments),
        changeFailureRate: this.computeChangePercent(metricsA.changeFailureRate, metricsB.changeFailureRate),
      },
    };
  }

  /**
   * 注册团队数据（用于测试和模拟）
   */
  registerTeam(
    teamId: string,
    name: string,
    members: number,
    pipelines: PipelineCompletionRecord[],
    deployments: DeploymentRecord[]
  ): void {
    this.teamData.set(teamId, { name, members, pipelines, deployments });
    // PostgreSQL 持久化（异步）
    if (this.teamDataRepo) {
      this.teamDataRepo.create({
        id: teamId,
        tenantId: 'default',
        name,
        members,
        pipelines,
        deployments,
      }).catch(() => { /* 持久化失败不阻塞 */ });
    }
  }

  /**
   * 注册项目数据（用于测试和模拟）
   */
  registerProject(
    projectId: string,
    name: string,
    pipelines: PipelineCompletionRecord[],
    deployments: DeploymentRecord[],
    commits: number = 0
  ): void {
    this.projectData.set(projectId, { name, pipelines, deployments, commits });
    // PostgreSQL 持久化（异步）
    if (this.projectDataRepo) {
      this.projectDataRepo.create({
        id: projectId,
        tenantId: 'default',
        name,
        pipelines,
        deployments,
        commits,
      }).catch(() => { /* 持久化失败不阻塞 */ });
    }
  }

  /**
   * 注入全局数据
   */
  injectGlobalData(
    tenantId: string,
    deployments: DeploymentRecord[],
    pipelineRecords: PipelineCompletionRecord[]
  ): void {
    this.globalDeployments.set(tenantId, deployments);
    this.globalPipelineRecords.set(tenantId, pipelineRecords);
    // PostgreSQL 持久化（异步）
    if (this.globalDeploymentsRepo) {
      for (const d of deployments) {
        this.globalDeploymentsRepo.create({
          id: d.id || uuidv4(),
          tenantId,
          deploymentData: d as unknown as Record<string, unknown>,
          deployedAt: d.deployedAt,
        }).catch(() => { /* 持久化失败不阻塞 */ });
      }
    }
    if (this.globalPipelinesRepo) {
      for (const p of pipelineRecords) {
        this.globalPipelinesRepo.create({
          id: p.id || uuidv4(),
          tenantId,
          pipelineData: p as unknown as Record<string, unknown>,
          completedAt: p.completedAt,
        }).catch(() => { /* 持久化失败不阻塞 */ });
      }
    }
  }

  /**
   * 获取报告历史
   */
  getReportHistory(tenantId: string, limit: number = 10): EfficiencyReport[] {
    const history = this.reportHistory.get(tenantId) ?? [];
    return history.slice(-limit);
  }

  /**
   * 获取所有已注册的团队列表
   */
  getAllTeams(tenantId: string): Array<{ teamId: string; teamName: string }> {
    const teams: Array<{ teamId: string; teamName: string }> = [];
    for (const [teamId, team] of this.teamData.entries()) {
      teams.push({ teamId, teamName: team.name });
    }
    // If no teams registered yet, return default set
    if (teams.length === 0) {
      teams.push(
        { teamId: 'platform', teamName: '平台组' },
        { teamId: 'frontend', teamName: '前端组' },
        { teamId: 'backend', teamName: '后端组' },
        { teamId: 'qa', teamName: 'QA组' },
        { teamId: 'sre', teamName: 'SRE组' },
        { teamId: 'ai', teamName: 'AI组' }
      );
    }
    return teams;
  }

  // ==================== 开发者画像 ====================

  /**
   * 从团队数据中派生开发者画像
   */
  getDeveloperProfiles(_tenantId: string): DeveloperProfile[] {
    const profiles: DeveloperProfile[] = [];
    const roles = ['高级工程师', '中级工程师', '初级工程师', 'SRE 工程师', '测试工程师', 'ML 工程师'];
    const specialties: string[][] = [
      ['React', 'TypeScript', '微前端'],
      ['Go', 'gRPC', 'K8s'],
      ['CI/CD', 'Terraform', 'Platform'],
      ['自动化测试', '性能测试', 'Selenium'],
      ['Prometheus', 'Grafana', 'Incident'],
      ['Python', 'TensorFlow', 'MLOps'],
      ['Java', 'Spring', 'MySQL'],
      ['Rust', 'WebAssembly', 'Networking'],
    ];

    let profileIndex = 0;
    for (const [teamId, team] of this.teamData.entries()) {
      const completedPipelines = team.pipelines.length;
      const successfulPipelines = team.pipelines.filter(p => p.status === 'success').length;
      const teamSuccessRate = completedPipelines > 0 ? (successfulPipelines / completedPipelines) * 100 : 0;

      // Generate representative profiles per team based on team metrics
      const memberCount = Math.max(1, team.members);
      for (let i = 0; i < Math.min(memberCount, 3); i++) {
        const profileId = `dev-${teamId}-${i + 1}`;
        const commits = Math.round((completedPipelines * 5 + Math.random() * 50));
        const prs = Math.round(completedPipelines * 0.8 + Math.random() * 10);
        const reviews = Math.round(completedPipelines * 1.2 + Math.random() * 20);
        const bugsFixed = Math.round(successfulPipelines * 0.3 + Math.random() * 5);
        const avgReviewTime = Math.round(10 + Math.random() * 25);
        const avgPRSize = Math.round(80 + Math.random() * 300);
        const codeQuality = Math.round(Math.min(98, teamSuccessRate * 0.7 + 20 + Math.random() * 15));
        const activeDays = Math.round(15 + Math.random() * 7);

        profiles.push({
          id: profileId,
          name: `${team.name}成员${i + 1}`,
          team: team.name,
          role: roles[profileIndex % roles.length],
          commits,
          prs,
          reviews,
          bugsFixed,
          avgReviewTime,
          avgPRSize,
          codeQuality,
          activeDays,
          specialty: specialties[profileIndex % specialties.length],
        });
        profileIndex++;
      }
    }

    return profiles;
  }

  // ==================== 私有方法 ====================

  /**
   * 计算单个时间段的指标
   */
  private computePeriodMetrics(
    pipelineRecords: PipelineCompletionRecord[],
    deployments: DeploymentRecord[],
    period: { start: Date; end: Date }
  ): {
    pipelineRuns: number;
    successRate: number;
    averageBuildTimeMs: number;
    deployments: number;
    changeFailureRate: number;
  } {
    const windowPipelines = pipelineRecords.filter(
      (r) => r.completedAt >= period.start && r.completedAt <= period.end
    );
    const successful = windowPipelines.filter((r) => r.status === 'success').length;
    const successRate = windowPipelines.length > 0
      ? (successful / windowPipelines.length) * 100
      : 0;
    const avgBuildTime = windowPipelines.length > 0
      ? windowPipelines.reduce((sum, r) => sum + r.durationMs, 0) / windowPipelines.length
      : 0;

    const windowDeployments = deployments.filter(
      (d) => d.deployedAt >= period.start && d.deployedAt <= period.end
    );
    const failedDeps = windowDeployments.filter(
      (d) => d.status === 'failed' || d.status === 'rolled_back'
    ).length;
    const changeFailureRate = windowDeployments.length > 0
      ? (failedDeps / windowDeployments.length) * 100
      : 0;

    return {
      pipelineRuns: windowPipelines.length,
      successRate: Math.round(successRate * 100) / 100,
      averageBuildTimeMs: Math.round(avgBuildTime),
      deployments: windowDeployments.length,
      changeFailureRate: Math.round(changeFailureRate * 100) / 100,
    };
  }

  /**
   * 计算变化百分比
   */
  private computeChangePercent(oldValue: number, newValue: number): number {
    if (oldValue === 0) {
      return newValue > 0 ? 100 : 0;
    }
    return Math.round(((newValue - oldValue) / oldValue) * 10000) / 100;
  }
}
