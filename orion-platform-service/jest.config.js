module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/.worktrees/', '/dist/'],
  modulePathIgnorePatterns: ['/.worktrees/'],
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true, diagnostics: false }],
  },
  // Transform ES modules from @kubernetes/client-node and quickjs-emscripten
  transformIgnorePatterns: ['node_modules/(?!(?:@kubernetes/client-node|quickjs-emscripten|quickjs-emscripten-core|@jitl|openid-client|oauth4webapi)/)'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 75,
      statements: 75,
    },
    // Critical modules require higher coverage
    './src/services/pipeline/': {
      branches: 70,
      functions: 80,
      lines: 85,
      statements: 85,
    },
    './src/services/deploy/': {
      branches: 70,
      functions: 80,
      lines: 85,
      statements: 85,
    },
    './src/services/auth/': {
      branches: 70,
      functions: 80,
      lines: 85,
      statements: 85,
    },
    './src/services/tenant/': {
      branches: 70,
      functions: 80,
      lines: 85,
      statements: 85,
    },
    './src/services/approval/': {
      branches: 65,
      functions: 75,
      lines: 80,
      statements: 80,
    },
  },
};
