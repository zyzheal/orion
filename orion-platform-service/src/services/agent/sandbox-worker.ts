/**
 * Agent Sandbox Worker
 *
 * 运行在独立 Worker Thread 中的沙箱代码。
 * 由 AgentSandbox 通过 worker_threads 启动，
 * 与主进程隔离，无数据库连接访问权限。
 *
 * P1 SRE Guard | 2026-04-28
 */

import { parentPort } from 'worker_threads';
import { OrionError, ErrorCode } from '../../../errors';

if (!parentPort) {
  throw new Error('This file must be run as a Worker Thread');
}

// ==================== Security: Blocklists ====================

const BLOCKED_COMMANDS = [
  'rm -rf /',
  'DROP TABLE',
  'DROP DATABASE',
  'sudo ',
  'chmod 777 /',
  'curl ',
  'wget ',
  'nc ',
  'nmap ',
  '/etc/passwd',
  '/etc/shadow',
];

const BLOCKED_PATHS = [
  '/etc/',
  '/var/run/',
  '/proc/',
  '/sys/',
  '.env',
  'node_modules/',
];

function isCommandBlocked(cmd: string): boolean {
  return BLOCKED_COMMANDS.some((blocked) => cmd.toLowerCase().includes(blocked.toLowerCase()));
}

function isPathBlocked(filePath: string): boolean {
  return BLOCKED_PATHS.some((blocked) => filePath.includes(blocked));
}

// ==================== Task Execution ====================

interface SandboxTask {
  id: string;
  action: string;
  input: Record<string, unknown>;
  profile: {
    allowedTools: string[];
    maxExecutionTimeMs: number;
    memoryLimitMB: number;
  };
}

interface SandboxResult {
  taskId: string;
  success: boolean;
  output: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

async function executeInSandbox(task: SandboxTask): Promise<{ output: Record<string, unknown>; durationMs: number }> {
  const { action, input, profile } = task;
  const startTime = Date.now();

  // Check tool permission
  if (!profile.allowedTools.includes(action)) {
    throw new OrionError(ErrorCode.NOT_FOUND, `Tool "${action}" is not allowed`);
  }

  let output: Record<string, unknown>;
  switch (action) {
    case 'read_file': {
      const filePath = (input.filePath as string) || '/dev/null';
      if (isPathBlocked(filePath)) {
        throw new Error(`Access to "${filePath}" is blocked`);
      }
      output = {
        success: true,
        filePath,
        content: `[Sandbox] Simulated content for ${filePath}`,
        lines: 1,
        timestamp: new Date().toISOString(),
      };
      break;
    }

    case 'run_command': {
      const command = (input.command as string) || 'echo hello';
      if (isCommandBlocked(command)) {
        throw new Error(`Command "${command}" is forbidden`);
      }
      output = {
        success: true,
        command,
        stdout: `[Sandbox] Simulated: ${command}`,
        stderr: '',
        exitCode: 0,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
      break;
    }

    case 'write_code': {
      const filePath = (input.filePath as string) || '/tmp/agent-output.ts';
      if (isPathBlocked(filePath)) {
        throw new Error(`Write to "${filePath}" is blocked`);
      }
      const content = (input.content as string) || '// Agent generated code';
      output = {
        success: true,
        filePath,
        linesWritten: content.split('\n').length,
        timestamp: new Date().toISOString(),
      };
      break;
    }

    case 'create_pr': {
      output = {
        success: true,
        prUrl: 'https://github.com/org/repo/pull/1',
        prNumber: 1,
        timestamp: new Date().toISOString(),
      };
      break;
    }

    case 'request_approval': {
      output = {
        success: true,
        approvalId: `approval-${Date.now()}`,
        status: 'pending',
        timestamp: new Date().toISOString(),
      };
      break;
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }

  return { output, durationMs: Date.now() - startTime };
}

// ==================== Message Handler ====================

parentPort.on('message', async (task: SandboxTask) => {
  try {
    const { output, durationMs } = await executeInSandbox(task);
    parentPort!.postMessage({
      taskId: task.id,
      success: true,
      output,
      durationMs,
    });
  } catch (error) {
    parentPort!.postMessage({
      taskId: task.id,
      success: false,
      output: {},
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now(),
    });
  }
});
