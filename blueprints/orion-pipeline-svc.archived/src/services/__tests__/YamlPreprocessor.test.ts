/**
 * YamlPreprocessor Matrix 展开测试
 *
 * 验证：
 * 1. 笛卡尔积展开
 * 2. exclude 过滤
 * 3. matrix 变量替换
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { YamlPreprocessor } from '../../engine/YamlPreprocessor';

describe('YamlPreprocessor - Matrix Expansion', () => {
  let preprocessor: YamlPreprocessor;

  beforeEach(() => {
    preprocessor = new YamlPreprocessor();
  });

  it('should parse basic YAML pipeline', () => {
    const yaml = `
stages:
  - name: Build
    steps:
      - name: Build step
        run: echo building
`;
    const result = preprocessor.parse(yaml);
    expect(result.stages.length).toBe(1);
    expect(result.stages[0].stageName).toBe('Build');
  });

  it('should expand matrix with single dimension', () => {
    const yaml = `
stages:
  - name: Test
    matrix:
      os: [linux, macos, windows]
    steps:
      - name: Run tests
        run: echo testing on \${matrix.os}
`;
    const result = preprocessor.parse(yaml);

    expect(result.stages.length).toBe(3);
    expect(result.stages[0].stageName).toContain('os=linux');
    expect(result.stages[1].stageName).toContain('os=macos');
    expect(result.stages[2].stageName).toContain('os=windows');
  });

  it('should expand matrix with multiple dimensions (Cartesian product)', () => {
    const yaml = `
stages:
  - name: Build
    matrix:
      platform: [x64, arm64]
      env: [dev, prod]
    steps:
      - name: Build
        run: echo building
`;
    const result = preprocessor.parse(yaml);

    // 2 x 2 = 4 combinations
    expect(result.stages.length).toBe(4);
  });

  it('should respect exclude rules in matrix', () => {
    const yaml = `
stages:
  - name: Test
    matrix:
      os: [linux, macos]
      node: [16, 18]
      exclude:
        - os: macos
          node: 16
    steps:
      - name: Test
        run: echo test
`;
    const result = preprocessor.parse(yaml);

    // 2 x 2 = 4, minus 1 excluded = 3
    expect(result.stages.length).toBe(3);
    // Verify excluded combination is not present
    const stageNames = result.stages.map(s => s.stageName);
    expect(stageNames.some(n => n.includes('macos') && n.includes('16'))).toBe(false);
  });

  it('should set MATRIX environment variables', () => {
    const yaml = `
stages:
  - name: Test
    matrix:
      os: [linux, windows]
    steps:
      - name: Test
        run: echo test
`;
    const result = preprocessor.parse(yaml);

    // Check env vars on first stage
    const firstStage = result.stages[0];
    expect(firstStage.env).toHaveProperty('MATRIX_OS');
    expect(firstStage.env).toHaveProperty('MATRIX_LABEL');
  });

  it('should handle stages without matrix normally', () => {
    const yaml = `
stages:
  - name: Build
    steps:
      - name: Build
        run: echo build
  - name: Test
    matrix:
      os: [linux, windows]
    steps:
      - name: Test
        run: echo test
  - name: Deploy
    dependsOn:
      - Build
      - Test
    steps:
      - name: Deploy
        run: echo deploy
`;
    const result = preprocessor.parse(yaml);

    // Build (1) + Test (2 from matrix) + Deploy (1) = 4
    expect(result.stages.length).toBe(4);
  });
});
