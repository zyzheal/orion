/**
 * MCP Resources - Export all available resources
 *
 * This file defines resources that AI assistants can read from Orion DevOps platform.
 * Resources are read-only data sources identified by URIs.
 */

import { McpResource, McpResourceTemplate, McpContext, McpResourceContent } from '../mcp-config';

/**
 * Resource: projects://list
 * List all projects
 */
export const projectsListResource: McpResource = {
  uri: 'projects://list',
  name: 'Project List',
  description: 'List of all projects in the platform',
  mimeType: 'application/json',
  handler: async (uri: string, context: McpContext): Promise<McpResourceContent> => {
    // Note: Actual implementation would use ProjectRepository
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          projects: [
            { id: 'proj-001', name: 'Orion Platform', status: 'active', team: 'platform' },
            { id: 'proj-002', name: 'Orion API', status: 'active', team: 'backend' },
            { id: 'proj-003', name: 'Orion Frontend', status: 'active', team: 'frontend' },
            { id: 'proj-004', name: 'Orion AI Service', status: 'active', team: 'ai' },
          ],
          total: 4,
          retrieved_at: new Date().toISOString(),
        }, null, 2),
      }],
    };
  },
};

/**
 * Resource Template: projects://{id}
 * Get project details by ID
 */
export const projectDetailTemplate: McpResourceTemplate = {
  uriTemplate: 'projects://{id}',
  name: 'Project Details',
  description: 'Detailed information about a specific project',
  mimeType: 'application/json',
  handler: async (uri: string, params: Record<string, string>, context: McpContext): Promise<McpResourceContent> => {
    const projectId = params.id;

    // Note: Actual implementation would use ProjectRepository
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          id: projectId,
          name: 'Orion Platform',
          description: 'AI-driven DevOps platform for R&D efficiency',
          status: 'active',
          team: 'platform-team',
          owner: 'john.doe@example.com',
          created_at: '2024-01-01T00:00:00Z',
          repository: 'https://github.com/example/orion-platform',
          pipelines: ['pipeline-build', 'pipeline-deploy', 'pipeline-test'],
          environments: ['dev', 'staging', 'prod'],
          dora_metrics: {
            deployment_frequency: 'high',
            lead_time_for_changes: '<1 day',
            change_failure_rate: '<5%',
            mttr: '<1 hour',
          },
          last_deployment: {
            version: 'v2.3.1',
            environment: 'prod',
            deployed_at: new Date(Date.now() - 3600000).toISOString(),
          },
        }, null, 2),
      }],
    };
  },
};

/**
 * Resource: pipelines://list
 * List all pipelines
 */
export const pipelinesListResource: McpResource = {
  uri: 'pipelines://list',
  name: 'Pipeline List',
  description: 'List of all pipelines in the platform',
  mimeType: 'application/json',
  handler: async (uri: string, context: McpContext): Promise<McpResourceContent> => {
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          pipelines: [
            { id: 'pipe-001', name: 'Build Pipeline', project: 'orion-api', triggers: ['push', 'manual'] },
            { id: 'pipe-002', name: 'Deploy Pipeline', project: 'orion-api', triggers: ['manual', 'approval'] },
            { id: 'pipe-003', name: 'Test Pipeline', project: 'orion-frontend', triggers: ['push', 'schedule'] },
          ],
          total: 3,
          retrieved_at: new Date().toISOString(),
        }, null, 2),
      }],
    };
  },
};

/**
 * Resource Template: pipelines://{id}/runs
 * Get pipeline run history
 */
export const pipelineRunsTemplate: McpResourceTemplate = {
  uriTemplate: 'pipelines://{id}/runs',
  name: 'Pipeline Runs',
  description: 'Recent runs for a specific pipeline',
  mimeType: 'application/json',
  handler: async (uri: string, params: Record<string, string>, context: McpContext): Promise<McpResourceContent> => {
    const pipelineId = params.id;

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          pipeline_id: pipelineId,
          runs: [
            {
              id: 'run-001',
              status: 'success',
              branch: 'main',
              triggered_by: 'john.doe',
              started_at: new Date(Date.now() - 7200000).toISOString(),
              completed_at: new Date(Date.now() - 6000000).toISOString(),
              duration: '20 minutes',
            },
            {
              id: 'run-002',
              status: 'failed',
              branch: 'feature/new-api',
              triggered_by: 'jane.smith',
              started_at: new Date(Date.now() - 14400000).toISOString(),
              completed_at: new Date(Date.now() - 13800000).toISOString(),
              duration: '10 minutes',
              failure_reason: 'Test stage failed',
            },
            {
              id: 'run-003',
              status: 'running',
              branch: 'main',
              triggered_by: 'mcp-client',
              started_at: new Date(Date.now() - 300000).toISOString(),
              progress: 45,
            },
          ],
          total: 3,
          retrieved_at: new Date().toISOString(),
        }, null, 2),
      }],
    };
  },
};

