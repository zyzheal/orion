/**
 * AI Agents Service
 *
 * Autonomous AI agents for pipeline optimization, release notes generation,
 * performance optimization, and monitoring. All agents extend BaseAgent
 * and use AIGateway for LLM calls.
 *
 * Available agents:
 * - PipelineYamlAgent: Pipeline YAML optimization and validation
 * - ReleaseNotesAgent: Automatic release notes generation
 * - PerfOptAgent: Performance optimization recommendations
 */

// Base classes and types
export { BaseAgent } from './base/BaseAgent';
export { ToolAdapter } from './base/ToolAdapter';
// Tool types are defined in ./base/types, ToolAdapter imports them internally
export { ToolDefinition, ToolHandler, ToolResult } from './base/types';
export {
  AgentConfig,
  AgentRetryConfig,
  AgentExecutionContext,
  AgentAuditLog,
  AgentTokenUsage,
  AgentCapability,
  AgentStatus,
  AgentInfo,
  BuiltInToolName,
} from './base/types';

// Concrete agents
export { PipelineYamlAgent } from './pipeline/PipelineYamlAgent';
export { ReleaseNotesAgent } from './release/ReleaseNotesAgent';
export { PerfOptAgent } from './performance/PerfOptAgent';

// Agent-specific types
// release/types.ts exports: ReleaseNotesAgentConfig, ReleaseNotesResult
export {
  ReleaseNotesAgentConfig as ReleaseNotesConfig,
  ReleaseNotesResult as ReleaseNotesOutput,
} from './release/types';
// performance/types.ts exports: PerfOptAgentConfig, PerformanceAnalysisResult
export {
  PerfOptAgentConfig as PerfOptConfig,
  PerformanceAnalysisResult as PerfOptResult,
} from './performance/types';
// stability/types.ts exports: RootCauseAgentConfig, RootCauseAnalysisResult
export {
  RootCauseAgentConfig as StabilityConfig,
  RootCauseAnalysisResult as StabilityCheckResult,
} from './stability/types';
