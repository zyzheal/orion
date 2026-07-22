// docs/design-constraints/framework/core/detector.ts

import { ORION_DETECTION_RULES, CODE_TYPE_INDICATORS } from '../../orion/detector/rules';

export interface DetectionResult {
  codeType: 'frontend' | 'backend' | 'fullstack';
  module: string;
  techStack: string[];
  designDocs: string[];
  profiles: string[];
}

export async function detectContext(
  targetPath: string = process.cwd()
): Promise<DetectionResult> {
  // Step 1: 代码类型识别
  const codeType = detectCodeType(targetPath);

  // Step 2: 模块识别
  const module = detectModule(targetPath);

  // Step 3: 设计文档关联
  const designDocs = await findDesignDocs(module);

  // Step 4: 检查项加载
  const profiles = loadProfiles(codeType, module);

  return {
    codeType,
    module,
    techStack: detectTechStack(codeType),
    designDocs,
    profiles,
  };
}

function detectCodeType(path: string): 'frontend' | 'backend' | 'fullstack' {
  const hasFrontend = CODE_TYPE_INDICATORS.frontend.some((indicator) =>
    path.includes(indicator)
  );
  const hasBackend = CODE_TYPE_INDICATORS.backend.some((indicator) =>
    path.includes(indicator)
  );

  if (hasFrontend && hasBackend) return 'fullstack';
  if (hasFrontend) return 'frontend';
  if (hasBackend) return 'backend';
  return 'fullstack';
}

function detectModule(path: string): string {
  for (const rule of ORION_DETECTION_RULES) {
    if (rule.pattern.test(path)) {
      return rule.module;
    }
  }
  return 'unknown';
}

async function findDesignDocs(module: string): Promise<string[]> {
  if (module === 'unknown') return [];
  const patterns = [
    `docs/superpowers/specs/*${module}*`,
    `docs/architecture/${module}-design.md`,
  ];
  // 简化实现，返回空数组
  return [];
}

function loadProfiles(codeType: string, module: string): string[] {
  const profiles = ['_base'];

  if (codeType === 'frontend' || codeType === 'fullstack') {
    profiles.push('a1_data_structure', 'a2_interaction', 'a3_flow', 'd_experience');
  }
  if (codeType === 'backend' || codeType === 'fullstack') {
    profiles.push('a1_data_structure', 'c1_compatibility', 'c2_scalability', 's_security');
  }

  if (module !== 'unknown') {
    profiles.push(module);
  }

  return profiles;
}

function detectTechStack(codeType: string): string[] {
  if (codeType === 'frontend') return ['React', 'Ant Design', 'TypeScript'];
  if (codeType === 'backend') return ['Node.js', 'Fastify', 'TypeScript'];
  return ['React', 'Node.js', 'TypeScript'];
}