/**
 * Resource Template: pipelines://{id}/config
 * Get pipeline configuration
 */
export const pipelineConfigTemplate: McpResourceTemplate = {
  uriTemplate: 'pipelines://{id}/config',
  name: 'Pipeline Configuration',
  description: 'Configuration for a specific pipeline',
  mimeType: 'application/json',
  handler: async (uri: string, params: Record<string, string>, context: McpContext): Promise<McpResourceContent> => {
    const pipelineId = params.id;

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          id: pipelineId,
          name: 'Build Pipeline',
          description: 'Build and test the application',
          triggers: ['push', 'manual', 'schedule'],
          stages: [
            { name: 'Checkout', type: 'git', timeout: '5m' },
            { name: 'Install', type: 'shell', command: 'npm install', timeout: '10m' },
            { name: 'Build', type: 'shell', command: 'npm run build', timeout: '20m' },
            { name: 'Test', type: 'shell', command: 'npm test', timeout: '30m' },
            { name: 'Lint', type: 'shell', command: 'npm run lint', timeout: '10m' },
            { name: 'Publish', type: 'artifact', condition: 'branch=main' },
          ],
          environment_variables: {
            NODE_VERSION: '18',
            CI: 'true',
          },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: new Date().toISOString(),
        }, null, 2),
      }],
    };
  },
};

/**
 * Resource: deployments://list
 * List all deployments
 */
export const deploymentsListResource: McpResource = {
  uri: 'deployments://list',
  name: 'Deployment List',
  description: 'List of recent deployments across all projects',
  mimeType: 'application/json',
  handler: async (uri: string, context: McpContext): Promise<McpResourceContent> => {
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          deployments: [
            {
              id: 'deploy-001',
              project: 'orion-api',
              environment: 'prod',
              version: 'v2.3.1',
              status: 'success',
              deployed_at: new Date(Date.now() - 3600000).toISOString(),
            },
            {
              id: 'deploy-002',
              project: 'orion-frontend',
              environment: 'staging',
              version: 'v2.4.0-rc.1',
              status: 'success',
              deployed_at: new Date(Date.now() - 7200000).toISOString(),
            },
          ],
          total: 2,
          retrieved_at: new Date().toISOString(),
        }, null, 2),
      }],
    };
  },
};

/**
 * Resource Template: deployments://{id}
 * Get deployment details
 */
export const deploymentDetailTemplate: McpResourceTemplate = {
  uriTemplate: 'deployments://{id}',
  name: 'Deployment Details',
  description: 'Detailed information about a specific deployment',
  mimeType: 'application/json',
  handler: async (uri: string, params: Record<string, string>, context: McpContext): Promise<McpResourceContent> => {
    const deploymentId = params.id;

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          id: deploymentId,
          project: 'orion-api',
          environment: 'prod',
          version: 'v2.3.1',
          commit_sha: 'a1b2c3d4e5f6',
          status: 'success',
          deployed_by: 'john.doe@example.com',
          deployed_at: new Date(Date.now() - 3600000).toISOString(),
          duration: '4m 32s',
          strategy: 'rolling',
          replicas: 3,
          health_check: {
            status: 'healthy',
            endpoint: '/health',
            response_time: '125ms',
          },
          rollback_available: true,
          rollback_version: 'v2.3.0',
        }, null, 2),
      }],
    };
  },
};

/**
 * Resource Template: deployments://env/{env}
 * Get deployments by environment
 */
export const deploymentsByEnvTemplate: McpResourceTemplate = {
  uriTemplate: 'deployments://env/{env}',
  name: 'Deployments by Environment',
  description: 'List deployments for a specific environment',
  mimeType: 'application/json',
  handler: async (uri: string, params: Record<string, string>, context: McpContext): Promise<McpResourceContent> => {
    const env = params.env;

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          environment: env,
          deployments: [
            {
              id: 'deploy-001',
              project: 'orion-api',
              version: 'v2.3.1',
              status: 'success',
              deployed_at: new Date(Date.now() - 3600000).toISOString(),
            },
            {
              id: 'deploy-002',
              project: 'orion-frontend',
              version: 'v2.3.1',
              status: 'success',
              deployed_at: new Date(Date.now() - 7200000).toISOString(),
            },
          ],
          services_running: 5,
          retrieved_at: new Date().toISOString(),
        }, null, 2),
      }],
    };
  },
};

