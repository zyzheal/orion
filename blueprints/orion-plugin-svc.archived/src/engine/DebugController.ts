/**
 * Stub: Debug Controller
 * Singleton for managing plugin execution debug state (pause/resume/step).
 */

export interface DebugState {
  runId: string;
  status: string;
}

export class DebugController {
  private static instance: DebugController | null = null;
  private states: Map<string, DebugState> = new Map();

  static getInstance(): DebugController {
    if (!DebugController.instance) {
      DebugController.instance = new DebugController();
    }
    return DebugController.instance;
  }

  async pause(runId: string): Promise<DebugState> {
    const state: DebugState = { runId, status: 'paused' };
    this.states.set(runId, state);
    return state;
  }

  async resume(runId: string): Promise<void> {
    this.states.delete(runId);
  }

  async step(runId: string): Promise<DebugState> {
    const state: DebugState = { runId, status: 'stepping' };
    this.states.set(runId, state);
    return state;
  }

  getState(runId: string): DebugState | undefined {
    return this.states.get(runId);
  }
}
