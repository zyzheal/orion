/**
 * PipelineEventPublisher - Stub implementation
 *
 * Publishes pipeline lifecycle events.
 * In production, this will wire to NATS/Redis pub-sub.
 */
import { PipelineRun } from '../models/PipelineRun';

export class PipelineEventPublisher {
  async publishRunCreated(_run: PipelineRun): Promise<void> {}
  async publishRunStarted(_run: PipelineRun): Promise<void> {}
  async publishRunCompleted(_run: PipelineRun): Promise<void> {}
  async publishRunFailed(_run: PipelineRun): Promise<void> {}
  async publishRunCancelled(_run: PipelineRun): Promise<void> {}
}