/**
 * Resource: metrics://dora
 * DORA metrics summary
 */
export const doraMetricsResource: McpResource = {
  uri: 'metrics://dora',
  name: 'DORA Metrics',
  description: 'DORA metrics for DevOps performance measurement',
  mimeType: 'application/json',
  handler: async (uri: string, context: McpContext): Promise<McpResourceContent> => {
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          metrics: {
            deployment_frequency: {
              value: 'Multiple deploys per day',
              rating: 'Elite',
              trend: 'improving',
            },
            lead_time_for_changes: {
              value: '< 1 hour',
              rating: 'Elite',
              trend: 'stable',
            },
            change_failure_rate: {
              value: '1-3%',
              rating: 'High',
              trend: 'improving',
            },
            mean_time_to_recovery: {
              value: '< 1 hour',
              rating: 'Elite',
              trend: 'stable',
            },
          },
          overall_rating: 'Elite',
          period: 'Last 30 days',
          retrieved_at: new Date().toISOString(),
        }, null, 2),
      }],
    };
  },
};

/**
 * Resource: metrics://efficiency
 * R&D efficiency metrics
 */
export const efficiencyMetricsResource: McpResource = {
  uri: 'metrics://efficiency',
  name: 'Efficiency Metrics',
  description: 'R&D efficiency and productivity metrics',
  mimeType: 'application/json',
  handler: async (uri: string, context: McpContext): Promise<McpResourceContent> => {
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          metrics: {
            cycle_time: {
              value: '3.2 days',
              trend: '-15%',
              breakdown: {
                coding: '1.5 days',
                review: '0.8 days',
                testing: '0.5 days',
                deployment: '0.4 days',
              },
            },
            code_review_time: {
              value: '4.2 hours',
              trend: '-8%',
            },
            build_success_rate: {
              value: '95.2%',
              trend: '+2.3%',
            },
            test_coverage: {
              value: '78.5%',
              trend: '+3.1%',
            },
            developer_productivity: {
              value: '12.3 PRs/month',
              trend: '+5%',
            },
          },
          period: 'Last 30 days',
          retrieved_at: new Date().toISOString(),
        }, null, 2),
      }],
    };
  },
};

/**
 * Resource: metrics://cost
 * Cost metrics summary
 */
export const costMetricsResource: McpResource = {
  uri: 'metrics://cost',
  name: 'Cost Metrics',
  description: 'Cloud cost and resource utilization metrics',
  mimeType: 'application/json',
  handler: async (uri: string, context: McpContext): Promise<McpResourceContent> => {
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          monthly_cost: {
            total: 15743.52,
            currency: 'USD',
            trend: '+12.3%',
            budget_used: '78.7%',
          },
          cost_by_service: [
            { service: 'EC2', cost: 6234.18, percentage: 39.6 },
            { service: 'RDS', cost: 3456.72, percentage: 21.9 },
            { service: 'S3', cost: 2145.89, percentage: 13.6 },
            { service: 'EKS', cost: 1890.45, percentage: 12.0 },
          ],
          resource_utilization: {
            cpu: '65%',
            memory: '72%',
            storage: '45%',
          },
          savings_potential: {
            reserved_instances: 1246.84,
            right_sizing: 691.34,
            total: 1938.18,
          },
          period: 'Current month',
          retrieved_at: new Date().toISOString(),
        }, null, 2),
      }],
    };
  },
};

/**
 * Export all static resources
 */
export const staticResources: McpResource[] = [
  projectsListResource,
  pipelinesListResource,
  deploymentsListResource,
  doraMetricsResource,
  efficiencyMetricsResource,
  costMetricsResource,
];

/**
 * Export all resource templates
 */
export const resourceTemplates: McpResourceTemplate[] = [
  projectDetailTemplate,
  pipelineRunsTemplate,
  pipelineConfigTemplate,
  deploymentDetailTemplate,
  deploymentsByEnvTemplate,
];

/**
 * All resources (static + templates)
 */
export const allResources = {
  static: staticResources,
  templates: resourceTemplates,
};