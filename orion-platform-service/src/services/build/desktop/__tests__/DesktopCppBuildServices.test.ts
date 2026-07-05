/**
 * Desktop and C++ Build Services Tests
 *
 * Tests for DesktopBuildService and CppBuildService.
 */

import { DesktopBuildService } from '../DesktopBuildService';
import { CppBuildService } from '../../cpp/CppBuildService';
import { BuildType, Platform } from '../../executors/BaseBuildExecutor';

describe('Desktop and C++ Build Services', () => {
  describe('DesktopBuildService', () => {
    it('should create Windows desktop build config', () => {
      const service = new DesktopBuildService();
      const config = service.createBuildConfig({
        platform: 'windows',
        projectPath: '/src/desktop',
        buildTool: 'electron',
      });

      expect(config.type).toBe(BuildType.DESKTOP_WINDOWS);
      expect(config.platform).toBe(Platform.WINDOWS);
    });

    it('should create Linux desktop build config', () => {
      const service = new DesktopBuildService();
      const config = service.createBuildConfig({
        platform: 'linux',
        projectPath: '/src/desktop',
        buildTool: 'electron',
      });

      expect(config.type).toBe(BuildType.DESKTOP_LINUX);
      expect(config.platform).toBe(Platform.LINUX);
    });

    it('should create macOS desktop build config', () => {
      const service = new DesktopBuildService();
      const config = service.createBuildConfig({
        platform: 'macos',
        projectPath: '/src/desktop',
        buildTool: 'electron',
      });

      expect(config.type).toBe(BuildType.DESKTOP_MACOS);
      expect(config.platform).toBe(Platform.MACOS);
    });

    it('should generate electron build script', () => {
      const service = new DesktopBuildService();
      const config = service.createBuildConfig({
        platform: 'macos',
        projectPath: '/src/desktop',
        buildTool: 'electron',
      });

      expect(config.buildScript).toContain('npm run build:mac');
    });

    it('should generate cmake build script', () => {
      const service = new DesktopBuildService();
      const config = service.createBuildConfig({
        platform: 'linux',
        projectPath: '/src/desktop',
        buildTool: 'cmake',
      });

      expect(config.buildScript).toContain('cmake');
      expect(config.buildScript).toContain('make');
    });

    it('should set electron version env var when provided', () => {
      const service = new DesktopBuildService();
      const config = service.createBuildConfig({
        platform: 'windows',
        projectPath: '/src/desktop',
        buildTool: 'electron',
        electronVersion: '28.0.0',
      });

      expect(config.envVars?.ELECTRON_VERSION).toBe('28.0.0');
    });

    it('should return correct output paths for electron', () => {
      const service = new DesktopBuildService();
      const paths = service.getOutputPaths('windows', 'electron');

      expect(paths).toContain('dist/windows/*');
    });
  });

  describe('CppBuildService', () => {
    it('should create Linux C++ build config', () => {
      const service = new CppBuildService();
      const config = service.createBuildConfig({
        platform: 'linux',
        projectPath: '/src/cpp',
        buildSystem: 'cmake',
        compiler: 'gcc',
      });

      expect(config.type).toBe(BuildType.CPP_LINUX);
      expect(config.buildScript).toContain('cmake');
    });

    it('should create Windows C++ build config', () => {
      const service = new CppBuildService();
      const config = service.createBuildConfig({
        platform: 'windows',
        projectPath: '/src/cpp',
        buildSystem: 'cmake',
        compiler: 'msvc',
      });

      expect(config.type).toBe(BuildType.CPP_WINDOWS);
    });

    it('should create macOS C++ build config', () => {
      const service = new CppBuildService();
      const config = service.createBuildConfig({
        platform: 'macos',
        projectPath: '/src/cpp',
        buildSystem: 'cmake',
        compiler: 'clang',
      });

      expect(config.type).toBe(BuildType.CPP_MACOS);
    });

    it('should generate cmake build script with options', () => {
      const service = new CppBuildService();
      const config = service.createBuildConfig({
        platform: 'linux',
        projectPath: '/src/cpp',
        buildSystem: 'cmake',
        compiler: 'gcc',
        cmakeOptions: {
          CMAKE_BUILD_TYPE: 'Release',
          ENABLE_TESTS: 'ON',
        },
      });

      expect(config.buildScript).toContain('-DCMAKE_BUILD_TYPE=Release');
      expect(config.buildScript).toContain('-DENABLE_TESTS=ON');
    });

    it('should set compiler env vars for gcc', () => {
      const service = new CppBuildService();
      const config = service.createBuildConfig({
        platform: 'linux',
        projectPath: '/src/cpp',
        buildSystem: 'cmake',
        compiler: 'gcc',
      });

      expect(config.envVars?.CC).toBe('gcc');
      expect(config.envVars?.CXX).toBe('g++');
    });

    it('should set compiler env vars for clang', () => {
      const service = new CppBuildService();
      const config = service.createBuildConfig({
        platform: 'linux',
        projectPath: '/src/cpp',
        buildSystem: 'cmake',
        compiler: 'clang',
      });

      expect(config.envVars?.CC).toBe('clang');
      expect(config.envVars?.CXX).toBe('clang++');
    });

    it('should generate make build script', () => {
      const service = new CppBuildService();
      const config = service.createBuildConfig({
        platform: 'linux',
        projectPath: '/src/cpp',
        buildSystem: 'make',
        compiler: 'gcc',
      });

      expect(config.buildScript).toContain('make');
    });

    it('should generate meson build script', () => {
      const service = new CppBuildService();
      const config = service.createBuildConfig({
        platform: 'linux',
        projectPath: '/src/cpp',
        buildSystem: 'meson',
        compiler: 'gcc',
      });

      expect(config.buildScript).toContain('meson setup build');
      expect(config.buildScript).toContain('meson compile -C build');
    });

    it('should return correct output paths for executable', () => {
      const service = new CppBuildService();
      const paths = service.getOutputPaths('/src/cpp', 'executable');

      expect(paths).toContain('/src/cpp/build/bin/*');
    });

    it('should return correct output paths for shared library', () => {
      const service = new CppBuildService();
      const paths = service.getOutputPaths('/src/cpp', 'shared');

      expect(paths).toContain('/src/cpp/build/lib/*.so');
      expect(paths).toContain('/src/cpp/build/lib/*.dylib');
      expect(paths).toContain('/src/cpp/build/lib/*.dll');
    });

    it('should return correct output paths for static library', () => {
      const service = new CppBuildService();
      const paths = service.getOutputPaths('/src/cpp', 'static');

      expect(paths).toContain('/src/cpp/build/lib/*.a');
      expect(paths).toContain('/src/cpp/build/lib/*.lib');
    });
  });
});