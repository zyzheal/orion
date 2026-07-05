// docs/design-constraints/orion/detector/rules.ts

export interface OrionDetectionRule {
  name: string;
  pattern: RegExp;
  type: 'frontend' | 'backend' | 'fullstack';
  module: string;
}

export const ORION_DETECTION_RULES: OrionDetectionRule[] = [
  {
    name: 'pipeline-svc',
    pattern: /orion-frontend\/src\/pages\/pipeline-svc/,
    type: 'frontend',
    module: 'pipeline',
  },
  {
    name: 'artifact-svc',
    pattern: /orion-frontend\/src\/pages\/artifact-svc/,
    type: 'frontend',
    module: 'artifact',
  },
  {
    name: 'monitor-svc',
    pattern: /orion-frontend\/src\/pages\/monitor-svc/,
    type: 'frontend',
    module: 'monitor',
  },
  {
    name: 'ai-service',
    pattern: /orion-ai-service/,
    type: 'backend',
    module: 'ai',
  },
  {
    name: 'platform-service',
    pattern: /orion-platform-service\/src/,
    type: 'backend',
    module: 'platform',
  },
  {
    name: 'frontend',
    pattern: /orion-frontend\/src\/(pages|components|api)/,
    type: 'frontend',
    module: 'frontend',
  },
];

export const CODE_TYPE_INDICATORS = {
  frontend: ['src/pages/', 'src/components/', 'src/api/'],
  backend: ['src/services/', 'src/api/', 'src/routes/'],
  fullstack: ['orion-platform-service/', 'orion-frontend/'],
};