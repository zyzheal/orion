/**
 * yaml.ts - Pipeline YAML 生成器
 * 抽取自 pipeline-svc/PipelineEditor/index.tsx (P2-9 Phase 102)
 * 对齐后端 PipelineStage schema (FIXED P0-8)
 */
import type { StageConfig } from './types';
import type { PipelineForm } from './pipelineForm';

export const generatePipelineYaml = (
  pipelineInfo: PipelineForm,
  stages: StageConfig[]
): string => {
  const yamlLines: string[] = [
    `apiVersion: v1`,
    `kind: Pipeline`,
    `metadata:`,
    `  name: ${pipelineInfo.name}`,
    `  version: ${pipelineInfo.version}`,
    `  description: ${pipelineInfo.description || '""'}`,
    ``,
    `spec:`,
    `  stages:`,
  ];

  for (const stage of stages) {
    const stepUses = stage.config?.uses || `orion/${stage.type}@v1`;
    const stepName = `${stage.name}-step`;

    // Buildx 特殊配置
    if (stage.type === 'buildx' && stage.config?.imageName) {
      const stageLines = [
        `    - name: ${stage.name}`,
        `      type: buildx`,
        `      timeout: ${stage.timeout || 300}`,
        `      retries: ${stage.retryCount || 0}`,
        `      config:`,
        `        imageName: ${stage.config.imageName}`,
        `        tag: ${stage.config.tag || 'latest'}`,
        `        platforms: ${JSON.stringify(stage.config.platforms || ['linux/amd64'])}`,
      ];
      if (stage.config.dockerfilePath) {
        stageLines.push(`        dockerfile: ${stage.config.dockerfilePath}`);
      }
      if (stage.config.push !== false) {
        stageLines.push(`        push: true`);
      }
      if (stage.dependsOn?.length) {
        stageLines.push(`      dependsOn: ${JSON.stringify(stage.dependsOn)}`);
      }
      yamlLines.push(...stageLines);
      continue;
    }

    // Container 特殊配置
    if (stage.type === 'container' && stage.config?.containerImage) {
      const stageLines = [
        `    - name: ${stage.name}`,
        `      type: container`,
        `      timeout: ${stage.timeout || 300}`,
        `      retries: ${stage.retryCount || 0}`,
        `      config:`,
        `        image: ${stage.config.containerImage}`,
      ];
      if (stage.config.containerCommand) {
        stageLines.push(`        command: ${stage.config.containerCommand}`);
      }
      if (stage.config.containerResources) {
        stageLines.push(`        resources: ${JSON.stringify(stage.config.containerResources)}`);
      }
      if (stage.config.containerNetwork) {
        stageLines.push(`        network: ${stage.config.containerNetwork}`);
      }
      if (stage.dependsOn?.length) {
        stageLines.push(`      dependsOn: ${JSON.stringify(stage.dependsOn)}`);
      }
      yamlLines.push(...stageLines);
      continue;
    }

    const stepWith =
      stage.config && Object.keys(stage.config).length > 0
        ? `\n        with: ${JSON.stringify(stage.config)}`
        : '';

    const stageLines = [
      `    - name: ${stage.name}`,
      `      runsOn: ubuntu-latest`,
      `      timeout: ${stage.timeout || 300}`,
      `      retries: ${stage.retryCount || 0}`,
    ];

    if (stage.dependsOn?.length) {
      stageLines.push(`      dependsOn: ${JSON.stringify(stage.dependsOn)}`);
    }

    stageLines.push(`      steps:`);
    stageLines.push(`        - name: ${stepName}`);
    stageLines.push(`          uses: ${stepUses}${stepWith}`);

    // 缓存配置
    if (stage.cache?.enabled) {
      stageLines.push(`      cache:`);
      stageLines.push(`        enabled: true`);
      stageLines.push(`        key: ${stage.cache.key}`);
      stageLines.push(`        paths: ${JSON.stringify(stage.cache.paths)}`);
      if (stage.cache.restoreKeys?.length) {
        stageLines.push(`        restoreKeys: ${JSON.stringify(stage.cache.restoreKeys)}`);
      }
    }

    // Artifact 配置
    if (stage.artifacts?.upload?.length) {
      stageLines.push(`      artifacts:`);
      stageLines.push(`        upload: ${JSON.stringify(stage.artifacts.upload)}`);
      if (stage.artifacts.expiry) {
        stageLines.push(`        expiry: ${stage.artifacts.expiry}`);
      }
    }

    // 矩阵构建配置
    if (stage.matrix?.enabled && stage.matrix.dimensions?.length) {
      stageLines.push(`      matrix:`);
      const matrixEntries = stage.matrix.dimensions.map(
        (d) => `        ${d.key}: ${JSON.stringify(d.values)}`
      );
      stageLines.push(...matrixEntries);
      if (stage.matrix.exclusions?.length) {
        stageLines.push(`        exclude:`);
        stage.matrix.exclusions.forEach((rule) => {
          stageLines.push(`          - ${JSON.stringify(rule.match)}`);
        });
      }
    }

    yamlLines.push(...stageLines);
  }

  return yamlLines.join('\n');
};
