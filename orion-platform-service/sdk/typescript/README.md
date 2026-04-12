# Orion Plugin SDK for TypeScript

用于开发 Orion Pipeline Custom Task 插件的 TypeScript SDK。

## 安装

```bash
npm install @orion-design/plugin-sdk-typescript
```

## 快速开始

### 1. 创建插件类

继承 `TaskPlugin` 基类并实现必需的方法：

```typescript
import { TaskPlugin, PluginMetadata, TaskContext, TaskResult, TaskStatus } from '@orion-design/plugin-sdk-typescript';

export class MyCustomPlugin extends TaskPlugin {
  getMetadata(): PluginMetadata {
    return {
      name: 'my-custom-plugin',
      version: '1.0.0',
      description: 'My custom task plugin',
      author: 'Your Name',
      tags: ['custom', 'task'],
      configSchema: {
        param1: {
          type: 'string',
          description: 'Parameter 1',
          required: true,
        },
      },
    };
  }

  async execute(ctx: TaskContext): Promise<TaskResult> {
    this.initContext(ctx);
    
    this.info('Starting task execution...');
    
    // 读取配置
    const param1 = this.getConfig('param1');
    
    // 执行任务逻辑
    // ...
    
    return this.createSuccessResult({
      output1: 'result',
    });
  }
}
```

### 2. 使用 SDK 功能

SDK 提供以下便捷方法：

- `log(level, message)` - 输出日志
- `debug/info/warn/error(message)` - 各级别日志
- `getConfig(key, default)` - 读取配置
- `getEnv(key, default)` - 读取环境变量
- `getWorkspaceRoot()` - 获取工作区路径
- `readWorkspaceFile(path)` - 读取工作区文件
- `createSuccessResult(outputs)` - 创建成功结果
- `createFailedResult(errorMessage)` - 创建失败结果

### 3. 注册插件

```typescript
import { registerPlugin } from '@orion-design/plugin-sdk-typescript';

const plugin = new MyCustomPlugin();
registerPlugin(plugin);
```

## 示例

查看 `examples/` 目录中的完整示例：

- `code-quality-task.ts` - 代码质量检查插件（ESLint）

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 开发模式
npm run dev
```

## API 参考

### TaskPlugin 基类

#### 抽象方法

- `getMetadata(): PluginMetadata` - 获取插件元数据
- `execute(ctx: TaskContext): Promise<TaskResult>` - 执行任务

#### 日志方法

- `debug(message: string)` - DEBUG 日志
- `info(message: string)` - INFO 日志
- `warn(message: string)` - WARN 日志
- `error(message: string)` - ERROR 日志

#### 配置方法

- `getConfig(key: string, default?: any): any` - 读取配置项
- `getEnv(key: string, default?: string): string` - 读取环境变量

#### 工作区方法

- `getWorkspaceRoot(): string` - 获取工作区根路径
- `readWorkspaceFile(relativePath: string): string | undefined` - 读取文件

#### 结果创建

- `createSuccessResult(outputs?: Record<string, string>): TaskResult` - 成功结果
- `createFailedResult(errorMessage: string): TaskResult` - 失败结果

## 许可证

MIT
