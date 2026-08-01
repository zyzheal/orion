/**
 * Pipeline Templates API
 * Phase 1 - Template library management
 */

import apiClient from './client';

export interface PipelineTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  yaml_definition: string;
  version: number;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  defaultValue?: string | number | boolean | string[];
  required: boolean;
}

// ============================================================
// Backend API client
// ============================================================

export const pipelineTemplatesApi = {
  list: async (params?: { category?: string; page?: number; limit?: number }) => {
    const response = await apiClient.get('/api/pipeline-templates', { params });
    return response.data;
  },

  get: async (templateId: string) => {
    const response = await apiClient.get(`/api/pipeline-templates/${templateId}`);
    return response.data as PipelineTemplate;
  },

  create: async (data: { name: string; description?: string; category?: string; yaml_definition: string; tags?: string[] }) => {
    const response = await apiClient.post('/api/pipeline-templates', data);
    return response.data as PipelineTemplate;
  },

  update: async (templateId: string, data: Partial<PipelineTemplate>) => {
    const response = await apiClient.put(`/api/pipeline-templates/${templateId}`, data);
    return response.data as PipelineTemplate;
  },

  delete: async (templateId: string) => {
    const response = await apiClient.delete(`/api/pipeline-templates/${templateId}`);
    return response.data;
  },

  instantiate: async (templateId: string, data: { name: string; tenant_id?: string; project_id?: string; params?: Record<string, unknown> }) => {
    const response = await apiClient.post(`/api/pipeline-templates/${templateId}/instantiate`, data);
    return response.data;
  },

  saveFromPipeline: async (pipelineId: string, data: { name: string; description?: string; category?: string }) => {
    const response = await apiClient.post('/api/pipeline-templates', { ...data, pipelineId });
    return response.data as PipelineTemplate;
  },
};

export default pipelineTemplatesApi;

// ============================================================
// Frontend-side built-in templates for quick creation
// ============================================================

export interface FrontendPipelineTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'ci' | 'cd' | 'cicd' | 'deploy';
  stages: Array<{
    name: string;
    type: string;
    config?: Record<string, unknown>;
  }>;
}

export const pipelineTemplates: FrontendPipelineTemplate[] = [
  {
    id: 'ci-basic',
    name: '基础 CI',
    description: '代码扫描 + 构建 + 单元测试',
    icon: '🔨',
    category: 'ci',
    stages: [
      { name: '代码扫描', type: 'scan', config: { uses: 'orion/sonarqube@v1' } },
      { name: '构建', type: 'build', config: { uses: 'orion/build@v1', command: 'npm run build' } },
      { name: '单元测试', type: 'test', config: { uses: 'orion/test@v1', command: 'npm test' } },
    ],
  },
  {
    id: 'cd-basic',
    name: '基础 CD',
    description: '构建 Docker 镜像 + 部署到开发环境',
    icon: '🚀',
    category: 'cd',
    stages: [
      { name: '构建', type: 'build', config: { uses: 'orion/build@v1' } },
      { name: '构建镜像', type: 'buildx', config: { imageName: '${APP_NAME}', tag: '${BUILD_VERSION}' } },
      { name: '部署', type: 'deploy', config: { uses: 'orion/k8s-deploy@v1', targetEnv: 'dev' } },
    ],
  },
  {
    id: 'cicd-full',
    name: '完整 CI/CD',
    description: '扫描 + 构建 + 测试 + 部署到多环境',
    icon: '⚡',
    category: 'cicd',
    stages: [
      { name: '代码扫描', type: 'scan', config: { uses: 'orion/sonarqube@v1' } },
      { name: '构建', type: 'build', config: { uses: 'orion/build@v1', command: 'npm run build' } },
      { name: '单元测试', type: 'test', config: { uses: 'orion/test@v1', command: 'npm test' } },
      { name: '构建镜像', type: 'buildx', config: { imageName: '${APP_NAME}', tag: '${BUILD_VERSION}' } },
      { name: '部署开发', type: 'deploy', config: { uses: 'orion/k8s-deploy@v1', targetEnv: 'dev' } },
      { name: '部署生产', type: 'deploy', config: { uses: 'orion/k8s-deploy@v1', targetEnv: 'prod' } },
    ],
  },
  {
    id: 'deploy-k8s',
    name: 'K8s 部署',
    description: '直接部署到 Kubernetes 集群',
    icon: '☸️',
    category: 'deploy',
    stages: [
      { name: '部署', type: 'deploy', config: { uses: 'orion/k8s-deploy@v1' } },
      { name: '健康检查', type: 'custom', config: { uses: 'orion/healthcheck@v1' } },
    ],
  },
];

export function templateToYaml(template: FrontendPipelineTemplate, name: string, version: string, description: string): string {
  const lines: string[] = [
    'apiVersion: v1',
    'kind: Pipeline',
    'metadata:',
    `  name: ${name}`,
    `  version: ${version}`,
    `  description: "${description}"`,
    '',
    'spec:',
    '  stages:',
  ];

  for (const stage of template.stages) {
    const stepUses = stage.config?.uses || `orion/${stage.type}@v1`;
    const stageConfig = stage.config ? Object.fromEntries(
      Object.entries(stage.config).filter(([k]) => k !== 'uses')
    ) : {};
    const stepWith = Object.keys(stageConfig).length > 0 ? `\n        with: ${JSON.stringify(stageConfig)}` : '';

    lines.push(`    - name: ${stage.name}`);
    lines.push(`      type: ${stage.type}`);
    lines.push(`      runsOn: ubuntu-latest`);
    lines.push(`      timeout: 300`);
    lines.push(`      retries: 0`);
    lines.push(`      steps:`);
    lines.push(`        - name: ${stage.name.toLowerCase().replace(/\s+/g, '-')}`);
    lines.push(`          uses: ${stepUses}${stepWith}`);
  }

  return lines.join('\n');
}