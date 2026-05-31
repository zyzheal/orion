// orion-platform-service/src/services/inline-script/WasmRuntime.ts

import pino from 'pino';
import { getQuickJS, QuickJSWASMModule, QuickJSContext, QuickJSHandle } from 'quickjs-emscripten';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface WasmExecutionRequest {
  code: string;
  timeout: number;
  memoryLimit: number;
}

export interface WasmExecutionResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

/**
 * WASM Runtime - executes JavaScript/TypeScript code in a sandboxed QuickJS VM.
 *
 * QuickJS provides a true security boundary: it has no access to Node.js APIs
 * (fs, net, child_process, etc.), making it safe for untrusted inline scripts.
 *
 * Memory and CPU limits are enforced by the VM itself.
 */
export class WasmRuntime {
  private vmModule: Promise<QuickJSWASMModule> | null = null;

  /**
   * Lazily initialize the QuickJS WASM module (cold start optimization).
   */
  private async getVMModule(): Promise<QuickJSWASMModule> {
    if (!this.vmModule) {
      this.vmModule = getQuickJS();
    }
    return this.vmModule;
  }

  /**
   * Execute JavaScript code in a sandboxed QuickJS VM.
   *
   * Each execution gets its own context for isolation.
   * The context is disposed after execution to prevent memory leaks.
   */
  async execute(request: WasmExecutionRequest): Promise<WasmExecutionResult> {
    logger.info(
      { timeout: request.timeout, memoryLimit: request.memoryLimit, codeLength: request.code.length },
      'WASM execution (QuickJS)'
    );

    const vm = await this.getVMModule();

    // Create a runtime with memory limit (in bytes)
    const rt = vm.newRuntime({ memoryLimitBytes: request.memoryLimit });

    // Set up interrupt handler for CPU timeout
    const deadline = Date.now() + request.timeout;
    rt.setInterruptHandler(() => {
      if (Date.now() > deadline) {
        throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Execution timeout: exceeded CPU time limit');
      }
    });

    // Create context for code isolation
    const ctx: QuickJSContext = rt.newContext();

    try {
      // Create a safe console.log that captures to stdout
      const stdoutLines: string[] = [];

      const consoleLogFn = ctx.newFunction('log', (...args: QuickJSHandle[]) => {
        const strings = args.map((arg) => {
          const dumped = ctx.dump(arg);
          return typeof dumped === 'string' ? dumped : JSON.stringify(dumped);
        });
        stdoutLines.push(strings.join(' '));
      });

      const consoleObj = ctx.newObject();
      ctx.setProp(consoleObj, 'log', consoleLogFn);
      consoleLogFn.dispose();

      // Set global console object (ctx.global is the global object)
      ctx.setProp(ctx.global, 'console', consoleObj);
      consoleObj.dispose();

      // Execute the code
      const result = ctx.evalCode(request.code);

      if (result.error) {
        const dumped = ctx.dump(result.error);
        result.error.dispose();

        // Extract meaningful error message
        let errorStr: string;
        if (dumped && typeof dumped === 'object') {
          errorStr = (dumped as any).message || (dumped as any).name || JSON.stringify(dumped);
        } else {
          errorStr = typeof dumped === 'string' ? dumped : String(dumped);
        }

        return {
          success: false,
          stdout: stdoutLines.join('\n'),
          error: errorStr,
        };
      }

      // Clean up result value
      result.value.dispose();

      return {
        success: true,
        stdout: stdoutLines.join('\n'),
      };
    } catch (error: any) {
      const message = error?.message || String(error);

      // Detect OOM or timeout errors from QuickJS
      if (message.includes('memory') || message.includes('alloc') || message.includes('exceeded') || message.includes('timeout')) {
        return {
          success: false,
          error: `Resource limit exceeded: ${message}`,
        };
      }

      return {
        success: false,
        error: message,
      };
    } finally {
      // Dispose context and runtime to prevent memory leaks
      try { ctx.dispose(); } catch { /* already disposed */ }
      try { rt.dispose(); } catch { /* already disposed */ }
    }
  }
}
